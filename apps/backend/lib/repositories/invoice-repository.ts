import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { isInvoiceStatus, type InvoiceStatus } from "@/lib/invoice-status";
import { num } from "@/lib/repositories/decimal";

/**
 * Acceso a datos de facturas.
 *
 * Único fichero (junto a `settings-repository.ts`) que importa Prisma. Expone
 * funciones pequeñas y de una sola responsabilidad; la lógica de negocio (qué
 * transición de estado es válida, cuándo reintentar una colisión de número,
 * qué aviso mostrar...) vive en la capa de servicio, no aquí.
 *
 * Las funciones de escritura que participan en una transacción aceptan un
 * cliente Prisma opcional (`Db`, por defecto el cliente global) para que el
 * servicio pueda orquestarlas dentro de su propio `prisma.$transaction`,
 * incluido el reintento ante colisión de número al emitir.
 */

// Prisma devuelve los campos `Decimal` como objetos `Prisma.Decimal`, que no
// cruzan la frontera hacia los Client Components. Aquí los convertimos a
// `number` planos (ya redondeados a 2 decimales al guardarse) para que la
// capa de servicio trabaje siempre con datos serializables.

export type InvoiceLineDTO = {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountPct: number;
  lineTotal: number;
};

export type InvoiceDTO = {
  id: string;
  series: string;
  /** Null mientras es borrador: el número se asigna al emitir. */
  number: number | null;
  year: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  issuerName: string;
  issuerTaxId: string;
  issuerAddress: string;
  clientName: string;
  clientTaxId: string;
  clientAddress: string;
  clientEmail: string | null;
  irpfRate: number;
  notes: string | null;
  subtotal: number;
  taxTotal: number;
  irpfTotal: number;
  total: number;
  lines: InvoiceLineDTO[];
};

export type InvoiceSummary = Pick<
  InvoiceDTO,
  | "id"
  | "series"
  | "number"
  | "year"
  | "status"
  | "issueDate"
  | "dueDate"
  | "clientName"
  | "total"
  | "currency"
>;

/** Fila mínima usada al emitir: solo lo que hace falta para calcular el número. */
export type InvoiceForIssuing = { series: string; year: number; status: InvoiceStatus };

/** Fila mínima usada por los cambios de estado y la edición. */
export type InvoiceStatusRow = {
  status: InvoiceStatus;
  series: string;
  year: number;
  number: number | null;
};

/** Lo que queda de una factura tras borrarla: lo último que se sabe de su numeración. */
export type DeletedInvoiceRow = { series: string; year: number; number: number | null };

/** Una línea tal y como se persiste (importes ya calculados por el servicio). */
export type InvoiceLineWriteData = {
  position: number;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountPct: number;
  lineTotal: number;
};

/** Cabecera común a crear y actualizar: totales ya recalculados en servidor. */
export type InvoiceHeaderWriteData = {
  issueDate: Date;
  dueDate: Date | null;
  clientName: string;
  clientTaxId: string;
  clientAddress: string;
  clientEmail: string | null;
  irpfRate: number;
  notes: string | null;
  subtotal: number;
  taxTotal: number;
  irpfTotal: number;
  total: number;
};

export type CreateDraftInvoiceData = InvoiceHeaderWriteData & {
  series: string;
  year: number;
  issuerName: string;
  issuerTaxId: string;
  issuerAddress: string;
  lines: InvoiceLineWriteData[];
};

/** Cliente Prisma a través del que ejecutar la consulta: el global o un `tx`. */
type Db = typeof prisma | Prisma.TransactionClient;

type InvoiceRow = Awaited<ReturnType<typeof findInvoiceRow>>;

function findInvoiceRow(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: { lines: { orderBy: { position: "asc" } } },
  });
}

/** La columna es un String suelto; si trajera basura, la tratamos como borrador. */
function toStatus(value: string): InvoiceStatus {
  return isInvoiceStatus(value) ? value : "BORRADOR";
}

function toDTO(invoice: NonNullable<InvoiceRow>): InvoiceDTO {
  return {
    id: invoice.id,
    series: invoice.series,
    number: invoice.number,
    year: invoice.year,
    status: toStatus(invoice.status),
    issueDate: invoice.issueDate.toISOString(),
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
    currency: invoice.currency,
    issuerName: invoice.issuerName,
    issuerTaxId: invoice.issuerTaxId,
    issuerAddress: invoice.issuerAddress,
    clientName: invoice.clientName,
    clientTaxId: invoice.clientTaxId,
    clientAddress: invoice.clientAddress,
    clientEmail: invoice.clientEmail,
    irpfRate: num(invoice.irpfRate),
    notes: invoice.notes,
    subtotal: num(invoice.subtotal),
    taxTotal: num(invoice.taxTotal),
    irpfTotal: num(invoice.irpfTotal),
    total: num(invoice.total),
    lines: invoice.lines.map((line) => ({
      id: line.id,
      position: line.position,
      description: line.description,
      quantity: num(line.quantity),
      unitPrice: num(line.unitPrice),
      vatRate: num(line.vatRate),
      discountPct: num(line.discountPct),
      lineTotal: num(line.lineTotal),
    })),
  };
}

