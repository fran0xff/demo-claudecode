import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FLASH_COOKIE, parseFlash } from "@/lib/flash";

/**
 * Tests de integración de las Server Actions contra una base de datos SQLite
 * temporal: recorren el camino completo (FormData -> validación -> numeración
 * -> persistencia), que es donde se juntan todas las piezas.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const dbPath = path.join(root, "tests", ".tmp", "actions.db");

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/**
 * Las acciones dejan el aviso de la operación en una cookie antes de redirigir.
 * Aquí basta con un almacén en memoria: `vi.hoisted` porque la fábrica de
 * `vi.mock` se eleva por encima de las declaraciones del módulo.
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

/** `redirect` corta la ejecución lanzando; aquí lo imitamos y guardamos el destino. */
class RedirectError extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT:${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

type Actions = typeof import("@/app/invoices/actions");
type Db = typeof import("@/lib/db");

let actions: Actions;
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

/** Ejecuta una acción que redirige y devuelve el destino. */
async function runExpectingRedirect(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    if (error instanceof RedirectError) return error.url;
    throw error;
  }
  throw new Error("Se esperaba una redirección y no se produjo");
}

/** Crea un borrador y devuelve su id. */
async function createDraft(overrides: Record<string, string> = {}): Promise<string> {
  const url = await runExpectingRedirect(() =>
    actions.createInvoice({ errors: {} }, invoiceForm(overrides)),
  );
  return url.replace("/invoices/", "");
}

/** Crea un borrador, lo emite y devuelve su id. */
async function createAndIssue(overrides: Record<string, string> = {}): Promise<string> {
  const id = await createDraft(overrides);
  await actions.issueInvoice(formDataFrom({ id }));
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

  actions = await import("@/app/invoices/actions");
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

describe("createInvoice", () => {
  it("guarda la factura con los importes recalculados en el servidor", async () => {
    const url = await runExpectingRedirect(() =>
      actions.createInvoice({ errors: {} }, invoiceForm()),
    );

    const id = url.replace("/invoices/", "");
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id },
      include: { lines: { orderBy: { position: "asc" } } },
    });

    // 600 al 21 % + 200 al 4 % = base 800, IVA 126 + 8, IRPF 15 % de 800.
    expect(Number(invoice.subtotal)).toBe(800);
    expect(Number(invoice.taxTotal)).toBe(134);
    expect(Number(invoice.irpfTotal)).toBe(120);
    expect(Number(invoice.total)).toBe(814);
    expect(invoice.lines).toHaveLength(2);
    expect(Number(invoice.lines[0].lineTotal)).toBe(600);
    expect(Number(invoice.lines[1].lineTotal)).toBe(200);
  });

  it("copia los datos del emisor desde los ajustes", async () => {
    const url = await runExpectingRedirect(() =>
      actions.createInvoice({ errors: {} }, invoiceForm()),
    );

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: url.replace("/invoices/", "") },
    });

    expect(invoice.issuerName).toBe(SETTINGS.issuerName);
    expect(invoice.issuerTaxId).toBe(SETTINGS.issuerTaxId);
  });

  it("nace como borrador y sin número, para no gastar correlativo", async () => {
    const id = await createDraft();
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id } });

    expect(invoice.status).toBe("BORRADOR");
    expect(invoice.number).toBeNull();
  });

  it("deja crear varios borradores a la vez sin chocar entre ellos", async () => {
    await createDraft();
    await createDraft();

    const invoices = await prisma.invoice.findMany({ select: { number: true } });
    expect(invoices).toHaveLength(2);
    expect(invoices.every((invoice) => invoice.number === null)).toBe(true);
  });

  it("devuelve errores por campo y no guarda nada si la factura no es válida", async () => {
    const state = await actions.createInvoice(
      { errors: {} },
      invoiceForm({ clientTaxId: "B12345675", "lines.0.quantity": "0" }),
    );

    expect(state.errors.clientTaxId).toMatch(/no válido/);
    expect(state.errors["lines.0.quantity"]).toMatch(/mayor que 0/);
    expect(await prisma.invoice.count()).toBe(0);
  });

  it("no deja emitir facturas sin haber configurado el emisor", async () => {
    await prisma.settings.deleteMany();

    const state = await actions.createInvoice({ errors: {} }, invoiceForm());

    expect(state.message).toMatch(/Ajustes/);
    expect(await prisma.invoice.count()).toBe(0);
  });
});

