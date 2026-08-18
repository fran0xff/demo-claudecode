"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { setFlash } from "@/lib/flash-cookie";
import { computeInvoiceTotals, formatInvoiceNumber } from "@/lib/invoice-math";
import { isIssuedStatus, STATUS_LABELS } from "@/lib/invoice-status";
import { getSettings } from "@/lib/invoices";
import { fieldErrors, invoiceSchema, type InvoiceInput } from "@/lib/validation";
import type { FormState } from "@/lib/form-state";

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

/**
 * Crea la factura como borrador: sin número.
 *
 * El correlativo no se gasta aquí sino en `issueInvoice`. Si se numerase al
 * crear, borrar un borrador dejaría un hueco en la serie, y una serie con
 * huecos es justo lo que la numeración no puede tener.
 */
export async function createInvoice(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = invoiceSchema.safeParse(parseInvoiceForm(formData));
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const settings = await getSettings();
  if (!settings.issuerName || !settings.issuerTaxId) {
    return {
      errors: {},
      message: "Configura primero los datos del emisor en Ajustes.",
    };
  }

  const input = parsed.data;
  // Los importes que se guardan son los que recalcula el servidor, no los que
  // haya podido enviar el navegador.
  const { common, lines } = invoiceData(input);

  const created = await prisma.invoice.create({
    data: {
      ...common,
      series: input.series,
      year: input.issueDate.getFullYear(),
      number: null,
      status: "BORRADOR",
      issuerName: settings.issuerName,
      issuerTaxId: settings.issuerTaxId,
      issuerAddress: settings.issuerAddress,
      lines: { create: lines },
    },
    select: { id: true },
  });

  await setFlash("exito", "Borrador creado. Todavía no gasta correlativo.");
  revalidatePath("/invoices");
  redirect(`/invoices/${created.id}`);
}

/**
 * Emite un borrador: le asigna el correlativo y lo pasa a EMITIDA.
 *
 * El número se busca y se escribe dentro de la misma transacción, pero dos
 * peticiones simultáneas aún podrían pedir el mismo; la restricción única lo
 * rechaza y reintentamos con el siguiente.
 */
export async function issueInvoice(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // La transacción devuelve el número asignado en vez de dejarlo en una
      // variable de fuera: así el aviso solo sale cuando de verdad se emitió.
      const issued = await prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({
          where: { id },
          select: { series: true, year: true, status: true },
        });

        // Ya emitida (o borrada): no hay nada que hacer y, sobre todo, no se
        // le asigna un segundo número.
        if (!invoice || invoice.status !== "BORRADOR") return null;

        const last = await tx.invoice.findFirst({
          where: { series: invoice.series, year: invoice.year, number: { not: null } },
          orderBy: { number: "desc" },
          select: { number: true },
        });

        const number = (last?.number ?? 0) + 1;
        await tx.invoice.update({
          where: { id },
          data: { number, status: "EMITIDA" },
        });

        return { series: invoice.series, year: invoice.year, number };
      });

      if (issued) {
        await setFlash(
          "exito",
          "Factura emitida.",
          formatInvoiceNumber(issued.series, issued.year, issued.number),
        );
      }
      break;
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === 2) throw error;
    }
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
}

/**
 * Cambia el estado de una factura ya emitida (emitida / enviada / pagada).
 * Volver a BORRADOR no es un movimiento válido: el número ya está gastado.
 */
export async function setInvoiceStatus(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !isIssuedStatus(status)) return;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { status: true, series: true, year: true, number: true },
  });
  if (!invoice || invoice.status === "BORRADOR") return;

  await prisma.invoice.update({ where: { id }, data: { status } });

  await setFlash("exito", `Estado actualizado a ${STATUS_LABELS[status]}.`, serialOf(invoice));

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
}

export async function updateInvoice(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = invoiceSchema.safeParse(parseInvoiceForm(formData));
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error) };
  }

  const existing = await prisma.invoice.findUnique({
    where: { id },
    select: { id: true, status: true, series: true, year: true, number: true },
  });
  if (!existing) {
    return { errors: {}, message: "Esa factura ya no existe." };
  }

  const input = parsed.data;
  const { common, lines } = invoiceData(input);

  // Un borrador todavía no tiene número, así que puede cambiar de serie y de
  // año: es la fecha de emisión la que decide en qué año se numerará. Una vez
  // emitida, ninguna de las tres cosas se toca.
  const numbering =
    existing.status === "BORRADOR"
      ? { series: input.series, year: input.issueDate.getFullYear() }
      : {};

  await prisma.$transaction([
    prisma.invoiceLine.deleteMany({ where: { invoiceId: id } }),
    prisma.invoice.update({
      where: { id },
      data: { ...common, ...numbering, lines: { create: lines } },
    }),
  ]);

  await setFlash("exito", "Cambios guardados.", serialOf(existing));

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}`);
}

export async function deleteInvoice(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Las líneas caen solas por el onDelete: Cascade del esquema. `delete`
  // devuelve lo borrado, que es la última ocasión de saber cómo se llamaba.
  const deleted = await prisma.invoice.delete({
    where: { id },
    select: { series: true, year: true, number: true },
  });

  await setFlash(
    "aviso",
    deleted.number === null ? "Borrador eliminado." : "Factura eliminada.",
    serialOf(deleted),
  );

  revalidatePath("/invoices");
  redirect("/invoices");
}