export async function getInvoice(id: string): Promise<InvoiceDTO | null> {
  const invoice = await findInvoiceRow(id);
  return invoice ? toDTO(invoice) : null;
}

export async function listInvoices(): Promise<InvoiceSummary[]> {
  const invoices = await prisma.invoice.findMany({
    orderBy: [{ year: "desc" }, { series: "asc" }, { number: "desc" }],
    select: {
      id: true,
      series: true,
      number: true,
      year: true,
      status: true,
      issueDate: true,
      dueDate: true,
      clientName: true,
      total: true,
      currency: true,
      createdAt: true,
    },
  });

  const summaries: InvoiceSummary[] = invoices.map((invoice) => ({
    id: invoice.id,
    series: invoice.series,
    number: invoice.number,
    year: invoice.year,
    status: toStatus(invoice.status),
    issueDate: invoice.issueDate.toISOString(),
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
    clientName: invoice.clientName,
    total: num(invoice.total),
    currency: invoice.currency,
  }));

  // Los borradores van arriba: son los que piden una decisión. Se ordenan
  // aparte porque no tienen número y SQLite los mandaría al final.
  const drafts = invoices
    .map((invoice, index) => ({ invoice, summary: summaries[index] }))
    .filter(({ summary }) => summary.status === "BORRADOR")
    .sort((a, b) => b.invoice.createdAt.getTime() - a.invoice.createdAt.getTime())
    .map(({ summary }) => summary);

  return [...drafts, ...summaries.filter((summary) => summary.status !== "BORRADOR")];
}

/**
 * Último correlativo asignado (no null) dentro de una serie y año.
 *
 * La usan tanto `nextInvoiceNumber` (informativa) como el servicio que emite
 * facturas (dentro de su transacción, pasando `tx` como `db`).
 */
export async function findLastInvoiceNumber(
  series: string,
  year: number,
  db: Db = prisma,
): Promise<number | null> {
  const last = await db.invoice.findFirst({
    where: { series, year, number: { not: null } },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  return last?.number ?? null;
}

/**
 * El correlativo que le tocaría a la siguiente factura de esa serie y año.
 *
 * Es informativo, para poder enseñarlo antes de emitir: el número de verdad lo
 * asigna el servicio de emisión dentro de una transacción.
 */
export async function nextInvoiceNumber(series: string, year: number): Promise<number> {
  const last = await findLastInvoiceNumber(series, year);
  return (last ?? 0) + 1;
}

/** Crea una factura como borrador: sin número, estado BORRADOR. */
export async function createDraftInvoice(data: CreateDraftInvoiceData): Promise<{ id: string }> {
  const { lines, ...header } = data;

  return prisma.invoice.create({
    data: {
      ...header,
      number: null,
      status: "BORRADOR",
      lines: { create: lines },
    },
    select: { id: true },
  });
}

/** Serie, año y estado de una factura, para decidir si se le puede asignar número. */
export async function findInvoiceForIssuing(
  id: string,
  db: Db = prisma,
): Promise<InvoiceForIssuing | null> {
  const invoice = await db.invoice.findUnique({
    where: { id },
    select: { series: true, year: true, status: true },
  });

  return invoice ? { series: invoice.series, year: invoice.year, status: toStatus(invoice.status) } : null;
}

/** Asigna el correlativo y pasa la factura a EMITIDA. */
export async function assignInvoiceNumber(id: string, number: number, db: Db = prisma): Promise<void> {
  await db.invoice.update({
    where: { id },
    data: { number, status: "EMITIDA" satisfies InvoiceStatus },
  });
}

/** Estado, serie, año y número actuales, para validar transiciones y componer avisos. */
export async function findInvoiceStatusRow(id: string): Promise<InvoiceStatusRow | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { status: true, series: true, year: true, number: true },
  });

  return invoice ? { ...invoice, status: toStatus(invoice.status) } : null;
}

/** Cambia el estado guardado de una factura, sin validar la transición. */
export async function updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  await prisma.invoice.update({ where: { id }, data: { status } });
}

/**
 * Sustituye las líneas y la cabecera de una factura en una transacción.
 *
 * `numbering` solo lleva `series`/`year` cuando el servicio decide que la
 * factura todavía puede cambiarlos (borrador); si no se pasa, no se tocan.
 */
export async function replaceInvoiceLinesAndHeader(
  id: string,
  header: InvoiceHeaderWriteData,
  lines: InvoiceLineWriteData[],
  numbering: { series: string; year: number } | Record<string, never> = {},
): Promise<void> {
  await prisma.$transaction([
    prisma.invoiceLine.deleteMany({ where: { invoiceId: id } }),
    prisma.invoice.update({
      where: { id },
      data: { ...header, ...numbering, lines: { create: lines } },
    }),
  ]);
}

/** Borra la factura (las líneas caen en cascada) y devuelve cómo se llamaba. */
export async function deleteInvoiceById(id: string): Promise<DeletedInvoiceRow> {
  const deleted = await prisma.invoice.delete({
    where: { id },
    select: { series: true, year: true, number: true },
  });

  return deleted;
}
