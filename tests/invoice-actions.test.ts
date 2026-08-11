import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests de integración de las Server Actions contra una base de datos SQLite
 * temporal: recorren el camino completo (FormData -> validación -> numeración
 * -> persistencia), que es donde se juntan todas las piezas.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const dbPath = path.join(root, "tests", ".tmp", "actions.db");

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

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

beforeAll(async () => {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  rmSync(dbPath, { force: true });

  // Levantamos el esquema aplicando la misma migración que usa la app.
  const migrationsDir = path.join(root, "prisma", "migrations");
  const migration = readdirSync(migrationsDir).find((entry) => /^\d+_/.test(entry));
  if (!migration) throw new Error("No se encontró la migración inicial");

  const sql = readFileSync(path.join(migrationsDir, migration, "migration.sql"), "utf8");
  const database = new Database(dbPath);
  database.exec(sql);
  database.close();

  // lib/db.ts lee DATABASE_URL al importarse, así que se fija antes.
  process.env.DATABASE_URL = `file:${dbPath}`;

  actions = await import("@/app/invoices/actions");
  ({ prisma } = await import("@/lib/db"));
});

beforeEach(async () => {
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

  it("asigna correlativos consecutivos dentro de la misma serie y año", async () => {
    await runExpectingRedirect(() => actions.createInvoice({ errors: {} }, invoiceForm()));
    await runExpectingRedirect(() => actions.createInvoice({ errors: {} }, invoiceForm()));

    const numbers = await prisma.invoice.findMany({
      orderBy: { number: "asc" },
      select: { number: true, year: true, series: true },
    });

    expect(numbers.map((invoice) => invoice.number)).toEqual([1, 2]);
    expect(numbers.every((invoice) => invoice.series === "A" && invoice.year === 2026)).toBe(true);
  });

  it("reinicia la numeración en cada año", async () => {
    await runExpectingRedirect(() => actions.createInvoice({ errors: {} }, invoiceForm()));
    const url = await runExpectingRedirect(() =>
      actions.createInvoice({ errors: {} }, invoiceForm({ issueDate: "2027-01-09" })),
    );

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: url.replace("/invoices/", "") },
    });

    expect(invoice.year).toBe(2027);
    expect(invoice.number).toBe(1);
  });

  it("numera cada serie por separado", async () => {
    await runExpectingRedirect(() => actions.createInvoice({ errors: {} }, invoiceForm()));
    const url = await runExpectingRedirect(() =>
      actions.createInvoice({ errors: {} }, invoiceForm({ series: "B" })),
    );

    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: url.replace("/invoices/", "") },
    });

    expect(invoice.series).toBe("B");
    expect(invoice.number).toBe(1);
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

describe("updateInvoice", () => {
  it("reemplaza las líneas y recalcula los totales sin cambiar la numeración", async () => {
    const created = await runExpectingRedirect(() =>
      actions.createInvoice({ errors: {} }, invoiceForm()),
    );
    const id = created.replace("/invoices/", "");
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

  it("no deja huérfanas las líneas anteriores", async () => {
    const created = await runExpectingRedirect(() =>
      actions.createInvoice({ errors: {} }, invoiceForm()),
    );
    const id = created.replace("/invoices/", "");

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
    const created = await runExpectingRedirect(() =>
      actions.createInvoice({ errors: {} }, invoiceForm()),
    );
    const id = created.replace("/invoices/", "");

    const url = await runExpectingRedirect(() =>
      actions.deleteInvoice(formDataFrom({ id })),
    );

    expect(url).toBe("/invoices");
    expect(await prisma.invoice.count()).toBe(0);
    expect(await prisma.invoiceLine.count()).toBe(0);
  });
});
