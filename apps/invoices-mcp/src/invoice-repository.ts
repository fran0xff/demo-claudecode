import type { Pool, QueryResultRow } from "pg";
import { ISSUED_STATUSES, type InvoiceStatus } from "@facturas/shared/invoice-status";
import type { InvoiceDTO, InvoiceLineDTO } from "@facturas/shared/dto";

/**
 * Consultas de solo lectura sobre facturas, directamente contra Postgres
 * (sin Prisma). Cada función recibe el cliente/pool como parámetro en vez
 * de importar `getPool()` directamente, para poder testear con un pool
 * falso (`{ query: vi.fn() }`) sin tocar una base de datos real.
 */

/** Subconjunto de pg.Pool que necesitamos: permite inyectar un pool falso en los tests. */
export type Queryable = Pick<Pool, "query">;

const PAID_STATUS: InvoiceStatus = "PAGADA";
/** Emitidas pero aún no cobradas: ISSUED_STATUSES menos PAGADA. */
const PENDING_STATUSES: InvoiceStatus[] = ISSUED_STATUSES.filter((status) => status !== PAID_STATUS);

/**
 * Escapa `%`, `_` y `\` antes de meter el texto en un ILIKE: son comodines
 * de SQL. Mismo criterio que
 * apps/backend/lib/repositories/invoice-repository.ts (duplicado a
 * propósito: es una utilidad de 3 líneas, no vale la pena acoplar este MCP
 * al backend para importarla).
 */
function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

// ---------------------------------------------------------------------------
// get_invoice_summary
// ---------------------------------------------------------------------------

export type InvoiceSummaryLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  /** Base imponible de la línea (cantidad × precio unitario, con descuento aplicado). */
  subtotal: number;
};

export type InvoiceSummaryResult = {
  invoiceId: string;
  clientName: string;
  lines: InvoiceSummaryLine[];
  total: number;
};

type InvoiceHeaderRow = { id: string; clientName: string; total: string };
type InvoiceLineRow = { description: string; quantity: string; unitPrice: string; lineTotal: string };

export async function getInvoiceSummary(
  db: Queryable,
  invoiceId: string,
): Promise<InvoiceSummaryResult | null> {
  const header = await db.query<InvoiceHeaderRow>(
    `SELECT "id", "clientName", "total" FROM "Invoice" WHERE "id" = $1`,
    [invoiceId],
  );
  const row = header.rows[0];
  if (!row) return null;

  const lines = await db.query<InvoiceLineRow>(
    `SELECT "description", "quantity", "unitPrice", "lineTotal"
     FROM "InvoiceLine"
     WHERE "invoiceId" = $1
     ORDER BY "position" ASC`,
    [invoiceId],
  );

  return {
    invoiceId: row.id,
    clientName: row.clientName,
    total: Number(row.total),
    lines: lines.rows.map((line) => ({
      description: line.description,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      subtotal: Number(line.lineTotal),
    })),
  };
}

// ---------------------------------------------------------------------------
// get_client_invoice
// ---------------------------------------------------------------------------

type InvoiceRow = QueryResultRow & {
  id: string;
  series: string;
  number: number | null;
  year: number;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date | null;
  currency: string;
  issuerName: string;
  issuerTaxId: string;
  issuerAddress: string;
  clientName: string;
  clientTaxId: string;
  clientAddress: string;
  clientEmail: string | null;
  irpfRate: string;
  notes: string | null;
  subtotal: string;
  taxTotal: string;
  irpfTotal: string;
  total: string;
};

type InvoiceLineFullRow = {
  id: string;
  invoiceId: string;
  position: number;
  description: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
  discountPct: string;
  lineTotal: string;
};

export async function findInvoicesByClientName(db: Queryable, clientName: string): Promise<InvoiceDTO[]> {
  const pattern = likePattern(clientName);
  const invoices = await db.query<InvoiceRow>(
    `SELECT "id", "series", "number", "year", "status",
            "issueDate", "dueDate", "currency",
            "issuerName", "issuerTaxId", "issuerAddress",
            "clientName", "clientTaxId", "clientAddress", "clientEmail",
            "irpfRate", "notes",
            "subtotal", "taxTotal", "irpfTotal", "total"
     FROM "Invoice"
     WHERE "clientName" ILIKE $1 ESCAPE '\\'
     ORDER BY "issueDate" DESC`,
    [pattern],
  );
  if (invoices.rows.length === 0) return [];

  const invoiceIds = invoices.rows.map((row) => row.id);
  const lines = await db.query<InvoiceLineFullRow>(
    `SELECT "id", "invoiceId", "position", "description",
            "quantity", "unitPrice", "vatRate", "discountPct", "lineTotal"
     FROM "InvoiceLine"
     WHERE "invoiceId" = ANY($1::text[])
     ORDER BY "invoiceId", "position" ASC`,
    [invoiceIds],
  );

  const linesByInvoice = new Map<string, InvoiceLineDTO[]>();
  for (const line of lines.rows) {
    const dto: InvoiceLineDTO = {
      id: line.id,
      position: line.position,
      description: line.description,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      vatRate: Number(line.vatRate),
      discountPct: Number(line.discountPct),
      lineTotal: Number(line.lineTotal),
    };
    const bucket = linesByInvoice.get(line.invoiceId) ?? [];
    bucket.push(dto);
    linesByInvoice.set(line.invoiceId, bucket);
  }

  return invoices.rows.map((row) => ({
    id: row.id,
    series: row.series,
    number: row.number,
    year: row.year,
    status: row.status,
    issueDate: row.issueDate.toISOString(),
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    currency: row.currency,
    issuerName: row.issuerName,
    issuerTaxId: row.issuerTaxId,
    issuerAddress: row.issuerAddress,
    clientName: row.clientName,
    clientTaxId: row.clientTaxId,
    clientAddress: row.clientAddress,
    clientEmail: row.clientEmail,
    irpfRate: Number(row.irpfRate),
    notes: row.notes,
    subtotal: Number(row.subtotal),
    taxTotal: Number(row.taxTotal),
    irpfTotal: Number(row.irpfTotal),
    total: Number(row.total),
    lines: linesByInvoice.get(row.id) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// get_summary_totals
// ---------------------------------------------------------------------------

export type SummaryTotals = {
  totalEmitidas: number;
  totalCobradas: number;
  totalPorCobrar: number;
};

type SummaryTotalsRow = { totalEmitidas: string; totalCobradas: string; totalPorCobrar: string };

export async function getSummaryTotals(db: Queryable): Promise<SummaryTotals> {
  const result = await db.query<SummaryTotalsRow>(
    `SELECT
       COALESCE(SUM("total") FILTER (WHERE "status" = ANY($1::text[])), 0) AS "totalEmitidas",
       COALESCE(SUM("total") FILTER (WHERE "status" = $2), 0)              AS "totalCobradas",
       COALESCE(SUM("total") FILTER (WHERE "status" = ANY($3::text[])), 0) AS "totalPorCobrar"
     FROM "Invoice"`,
    [ISSUED_STATUSES, PAID_STATUS, PENDING_STATUSES],
  );
  const row = result.rows[0];
  return {
    totalEmitidas: Number(row.totalEmitidas),
    totalCobradas: Number(row.totalCobradas),
    totalPorCobrar: Number(row.totalPorCobrar),
  };
}
