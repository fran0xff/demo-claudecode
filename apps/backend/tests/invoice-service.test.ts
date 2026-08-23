import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  NotFoundError,
  SettingsNotConfiguredError,
  ValidationError,
} from "@/lib/services/errors";

/**
 * Tests de la capa de servicio contra una base de datos SQLite temporal:
 * recorren el camino completo (FormData -> validación -> numeración ->
 * persistencia) sin pasar por HTTP, que es donde vive la lógica de negocio.
 *
 * El servicio nunca toca `setFlash`/`cookies()`, así que a diferencia del
 * antiguo test de Server Actions aquí no hace falta mockear `next/headers`,
 * `next/cache` ni `next/navigation`.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const dbPath = path.join(root, "tests", ".tmp", "service.db");

type Service = typeof import("@/lib/services/invoice-service");
type Db = typeof import("@/lib/db");

let service: Service;
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

/** Crea un borrador y devuelve su id. */
async function createDraft(overrides: Record<string, string> = {}): Promise<string> {
  const { id } = await service.createInvoice(invoiceForm(overrides));
  return id;
}

/** Crea un borrador, lo emite y devuelve su id. */
async function createAndIssue(overrides: Record<string, string> = {}): Promise<string> {
  const id = await createDraft(overrides);
  await service.issueInvoice(id);
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

  service = await import("@/lib/services/invoice-service");
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
    const { id } = await service.createInvoice(invoiceForm());
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
    const { id } = await service.createInvoice(invoiceForm());
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id } });

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

  it("lanza ValidationError con errores por campo y no guarda nada", async () => {
    const form = invoiceForm({ clientTaxId: "B12345675", "lines.0.quantity": "0" });

    await expect(service.createInvoice(form)).rejects.toBeInstanceOf(ValidationError);

    try {
      await service.createInvoice(form);
      throw new Error("Se esperaba que createInvoice lanzase ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validationError = error as ValidationError;
      expect(validationError.errors.clientTaxId).toMatch(/no válido/);
      expect(validationError.errors["lines.0.quantity"]).toMatch(/mayor que 0/);
    }

    expect(await prisma.invoice.count()).toBe(0);
  });

  it("lanza SettingsNotConfiguredError si no hay emisor configurado", async () => {
    await prisma.settings.deleteMany();

    await expect(service.createInvoice(invoiceForm())).rejects.toBeInstanceOf(
      SettingsNotConfiguredError,
    );
    expect(await prisma.invoice.count()).toBe(0);
  });
});

describe("issueInvoice", () => {
  it("asigna el correlativo y pasa la factura a EMITIDA", async () => {
    const id = await createDraft();
    const { issued } = await service.issueInvoice(id);

    expect(issued).toEqual({ series: "A", year: 2026, number: 1 });

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

  it("no vuelve a numerar una factura ya emitida (no-op)", async () => {
    const id = await createAndIssue();
    const before = await prisma.invoice.findUniqueOrThrow({ where: { id } });

    await service.setInvoiceStatus(id, "PAGADA");
    const { issued } = await service.issueInvoice(id);

    expect(issued).toBeNull();

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

    await service.setInvoiceStatus(id, "ENVIADA");
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id } })).status).toBe("ENVIADA");

    await service.setInvoiceStatus(id, "PAGADA");
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id } })).status).toBe("PAGADA");
  });

  it("devuelve el estado aplicado y el número de serie, para componer el aviso", async () => {
    const id = await createAndIssue();
    const result = await service.setInvoiceStatus(id, "PAGADA");

    expect(result).toEqual({ status: "PAGADA", serial: "A-2026-0001" });
  });

  it("no admite volver a BORRADOR: el número ya está gastado (no-op)", async () => {
    const id = await createAndIssue();

    const result = await service.setInvoiceStatus(id, "BORRADOR");

    expect(result).toBeNull();
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    expect(invoice.status).toBe("EMITIDA");
    expect(invoice.number).toBe(1);
  });

  it("ignora estados que no existen (no-op)", async () => {
    const id = await createAndIssue();

    const result = await service.setInvoiceStatus(id, "ANULADA");

    expect(result).toBeNull();
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id } })).status).toBe("EMITIDA");
  });

  it("no cambia el estado de un borrador sin emitir (no-op)", async () => {
    const id = await createDraft();

    const result = await service.setInvoiceStatus(id, "PAGADA");

    expect(result).toBeNull();
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id } })).status).toBe("BORRADOR");
  });
});

describe("updateInvoice", () => {
  it("reemplaza las líneas y recalcula los totales sin cambiar la numeración", async () => {
    const id = await createAndIssue();
    const before = await prisma.invoice.findUniqueOrThrow({ where: { id } });

    await service.updateInvoice(
      id,
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

    await service.updateInvoice(id, invoiceForm({ series: "B", issueDate: "2027-04-10" }));

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    expect(invoice.series).toBe("B");
    expect(invoice.year).toBe(2027);
    expect(invoice.number).toBeNull();
  });

  it("a una factura emitida no le cambia la serie ni el año", async () => {
    const id = await createAndIssue();

    await service.updateInvoice(id, invoiceForm({ series: "B", issueDate: "2027-04-10" }));

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    expect(invoice.series).toBe("A");
    expect(invoice.year).toBe(2026);
    expect(invoice.number).toBe(1);
  });

  it("no deja huérfanas las líneas anteriores", async () => {
    const id = await createDraft();

    await service
      .updateInvoice(
        id,
        invoiceForm({
          "lines.1.description": "",
          "lines.1.quantity": "",
          "lines.1.unitPrice": "",
          "lines.1.vatRate": "",
          "lines.1.discountPct": "",
        }),
      )
      .catch(() => undefined);

    // Sea cual sea el resultado, no puede quedar ninguna línea sin factura.
    const totalLines = await prisma.invoiceLine.count();
    const linesOfInvoice = await prisma.invoiceLine.count({ where: { invoiceId: id } });
    expect(totalLines).toBe(linesOfInvoice);
  });

  it("lanza NotFoundError si la factura ya no existe", async () => {
    await expect(service.updateInvoice("no-existe", invoiceForm())).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("deleteInvoice", () => {
  it("borra la factura y arrastra sus líneas", async () => {
    const id = await createAndIssue();

    const result = await service.deleteInvoice(id);

    expect(result).toEqual({ hadNumber: true, serial: "A-2026-0001" });
    expect(await prisma.invoice.count()).toBe(0);
    expect(await prisma.invoiceLine.count()).toBe(0);
  });

  it("distingue el borrador eliminado, que no tenía número", async () => {
    const id = await createDraft();

    const result = await service.deleteInvoice(id);

    expect(result).toEqual({ hadNumber: false, serial: undefined });
  });

  it("lanza NotFoundError si la factura ya no existe", async () => {
    await expect(service.deleteInvoice("no-existe")).rejects.toBeInstanceOf(NotFoundError);
  });
});
