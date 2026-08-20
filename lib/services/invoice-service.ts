import "server-only";
import { prisma } from "@/lib/db";
import {
  NotFoundError,
  SettingsNotConfiguredError,
  ValidationError,
  InvoiceNumberConflictError,
} from "@/lib/services/errors";
import { computeInvoiceTotals, formatInvoiceNumber } from "@/lib/invoice-math";
import { isIssuedStatus, type InvoiceStatus } from "@/lib/invoice-status";
import {
  assignInvoiceNumber,
  createDraftInvoice,
  deleteInvoiceById,
  findInvoiceForIssuing,
  findInvoiceStatusRow,
  findLastInvoiceNumber,
  replaceInvoiceLinesAndHeader,
  updateInvoiceStatus,
} from "@/lib/repositories/invoice-repository";
import { getSettings } from "@/lib/repositories/settings-repository";
import { fieldErrors, invoiceSchema, type InvoiceInput } from "@/lib/validation";

/**
 * Lógica de negocio de facturas.
 *
 * No conoce `Request`/`Response` ni códigos HTTP: devuelve datos en el caso
 * de éxito y lanza los errores tipados de `lib/services/errors.ts` en el de
 * fallo. Tampoco toca `setFlash`/`cookies()` — decidir el aviso es cosa de la
 * ruta, que es quien sabe que está en un contexto HTTP.
 *
 * Solo llama a `lib/repositories/*` (nunca a Prisma directamente), salvo
 * `issueInvoice`, que abre la transacción de reintento porque es quien
 * orquesta el "leer número, intentar escribir, reintentar si choca" — las
 * queries de cada paso siguen viviendo en el repositorio.
 */

/**
 * Los campos de línea llegan como `lines.0.description`, `lines.0.quantity`...
 * Los reagrupamos en un array para que Zod valide la factura completa y los
 * errores salgan con esa misma ruta, que es el `name` del input.
 */
function parseInvoiceForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;

  const indexes = new Set<number>();
  for (const key of Object.keys(raw)) {
    const match = /^lines\.(\d+)\./.exec(key);
    if (match) indexes.add(Number(match[1]));
  }

  const lines = [...indexes]
    .sort((a, b) => a - b)
    .map((index) => ({
      description: raw[`lines.${index}.description`] ?? "",
      quantity: raw[`lines.${index}.quantity`] ?? "",
      unitPrice: raw[`lines.${index}.unitPrice`] ?? "",
      vatRate: raw[`lines.${index}.vatRate`] ?? "",
      discountPct: raw[`lines.${index}.discountPct`] ?? "",
    }));

  return {
    series: raw.series ?? "",
    issueDate: raw.issueDate ?? "",
    dueDate: raw.dueDate ?? "",
    clientName: raw.clientName ?? "",
    clientTaxId: raw.clientTaxId ?? "",
    clientAddress: raw.clientAddress ?? "",
    clientEmail: raw.clientEmail ?? "",
    irpfRate: raw.irpfRate ?? "",
    notes: raw.notes ?? "",
    lines,
  };
}

function invoiceData(input: InvoiceInput) {
  const totals = computeInvoiceTotals(input.lines, input.irpfRate);

  return {
    totals,
    common: {
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      clientName: input.clientName,
      clientTaxId: input.clientTaxId,
      clientAddress: input.clientAddress,
      clientEmail: input.clientEmail,
      irpfRate: input.irpfRate,
      notes: input.notes,
      subtotal: totals.subtotal,
      taxTotal: totals.taxTotal,
      irpfTotal: totals.irpfTotal,
      total: totals.total,
    },
    lines: input.lines.map((line, index) => ({
      position: index,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      vatRate: line.vatRate,
      discountPct: line.discountPct,
      lineTotal: totals.lineTotals[index],
    })),
  };
}

/** Cómo nombrar la factura en un aviso. Un borrador aún no tiene con qué. */
function serialOf(invoice: { series: string; year: number; number: number | null }) {
  return invoice.number === null
    ? undefined
    : formatInvoiceNumber(invoice.series, invoice.year, invoice.number);
}

/** Errores de restricción única de Prisma (número de factura repetido). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/** Error "no encontrado" de Prisma (p. ej. borrar un id que ya no existe). */
function isRecordNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2025"
  );
}

/**
 * Crea la factura como borrador: sin número.
 *
 * El correlativo no se gasta aquí sino en `issueInvoice`. Si se numerase al
 * crear, borrar un borrador dejaría un hueco en la serie, y una serie con
 * huecos es justo lo que la numeración no puede tener.
 */
