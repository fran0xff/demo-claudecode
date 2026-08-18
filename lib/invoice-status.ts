/**
 * Estados de una factura.
 *
 * SQLite no admite enums en Prisma, así que la columna es un `String` y los
 * valores válidos se definen aquí. Es el único sitio donde se enumeran: las
 * Server Actions validan contra estas listas antes de escribir.
 *
 * "Vencida" no está: no es un estado guardado sino algo que se deduce de la
 * fecha de vencimiento al leer, así que nunca se queda desfasado.
 */

export const INVOICE_STATUSES = ["BORRADOR", "EMITIDA", "ENVIADA", "PAGADA"] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/**
 * Estados a los que puede pasar una factura ya emitida. `BORRADOR` no está: una
 * vez gastado el correlativo no se vuelve atrás, o la serie quedaría con un
 * hueco.
 */
export const ISSUED_STATUSES = ["EMITIDA", "ENVIADA", "PAGADA"] as const;

export type IssuedStatus = (typeof ISSUED_STATUSES)[number];

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  BORRADOR: "Borrador",
  EMITIDA: "Emitida",
  ENVIADA: "Enviada",
  PAGADA: "Pagada",
};

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(value);
}

export function isIssuedStatus(value: string): value is IssuedStatus {
  return (ISSUED_STATUSES as readonly string[]).includes(value);
}

/**
 * Una factura está vencida si tenía fecha de vencimiento, ya pasó y todavía no
 * se ha cobrado. Un borrador nunca lo está: aún no se ha emitido.
 */
export function isOverdue(
  status: InvoiceStatus,
  dueDate: string | Date | null,
  now: Date = new Date(),
): boolean {
  if (!dueDate || status === "PAGADA" || status === "BORRADOR") return false;
  return new Date(dueDate).getTime() < now.getTime();
}
