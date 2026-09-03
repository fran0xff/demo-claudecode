import "server-only";
import { isInvoiceStatus, type InvoiceStatus } from "@facturas/shared/invoice-status";
import type { InvoiceDTO, InvoiceLineDTO, InvoicePage, InvoiceSummary } from "@facturas/shared/dto";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
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

export type { InvoiceDTO, InvoiceLineDTO, InvoiceSummary };

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

/**
 * Fila cruda de la consulta paginada: mismos campos que `InvoiceSummary`, sin
 * pasar por Prisma. `total` llega como `string`, no `number`: `node-postgres`
 * (el driver detrás de `@prisma/adapter-pg`) devuelve las columnas `numeric`
 * como texto por defecto, para no perder precisión con valores que no caben
 * en un `float64` — aunque el valor guardado sea un entero exacto como
 * `5478`.
 */
type InvoiceListRow = {
  id: string;
  series: string;
  number: number | null;
  year: number;
  status: string;
  issueDate: string;
  dueDate: string | null;
  clientName: string;
  total: string;
  currency: string;
};

function toSummaryFromRow(row: InvoiceListRow): InvoiceSummary {
  return {
    id: row.id,
    series: row.series,
    number: row.number,
    year: row.year,
    status: toStatus(row.status),
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    clientName: row.clientName,
    total: Number(row.total),
    currency: row.currency,
  };
}

/** Filtros del listado, ya normalizados por el servicio (fechas `YYYY-MM-DD`, importes válidos, estados reales). */
export type InvoiceListFilters = {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  minTotal?: number;
  maxTotal?: number;
  statuses?: InvoiceStatus[];
};

/**
 * Escapa `%`, `_` y `\` antes de meter el texto en un `LIKE`: son comodines
 * de SQL, y sin escaparlos una búsqueda con, por ejemplo, un descuento
 * "10%" en el texto de una línea se comportaría como un patrón en vez de
 * como texto literal.
 */
function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * `dateFromInput` en `lib/validation.ts` guarda `issueDate` a medianoche
 * LOCAL, no UTC ("para que no se desplace un día"). Los límites del filtro
 * tienen que construirse con ese mismo criterio: comparar contra medianoche
 * UTC compararía la fecha guardada con un instante distinto en cualquier
 * huso horario que no sea UTC, y dejaría fuera facturas del día pedido (o
 * colaría alguna del día anterior/siguiente) según el desfase del servidor.
 * En Postgres `issueDate` es un `timestamp` real (no texto), así que no hace
 * falta la normalización con `julianday()` que exigía SQLite: comparar los
 * `Date` de JS directamente ya compara el mismo instante sin ambigüedad de
 * formato.
 */
