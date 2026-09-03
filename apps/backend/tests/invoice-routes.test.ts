import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FLASH_COOKIE, parseFlash } from "@facturas/shared/flash";

/**
 * Tests de integración de las rutas REST contra una base de datos SQLite
 * temporal: llaman directamente a los `GET`/`POST`/`DELETE` exportados por
 * cada `route.ts`, construyendo el `Request` a mano (como antes se invocaba
 * la Server Action directamente).
 *
 * Solo se mockea `next/headers`: las rutas no llaman a `redirect` ni a
 * `revalidatePath` (eso era cosa de las Server Actions), así que a
 * diferencia del test antiguo no hace falta mockear `next/cache` ni
 * `next/navigation`.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const dbPath = path.join(root, "tests", ".tmp", "routes.db");

/**
 * Las rutas dejan el aviso de la operación en una cookie. Aquí basta con un
 * almacén en memoria: `vi.hoisted` porque la fábrica de `vi.mock` se eleva
 * por encima de las declaraciones del módulo.
 */
const { cookieJar } = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
  }),
}));

/** El aviso pendiente, ya interpretado. */
function lastFlash() {
  return parseFlash(cookieJar.get(FLASH_COOKIE));
}

type InvoicesRoute = typeof import("@/app/api/invoices/route");
type InvoiceRoute = typeof import("@/app/api/invoices/[id]/route");
type IssueRoute = typeof import("@/app/api/invoices/[id]/issue/route");
type StatusRoute = typeof import("@/app/api/invoices/[id]/status/route");
type Db = typeof import("@/lib/db");

let invoicesRoute: InvoicesRoute;
let invoiceRoute: InvoiceRoute;
let issueRoute: IssueRoute;
let statusRoute: StatusRoute;
let prisma: Db["prisma"];

const SETTINGS = {
  id: 1,
  issuerName: "Estudio Arévalo S.L.",
  issuerTaxId: "B12345674",
  issuerAddress: "Calle Mayor 12\n28013 Madrid",
  defaultSeries: "A",
  defaultVatRate: 21,
};

function formDataFrom(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

/** Factura base válida; cada test cambia solo lo que le interesa. */
function invoiceForm(overrides: Record<string, string> = {}): FormData {
  return formDataFrom({
    series: "A",
    issueDate: "2026-03-05",
    dueDate: "",
    clientName: "Tecnologías Nova S.A.",
    clientTaxId: "A58818501",
    clientAddress: "Avenida Diagonal 400\n08008 Barcelona",
    clientEmail: "",
    irpfRate: "15",
    notes: "",
    "lines.0.description": "Consultoría",
    "lines.0.quantity": "10",
    "lines.0.unitPrice": "60",
    "lines.0.vatRate": "21",
    "lines.0.discountPct": "0",
    "lines.1.description": "Material impreso",
    "lines.1.quantity": "100",
    "lines.1.unitPrice": "2",
    "lines.1.vatRate": "4",
    "lines.1.discountPct": "0",
    ...overrides,
  });
}

function formRequest(url: string, formData: FormData, method = "POST"): NextRequest {
  return new NextRequest(url, { method, body: formData });
}

/**
 * Un cuerpo que no es `multipart/form-data` ni `application/x-www-form-urlencoded`:
 * `request.formData()` lanza un `TypeError` al parsearlo, que las rutas deben
 * convertir en un 400 con forma conocida en vez de dejarlo escapar como un
 * 500 sin forma.
 */
function malformedBodyRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ foo: "bar" }),
  });
}

