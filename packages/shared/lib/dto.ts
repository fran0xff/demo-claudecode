import type { InvoiceStatus } from "./invoice-status";

/**
 * Formas de datos que cruzan la red entre `apps/backend` y `apps/frontend`.
 *
 * Viven aquí y no en el repositorio que las produce porque las dos apps
 * tienen que estar de acuerdo en la forma exacta: el backend las serializa
 * en JSON y el frontend las tipa tal cual llegan, sin recalcularlas. Los
 * tipos que son solo plomería interna del backend (filas mínimas para
 * numerar, datos de escritura ya calculados...) se quedan en
 * `apps/backend/lib/repositories/*`, porque el frontend nunca los ve.
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

/**
 * Página del listado de facturas (`GET /api/invoices?page=`), paginado en la
 * base de datos con offset/limit, no en memoria: `items` es solo lo que toca
 * mostrar en esa página, `total`/`draftsTotal` son recuentos de todas las
 * facturas, para el resumen de arriba del listado y para pintar el control de
 * paginación sin tener que traerlas todas.
 */
export type InvoicePage = {
  items: InvoiceSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  draftsTotal: number;
};

export type SettingsDTO = {
  issuerName: string;
  issuerTaxId: string;
  issuerAddress: string;
  defaultSeries: string;
  defaultVatRate: number;
};

export type UserDTO = {
  id: string;
  email: string;
  createdAt: string;
};