export async function createInvoice(formData: FormData): Promise<{ id: string }> {
  const parsed = invoiceSchema.safeParse(parseInvoiceForm(formData));
  if (!parsed.success) {
    throw new ValidationError(fieldErrors(parsed.error));
  }

  const settings = await getSettings();
  if (!settings.issuerName || !settings.issuerTaxId) {
    throw new SettingsNotConfiguredError();
  }

  const input = parsed.data;
  // Los importes que se guardan son los que recalcula el servidor, no los que
  // haya podido enviar el navegador.
  const { common, lines } = invoiceData(input);

  return createDraftInvoice({
    ...common,
    series: input.series,
    year: input.issueDate.getFullYear(),
    issuerName: settings.issuerName,
    issuerTaxId: settings.issuerTaxId,
    issuerAddress: settings.issuerAddress,
    lines,
  });
}

/**
 * Emite un borrador: le asigna el correlativo y lo pasa a EMITIDA.
 *
 * El número se busca y se escribe dentro de la misma transacción, pero dos
 * peticiones simultáneas aún podrían pedir el mismo; la restricción única lo
 * rechaza y reintentamos con el siguiente, hasta 3 intentos.
 *
 * Devuelve `{issued: null}` si la factura no existe o ya no es un borrador
 * (reemitir no es un error, es un no-op: no se le asigna un segundo número).
 */
export async function issueInvoice(
  id: string,
): Promise<{ issued: { series: string; year: number; number: number } | null }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // La transacción devuelve el número asignado en vez de dejarlo en una
      // variable de fuera: así el llamador solo sabe que se emitió si de
      // verdad se emitió.
      const issued = await prisma.$transaction(async (tx) => {
        const invoice = await findInvoiceForIssuing(id, tx);
        if (!invoice || invoice.status !== "BORRADOR") return null;

        const last = await findLastInvoiceNumber(invoice.series, invoice.year, tx);
        const number = (last ?? 0) + 1;
        await assignInvoiceNumber(id, number, tx);

        return { series: invoice.series, year: invoice.year, number };
      });

      return { issued };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      if (attempt === 2) throw new InvoiceNumberConflictError();
    }
  }

  // Inalcanzable: cada vuelta del bucle o devuelve o lanza.
  throw new InvoiceNumberConflictError();
}

/**
 * Cambia el estado de una factura ya emitida (emitida / enviada / pagada).
 * Volver a BORRADOR no es un movimiento válido: el número ya está gastado.
 *
 * No-op (devuelve `null`) si el estado pedido no es uno "emitido", si la
 * factura no existe o si sigue siendo un borrador.
 */
export async function setInvoiceStatus(
  id: string,
  status: string,
): Promise<{ status: InvoiceStatus; serial?: string } | null> {
  if (!isIssuedStatus(status)) return null;

  const invoice = await findInvoiceStatusRow(id);
  if (!invoice || invoice.status === "BORRADOR") return null;

  await updateInvoiceStatus(id, status);

  return { status, serial: serialOf(invoice) };
}

/**
 * Reemplaza líneas y cabecera con los importes recalculados en el servidor.
 *
 * Un borrador todavía no tiene número, así que puede cambiar de serie y de
 * año: es la fecha de emisión la que decide en qué año se numerará. Una vez
 * emitida, ninguna de las tres cosas se toca.
 */
export async function updateInvoice(
  id: string,
  formData: FormData,
): Promise<{ id: string; serial?: string }> {
  const parsed = invoiceSchema.safeParse(parseInvoiceForm(formData));
  if (!parsed.success) {
    throw new ValidationError(fieldErrors(parsed.error));
  }

  const existing = await findInvoiceStatusRow(id);
  if (!existing) {
    throw new NotFoundError("Esa factura ya no existe.");
  }

  const input = parsed.data;
  const { common, lines } = invoiceData(input);

  const numbering: { series: string; year: number } | Record<string, never> =
    existing.status === "BORRADOR"
      ? { series: input.series, year: input.issueDate.getFullYear() }
      : {};

  await replaceInvoiceLinesAndHeader(id, common, lines, numbering);

  return { id, serial: serialOf(existing) };
}

/**
 * Borra la factura (las líneas caen en cascada) y describe qué se borró para
 * que la ruta pueda elegir el mensaje del aviso ("Borrador eliminado." si
 * nunca tuvo número, "Factura eliminada." si sí).
 */
export async function deleteInvoice(
  id: string,
): Promise<{ hadNumber: boolean; serial?: string }> {
  try {
    const deleted = await deleteInvoiceById(id);
    return { hadNumber: deleted.number !== null, serial: serialOf(deleted) };
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      throw new NotFoundError("Esa factura ya no existe.");
    }
    throw error;
  }
}