describe("issueInvoice", () => {
  it("asigna el correlativo y pasa la factura a EMITIDA", async () => {
    const id = await createDraft();
    await actions.issueInvoice(formDataFrom({ id }));

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    expect(invoice.number).toBe(1);
    expect(invoice.status).toBe("EMITIDA");
  });

  it("asigna correlativos consecutivos dentro de la misma serie y año", async () => {
    await createAndIssue();
    await createAndIssue();

    const numbers = await prisma.invoice.findMany({
      orderBy: { number: "asc" },
      select: { number: true, year: true, series: true },
    });

    expect(numbers.map((invoice) => invoice.number)).toEqual([1, 2]);
    expect(numbers.every((invoice) => invoice.series === "A" && invoice.year === 2026)).toBe(true);
  });

  it("reinicia la numeración en cada año", async () => {
    await createAndIssue();
    const id = await createAndIssue({ issueDate: "2027-01-09" });

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    expect(invoice.year).toBe(2027);
    expect(invoice.number).toBe(1);
  });

  it("numera cada serie por separado", async () => {
    await createAndIssue();
    const id = await createAndIssue({ series: "B" });

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    expect(invoice.series).toBe("B");
    expect(invoice.number).toBe(1);
  });

  it("no vuelve a numerar una factura ya emitida", async () => {
    const id = await createAndIssue();
    const before = await prisma.invoice.findUniqueOrThrow({ where: { id } });

    await actions.setInvoiceStatus(formDataFrom({ id, status: "PAGADA" }));
    await actions.issueInvoice(formDataFrom({ id }));

    const after = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    expect(after.number).toBe(before.number);
    // Y tampoco la devuelve a EMITIDA por el camino.
    expect(after.status).toBe("PAGADA");
  });

  it("los borradores no ocupan hueco en la serie", async () => {
    // Un borrador entre dos emitidas no debe dejar un salto en la numeración.
    const primera = await createAndIssue();
    await createDraft();
    const segunda = await createAndIssue();

    const numbers = await prisma.invoice.findMany({
      where: { id: { in: [primera, segunda] } },
      orderBy: { number: "asc" },
      select: { number: true },
    });

    expect(numbers.map((invoice) => invoice.number)).toEqual([1, 2]);
  });
});

describe("setInvoiceStatus", () => {
  it("mueve la factura entre los estados de una emitida", async () => {
    const id = await createAndIssue();

    await actions.setInvoiceStatus(formDataFrom({ id, status: "ENVIADA" }));
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id } })).status).toBe("ENVIADA");

    await actions.setInvoiceStatus(formDataFrom({ id, status: "PAGADA" }));
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id } })).status).toBe("PAGADA");
  });

  it("no admite volver a BORRADOR: el número ya está gastado", async () => {
    const id = await createAndIssue();

    await actions.setInvoiceStatus(formDataFrom({ id, status: "BORRADOR" }));

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    expect(invoice.status).toBe("EMITIDA");
    expect(invoice.number).toBe(1);
  });

  it("ignora estados que no existen", async () => {
    const id = await createAndIssue();

    await actions.setInvoiceStatus(formDataFrom({ id, status: "ANULADA" }));

    expect((await prisma.invoice.findUniqueOrThrow({ where: { id } })).status).toBe("EMITIDA");
  });

  it("no cambia el estado de un borrador sin emitir", async () => {
    const id = await createDraft();

    await actions.setInvoiceStatus(formDataFrom({ id, status: "PAGADA" }));

    expect((await prisma.invoice.findUniqueOrThrow({ where: { id } })).status).toBe("BORRADOR");
  });
});