function paramsOf(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** Crea un borrador vía `POST /api/invoices` y devuelve su id. */
async function createDraft(overrides: Record<string, string> = {}): Promise<string> {
  const response = await invoicesRoute.POST(
    formRequest("http://localhost/api/invoices", invoiceForm(overrides)),
  );
  const body = (await response.json()) as { id: string };
  return body.id;
}

/** Crea un borrador, lo emite y devuelve su id. */
async function createAndIssue(overrides: Record<string, string> = {}): Promise<string> {
  const id = await createDraft(overrides);
  await issueRoute.POST(
    formRequest(`http://localhost/api/invoices/${id}/issue`, new FormData()),
    paramsOf(id),
  );
  return id;
}

beforeAll(async () => {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  rmSync(dbPath, { force: true });

  // Levantamos el esquema aplicando las mismas migraciones que usa la app, en
  // orden: el nombre lleva la marca de tiempo delante, así que basta ordenar.
  const migrationsDir = path.join(root, "prisma", "migrations");
  const migrations = readdirSync(migrationsDir)
    .filter((entry) => /^\d+_/.test(entry))
    .sort();
  if (migrations.length === 0) throw new Error("No se encontró ninguna migración");

  const database = new Database(dbPath);
  for (const migration of migrations) {
    database.exec(readFileSync(path.join(migrationsDir, migration, "migration.sql"), "utf8"));
  }
  database.close();

  // lib/db.ts lee DATABASE_URL al importarse, así que se fija antes.
  process.env.DATABASE_URL = `file:${dbPath}`;

  invoicesRoute = await import("@/app/api/invoices/route");
  invoiceRoute = await import("@/app/api/invoices/[id]/route");
  issueRoute = await import("@/app/api/invoices/[id]/issue/route");
  statusRoute = await import("@/app/api/invoices/[id]/status/route");
  ({ prisma } = await import("@/lib/db"));
});

beforeEach(async () => {
  cookieJar.clear();
  await prisma.invoice.deleteMany();
  await prisma.settings.upsert({
    where: { id: 1 },
    update: SETTINGS,
    create: SETTINGS,
  });
});

describe("GET /api/invoices", () => {
  it("lista las facturas", async () => {
    await createDraft();

    const response = await invoicesRoute.GET(new NextRequest("http://localhost/api/invoices"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: unknown[]; total: number };
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("pagina con offset/limit reales", async () => {
    for (let i = 0; i < 15; i++) await createDraft();

    const page1 = await invoicesRoute.GET(new NextRequest("http://localhost/api/invoices?page=1"));
    const body1 = (await page1.json()) as { items: unknown[]; page: number; totalPages: number };
    expect(body1.items).toHaveLength(10);
    expect(body1.page).toBe(1);
    expect(body1.totalPages).toBe(2);

    const page2 = await invoicesRoute.GET(new NextRequest("http://localhost/api/invoices?page=2"));
    const body2 = (await page2.json()) as { items: unknown[]; page: number };
    expect(body2.items).toHaveLength(5);
    expect(body2.page).toBe(2);
  });

  it("busca por cliente, sin distinguir mayúsculas", async () => {
    await createDraft({ clientName: "Ferretería Bermejo S.L." });
    await createDraft({ clientName: "Óptica Villanueva" });

    const response = await invoicesRoute.GET(
      new NextRequest(`http://localhost/api/invoices?q=${encodeURIComponent("bermejo")}`),
    );
    const body = (await response.json()) as { items: { clientName: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].clientName).toBe("Ferretería Bermejo S.L.");

    const caseInsensitive = await invoicesRoute.GET(
      new NextRequest(`http://localhost/api/invoices?q=${encodeURIComponent("VILLANUEVA")}`),
    );
    const bodyCi = (await caseInsensitive.json()) as { items: unknown[] };
    expect(bodyCi.items).toHaveLength(1);
  });

  it("busca por el texto de una línea", async () => {
    await createDraft({ "lines.0.description": "Diseño de logotipo" });
    await createDraft(); // usa "Consultoría" / "Material impreso" por defecto

    const response = await invoicesRoute.GET(
      new NextRequest(`http://localhost/api/invoices?q=${encodeURIComponent("logotipo")}`),
    );
    const body = (await response.json()) as { items: unknown[]; total: number };
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("escapa los comodines de LIKE en la búsqueda", async () => {
    await createDraft({ clientName: "Descuentos 10% S.L." });
    await createDraft({ clientName: "Otro cliente cualquiera" });

    const response = await invoicesRoute.GET(
      new NextRequest(`http://localhost/api/invoices?q=${encodeURIComponent("10%")}`),
    );
    const body = (await response.json()) as { items: { clientName: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].clientName).toBe("Descuentos 10% S.L.");
  });

  it("no se encuentra nada con una búsqueda sin coincidencias", async () => {
    await createDraft();

    const response = await invoicesRoute.GET(
      new NextRequest(`http://localhost/api/invoices?q=${encodeURIComponent("no existe esto")}`),
    );
    const body = (await response.json()) as { items: unknown[]; total: number; totalPages: number };
    expect(body.items).toHaveLength(0);
    expect(body.total).toBe(0);
    expect(body.totalPages).toBe(1);
  });
});

describe("POST /api/invoices", () => {
  it("crea el borrador y responde 201 con el id", async () => {
    const response = await invoicesRoute.POST(
      formRequest("http://localhost/api/invoices", invoiceForm()),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string };
    expect(typeof body.id).toBe("string");
    expect(await prisma.invoice.count()).toBe(1);
  });

  it("anuncia el borrador recién creado, todavía sin número", async () => {
    await createDraft();

    expect(lastFlash()).toMatchObject({
      tone: "exito",
      message: "Borrador creado. Todavía no gasta correlativo.",
      serial: undefined,
    });
  });

  it("responde 400 con errores por campo si la factura no es válida", async () => {
    const response = await invoicesRoute.POST(
      formRequest(
        "http://localhost/api/invoices",
        invoiceForm({ clientTaxId: "B12345675", "lines.0.quantity": "0" }),
      ),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { errors: Record<string, string> };
    expect(body.errors.clientTaxId).toMatch(/no válido/);
    expect(body.errors["lines.0.quantity"]).toMatch(/mayor que 0/);
    expect(await prisma.invoice.count()).toBe(0);
  });

  it("responde 400 si no se ha configurado el emisor", async () => {
    await prisma.settings.deleteMany();

    const response = await invoicesRoute.POST(
      formRequest("http://localhost/api/invoices", invoiceForm()),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { message?: string };
    expect(body.message).toMatch(/Ajustes/);
    expect(await prisma.invoice.count()).toBe(0);
  });

  it("responde 400 con forma conocida si el cuerpo no es FormData, en vez de un 500 sin forma", async () => {
    const response = await invoicesRoute.POST(
      malformedBodyRequest("http://localhost/api/invoices"),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { message?: string };
    expect(body.message).toMatch(/no válido/);
  });
});

describe("GET /api/invoices/[id]", () => {
  it("devuelve la factura", async () => {
    const id = await createDraft();

    const response = await invoiceRoute.GET(
      new NextRequest(`http://localhost/api/invoices/${id}`),
      paramsOf(id),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string };
    expect(body.id).toBe(id);
  });

  it("responde 404 si no existe", async () => {
    const response = await invoiceRoute.GET(
      new NextRequest("http://localhost/api/invoices/no-existe"),
      paramsOf("no-existe"),
    );

    expect(response.status).toBe(404);
  });
});

describe("POST /api/invoices/[id] (editar)", () => {
  it("reemplaza las líneas y recalcula los totales sin cambiar la numeración", async () => {
    const id = await createAndIssue();
    const before = await prisma.invoice.findUniqueOrThrow({ where: { id } });

    const response = await invoiceRoute.POST(
      formRequest(
        `http://localhost/api/invoices/${id}`,
        formDataFrom({
          series: "A",
          issueDate: "2026-03-05",
          dueDate: "",
          clientName: "Tecnologías Nova S.A.",
          clientTaxId: "A58818501",
          clientAddress: "Avenida Diagonal 400\n08008 Barcelona",
          clientEmail: "",
          irpfRate: "0",
          notes: "",
          "lines.0.description": "Una sola línea",
          "lines.0.quantity": "1",
          "lines.0.unitPrice": "100",
          "lines.0.vatRate": "21",
          "lines.0.discountPct": "0",
        }),
      ),
      paramsOf(id),
    );

    expect(response.status).toBe(200);

    const after = await prisma.invoice.findUniqueOrThrow({
      where: { id },
      include: { lines: true },
    });
    expect(after.lines).toHaveLength(1);
    expect(Number(after.total)).toBe(121);
    expect(after.number).toBe(before.number);
  });

  it("anuncia los cambios guardados, con el número si ya lo tenía", async () => {
    const id = await createAndIssue();

    await invoiceRoute.POST(
      formRequest(`http://localhost/api/invoices/${id}`, invoiceForm()),
      paramsOf(id),
    );

    expect(lastFlash()).toMatchObject({
      tone: "exito",
      message: "Cambios guardados.",
      serial: "A-2026-0001",
    });
  });

  it("responde 400 con errores por campo si la factura no es válida", async () => {
    const id = await createDraft();

    const response = await invoiceRoute.POST(
      formRequest(
        `http://localhost/api/invoices/${id}`,
        invoiceForm({ "lines.0.quantity": "0" }),
      ),
      paramsOf(id),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { errors: Record<string, string> };
    expect(body.errors["lines.0.quantity"]).toMatch(/mayor que 0/);
  });

  it("responde 404 si la factura ya no existe", async () => {
    const response = await invoiceRoute.POST(
      formRequest("http://localhost/api/invoices/no-existe", invoiceForm()),
      paramsOf("no-existe"),
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as { message?: string };
    expect(body.message).toMatch(/ya no existe/);
  });

  it("responde 400 con forma conocida si el cuerpo no es FormData, en vez de un 500 sin forma", async () => {
    const id = await createDraft();

    const response = await invoiceRoute.POST(
      malformedBodyRequest(`http://localhost/api/invoices/${id}`),
      paramsOf(id),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { message?: string };
    expect(body.message).toMatch(/no válido/);
  });
});

describe("DELETE /api/invoices/[id]", () => {
  it("borra la factura y arrastra sus líneas", async () => {
    const id = await createAndIssue();

    const response = await invoiceRoute.DELETE(
      new NextRequest(`http://localhost/api/invoices/${id}`, { method: "DELETE" }),
      paramsOf(id),
    );

    expect(response.status).toBe(200);
    expect(await prisma.invoice.count()).toBe(0);
    expect(await prisma.invoiceLine.count()).toBe(0);
  });

  it("anota la baja con el tono de aviso y el número borrado", async () => {
    const id = await createAndIssue();

    await invoiceRoute.DELETE(
      new NextRequest(`http://localhost/api/invoices/${id}`, { method: "DELETE" }),
      paramsOf(id),
    );

    expect(lastFlash()).toMatchObject({
      tone: "aviso",
      message: "Factura eliminada.",
      serial: "A-2026-0001",
    });
  });

  it("distingue el borrador eliminado, que no tenía número", async () => {
    const id = await createDraft();

    await invoiceRoute.DELETE(
      new NextRequest(`http://localhost/api/invoices/${id}`, { method: "DELETE" }),
      paramsOf(id),
    );

    expect(lastFlash()).toMatchObject({
      tone: "aviso",
      message: "Borrador eliminado.",
      serial: undefined,
    });
  });

  it("responde 404 si la factura ya no existe", async () => {
    const response = await invoiceRoute.DELETE(
      new NextRequest("http://localhost/api/invoices/no-existe", { method: "DELETE" }),
      paramsOf("no-existe"),
    );

    expect(response.status).toBe(404);
  });
});

describe("POST /api/invoices/[id]/issue", () => {
  it("asigna el correlativo y anuncia la emisión", async () => {
    const id = await createDraft();

    const response = await issueRoute.POST(
      formRequest(`http://localhost/api/invoices/${id}/issue`, new FormData()),
      paramsOf(id),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { issued: { number: number } | null };
    expect(body.issued).toEqual({ series: "A", year: 2026, number: 1 });

    expect(lastFlash()).toMatchObject({
      tone: "exito",
      message: "Factura emitida.",
      serial: "A-2026-0001",
    });
  });

  it("no anuncia nada al reemitir una factura que ya tiene número", async () => {
    const id = await createAndIssue();
    cookieJar.clear();

    const response = await issueRoute.POST(
      formRequest(`http://localhost/api/invoices/${id}/issue`, new FormData()),
      paramsOf(id),
    );

    const body = (await response.json()) as { issued: null };
    expect(body.issued).toBeNull();
    expect(lastFlash()).toBeNull();
  });
});

describe("POST /api/invoices/[id]/status", () => {
  it("nombra el nuevo estado igual que el desplegable", async () => {
    const id = await createAndIssue();

    const response = await statusRoute.POST(
      formRequest(
        `http://localhost/api/invoices/${id}/status`,
        formDataFrom({ status: "PAGADA" }),
      ),
      paramsOf(id),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { applied: boolean };
    expect(body.applied).toBe(true);

    expect(lastFlash()).toMatchObject({
      message: "Estado actualizado a Pagada.",
      serial: "A-2026-0001",
    });
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id } })).status).toBe("PAGADA");
  });

  it("no admite volver a BORRADOR: el número ya está gastado", async () => {
    const id = await createAndIssue();

    const response = await statusRoute.POST(
      formRequest(
        `http://localhost/api/invoices/${id}/status`,
        formDataFrom({ status: "BORRADOR" }),
      ),
      paramsOf(id),
    );

    const body = (await response.json()) as { applied: boolean };
    expect(body.applied).toBe(false);

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    expect(invoice.status).toBe("EMITIDA");
    expect(invoice.number).toBe(1);
  });

  it("ignora estados que no existen", async () => {
    const id = await createAndIssue();

    const response = await statusRoute.POST(
      formRequest(
        `http://localhost/api/invoices/${id}/status`,
        formDataFrom({ status: "ANULADA" }),
      ),
      paramsOf(id),
    );

    const body = (await response.json()) as { applied: boolean };
    expect(body.applied).toBe(false);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id } })).status).toBe("EMITIDA");
  });

  it("no cambia el estado de un borrador sin emitir", async () => {
    const id = await createDraft();

    await statusRoute.POST(
      formRequest(
        `http://localhost/api/invoices/${id}/status`,
        formDataFrom({ status: "PAGADA" }),
      ),
      paramsOf(id),
    );

    expect((await prisma.invoice.findUniqueOrThrow({ where: { id } })).status).toBe("BORRADOR");
  });

  it("responde 400 con forma conocida si el cuerpo no es FormData, en vez de un 500 sin forma", async () => {
    const id = await createAndIssue();

    const response = await statusRoute.POST(
      malformedBodyRequest(`http://localhost/api/invoices/${id}/status`),
      paramsOf(id),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { message?: string };
    expect(body.message).toMatch(/no válido/);
  });
});

describe("avisos de la operación", () => {
  it("da un id distinto a cada aviso, para que el banner vuelva a aparecer", async () => {
    await createDraft();
    const primero = lastFlash();
    await createDraft();

    expect(lastFlash()!.id).not.toBe(primero!.id);
  });
});