function localMidnight(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00`);
}

/** "Hasta el día X inclusive" no es `<= X`: se compara con `<` contra la medianoche siguiente. */
function nextLocalMidnight(dateOnly: string): Date {
  const date = localMidnight(dateOnly);
  date.setDate(date.getDate() + 1);
  return date;
}

/**
 * Mismo filtro en dos formas: `where` tipado (para los `count` por
 * `prisma.invoice`, que sí soportan filtrar por una relación) y el
 * fragmento SQL equivalente (para el `SELECT` en crudo de abajo, que no
 * puede reutilizar un `where` de Prisma). Si se toca uno, hay que tocar el
 * otro o el recuento y la página dejarían de coincidir.
 */
function buildWhere(filters: InvoiceListFilters): Prisma.InvoiceWhereInput {
  const and: Prisma.InvoiceWhereInput[] = [];

  if (filters.search) {
    and.push({
      OR: [
        { clientName: { contains: filters.search } },
        { lines: { some: { description: { contains: filters.search } } } },
      ],
    });
  }
  if (filters.dateFrom) and.push({ issueDate: { gte: localMidnight(filters.dateFrom) } });
  if (filters.dateTo) and.push({ issueDate: { lt: nextLocalMidnight(filters.dateTo) } });
  if (filters.minTotal !== undefined) and.push({ total: { gte: filters.minTotal } });
  if (filters.maxTotal !== undefined) and.push({ total: { lte: filters.maxTotal } });
  if (filters.statuses && filters.statuses.length > 0) and.push({ status: { in: filters.statuses } });

  return and.length > 0 ? { AND: and } : {};
}

function buildFilterSql(filters: InvoiceListFilters) {
  const clauses: Prisma.Sql[] = [];

  if (filters.search) {
    const pattern = likePattern(filters.search);
    // `ILIKE`, no `LIKE`: en Postgres `LIKE` es sensible a mayúsculas (a
    // diferencia de SQLite, que lo era en ASCII por defecto). `ILIKE` es el
    // equivalente case-insensitive nativo de Postgres.
    clauses.push(Prisma.sql`(
      "clientName" ILIKE ${pattern} ESCAPE '\\'
      OR EXISTS (
        SELECT 1 FROM "InvoiceLine" li
        WHERE li."invoiceId" = "Invoice"."id" AND li."description" ILIKE ${pattern} ESCAPE '\\'
      )
    )`);
  }
  if (filters.dateFrom) {
    clauses.push(Prisma.sql`"issueDate" >= ${localMidnight(filters.dateFrom)}`);
  }
  if (filters.dateTo) {
    clauses.push(Prisma.sql`"issueDate" < ${nextLocalMidnight(filters.dateTo)}`);
  }
  if (filters.minTotal !== undefined) clauses.push(Prisma.sql`"total" >= ${filters.minTotal}`);
  if (filters.maxTotal !== undefined) clauses.push(Prisma.sql`"total" <= ${filters.maxTotal}`);
  if (filters.statuses && filters.statuses.length > 0) {
    clauses.push(Prisma.sql`"status" IN (${Prisma.join(filters.statuses)})`);
  }

  return clauses.length > 0 ? Prisma.sql`WHERE ${Prisma.join(clauses, " AND ")}` : Prisma.empty;
}

/**
 * Página del listado, paginada en la base de datos con `LIMIT`/`OFFSET`, y
 * opcionalmente filtrada por cliente, texto de una línea, rango de fecha de
 * emisión, rango de importe o estado.
 *
 * SQL en crudo (no `findMany`) porque el orden no es una sola columna: los
 * borradores (`number` nulo) van siempre primero, por fecha de creación —son
 * los que piden una decisión—, y el resto por año/serie/correlativo. Ese
 * orden compuesto no se puede expresar con `orderBy` de Prisma, y sin
 * expresarlo en la propia consulta, el `LIMIT`/`OFFSET` cortaría las páginas
 * por el orden equivocado. Los filtros, en cambio, sí se pueden expresar con
 * `where` de Prisma para los `count` — solo el `SELECT` paginado necesita su
 * propio fragmento SQL (`buildFilterSql`).
 */
export async function listInvoices(
  page: number,
  pageSize: number,
  filters: InvoiceListFilters = {},
): Promise<InvoicePage> {
  const offset = (page - 1) * pageSize;
  const where = buildWhere(filters);

  const [rows, total, draftsTotal] = await Promise.all([
    prisma.$queryRaw<InvoiceListRow[]>`
      SELECT "id", "series", "number", "year", "status", "issueDate", "dueDate", "clientName", "total", "currency"
      FROM "Invoice"
      ${buildFilterSql(filters)}
      ORDER BY
        CASE WHEN "number" IS NULL THEN 0 ELSE 1 END ASC,
        CASE WHEN "number" IS NULL THEN "createdAt" END DESC,
        "year" DESC,
        "series" ASC,
        "number" DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    prisma.invoice.count({ where }),
    prisma.invoice.count({ where: { ...where, number: null } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // El offset caía fuera de rango (una página vieja en un marcador, o borrada
  // desde entonces): se repite una sola vez con la última página de verdad en
  // vez de devolver un hueco vacío.
  if (page > totalPages) {
    return listInvoices(totalPages, pageSize, filters);
  }

  return {
    items: rows.map(toSummaryFromRow),
    page,
    pageSize,
    total,
    totalPages,
    draftsTotal,
  };
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