describe("updateInvoice", () => {
  it("reemplaza las líneas y recalcula los totales sin cambiar la numeración", async () => {
    const id = await createAndIssue();
    const before = await prisma.invoice.findUniqueOrThrow({ where: { id } });

    await runExpectingRedirect(() =>
      actions.updateInvoice(
        id,
        { errors: {} },
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
    );

    const after = await prisma.invoice.findUniqueOrThrow({
      where: { id },
      include: { lines: true },
    });

    expect(after.lines).toHaveLength(1);
    expect(Number(after.subtotal)).toBe(100);
    expect(Number(after.taxTotal)).toBe(21);
    expect(Number(after.irpfTotal)).toBe(0);
    expect(Number(after.total)).toBe(121);
    // La numeración de una factura emitida no se toca.
    expect(after.number).toBe(before.number);
    expect(after.series).toBe(before.series);
    expect(after.year).toBe(before.year);
  });

  it("a un borrador sí le cambia la serie y el año, que aún no están fijados", async () => {
    const id = await createDraft();

    await runExpectingRedirect(() =>
      actions.updateInvoice(
        id,
        { errors: {} },
        invoiceForm({ series: "B", issueDate: "2027-04-10" }),
      ),
    );

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    expect(invoice.series).toBe("B");
    expect(invoice.year).toBe(2027);
    expect(invoice.number).toBeNull();
  });

  it("a una factura emitida no le cambia la serie ni el año", async () => {
    const id = await createAndIssue();

    await runExpectingRedirect(() =>
      actions.updateInvoice(
        id,
        { errors: {} },
        invoiceForm({ series: "B", issueDate: "2027-04-10" }),
      ),
    );

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    expect(invoice.series).toBe("A");
    expect(invoice.year).toBe(2026);
    expect(invoice.number).toBe(1);
  });

  it("no deja huérfanas las líneas anteriores", async () => {
    const id = await createDraft();

    await runExpectingRedirect(() =>
      actions.updateInvoice(
        id,
        { errors: {} },
        invoiceForm({
          "lines.1.description": "",
          "lines.1.quantity": "",
          "lines.1.unitPrice": "",
          "lines.1.vatRate": "",
          "lines.1.discountPct": "",
        }),
      ),
    ).catch(() => undefined);

    // Sea cual sea el resultado, no puede quedar ninguna línea sin factura.
    const totalLines = await prisma.invoiceLine.count();
    const linesOfInvoice = await prisma.invoiceLine.count({ where: { invoiceId: id } });
    expect(totalLines).toBe(linesOfInvoice);
  });

  it("informa si la factura ya no existe", async () => {
    const state = await actions.updateInvoice("no-existe", { errors: {} }, invoiceForm());
    expect(state.message).toMatch(/ya no existe/);
  });
});

describe("deleteInvoice", () => {
  it("borra la factura y arrastra sus líneas", async () => {
    const id = await createAndIssue();

    const url = await runExpectingRedirect(() =>
      actions.deleteInvoice(formDataFrom({ id })),
    );

    expect(url).toBe("/invoices");
    expect(await prisma.invoice.count()).toBe(0);
    expect(await prisma.invoiceLine.count()).toBe(0);
  });
});

describe("avisos de la operación", () => {
  it("anuncia el borrador recién creado, todavía sin número", async () => {
    await createDraft();

    expect(lastFlash()).toMatchObject({
      tone: "exito",
      message: "Borrador creado. Todavía no gasta correlativo.",
      serial: undefined,
    });
  });

  it("anuncia la emisión con el número que se acaba de gastar", async () => {
    const id = await createDraft();
    await actions.issueInvoice(formDataFrom({ id }));

    expect(lastFlash()).toMatchObject({
      tone: "exito",
      message: "Factura emitida.",
      serial: "A-2026-0001",
    });
  });

  it("no anuncia nada al reemitir una factura que ya tiene número", async () => {
    const id = await createAndIssue();
    cookieJar.clear();

    await actions.issueInvoice(formDataFrom({ id }));

    expect(lastFlash()).toBeNull();
  });

  it("nombra el nuevo estado igual que el desplegable", async () => {
    const id = await createAndIssue();

    await actions.setInvoiceStatus(formDataFrom({ id, status: "PAGADA" }));

    expect(lastFlash()).toMatchObject({
      message: "Estado actualizado a Pagada.",
      serial: "A-2026-0001",
    });
  });

  it("anota la baja con el tono de aviso y el número borrado", async () => {
    const id = await createAndIssue();

    await runExpectingRedirect(() => actions.deleteInvoice(formDataFrom({ id })));

    expect(lastFlash()).toMatchObject({
      tone: "aviso",
      message: "Factura eliminada.",
      serial: "A-2026-0001",
    });
  });

  it("distingue el borrador eliminado, que no tenía número", async () => {
    const id = await createDraft();

    await runExpectingRedirect(() => actions.deleteInvoice(formDataFrom({ id })));

    expect(lastFlash()).toMatchObject({
      tone: "aviso",
      message: "Borrador eliminado.",
      serial: undefined,
    });
  });

  it("da un id distinto a cada aviso, para que el banner vuelva a aparecer", async () => {
    await createDraft();
    const primero = lastFlash();
    await createDraft();

    expect(lastFlash()!.id).not.toBe(primero!.id);
  });
});
