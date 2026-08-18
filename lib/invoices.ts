import "server-only";
import { prisma } from "@/lib/db";
import { isInvoiceStatus, type InvoiceStatus } from "@/lib/invoice-status";

/**
 * Acceso a datos de facturas.
 *
 * Prisma devuelve los campos `Decimal` como objetos `Prisma.Decimal`, que no
 * cruzan la frontera hacia los Client Components. Aquí los convertimos a
 * `number` planos (ya redondeados a 2 decimales al guardarse) para que las
 * páginas y el formulario trabajen siempre con datos serializables.
 */

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

export type SettingsDTO = {
  issuerName: string;
  issuerTaxId: string;
  issuerAddress: string;
  defaultSeries: string;
  defaultVatRate: number;
};

/** Ajustes usados cuando aún no se ha configurado el emisor. */
export const DEFAULT_SETTINGS: SettingsDTO = {
  issuerName: "",
  issuerTaxId: "",
  issuerAddress: "",
  defaultSeries: "A",
  defaultVatRate: 21,
};

// `Decimal` de Prisma expone toNumber(); aceptamos también number por si el
// driver ya lo entrega convertido.
type DecimalLike = { toNumber(): number } | number;

function num(value: DecimalLike): number {
  return typeof value === "number" ? value : value.toNumber();
}

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
 * El correlativo que le tocaría a la siguiente factura de esa serie y año.
 *
 * Es informativo, para poder enseñarlo antes de emitir: el número de verdad lo
 * asigna `issueInvoice` dentro de una transacción.
 */
export async function nextInvoiceNumber(series: string, year: number): Promise<number> {
  const last = await prisma.invoice.findFirst({
    where: { series, year, number: { not: null } },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  return (last?.number ?? 0) + 1;
}

export async function getSettings(): Promise<SettingsDTO> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings) return DEFAULT_SETTINGS;

  return {
    issuerName: settings.issuerName,
    issuerTaxId: settings.issuerTaxId,
    issuerAddress: settings.issuerAddress,
    defaultSeries: settings.defaultSeries,
    defaultVatRate: num(settings.defaultVatRate),
  };
}
