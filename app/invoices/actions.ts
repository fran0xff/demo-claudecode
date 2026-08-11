"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeInvoiceTotals } from "@/lib/invoice-math";
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

/** Errores de restricción única de Prisma (número de factura repetido). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

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
  const year = input.issueDate.getFullYear();

  let invoiceId: string | undefined;

  // El correlativo se asigna dentro de la transacción, pero dos peticiones
  // simultáneas aún podrían pedir el mismo número; la restricción única lo
  // rechaza y reintentamos con el siguiente.
  for (let attempt = 0; attempt < 3 && !invoiceId; attempt++) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const last = await tx.invoice.findFirst({
          where: { series: input.series, year },
          orderBy: { number: "desc" },
          select: { number: true },
        });

        return tx.invoice.create({
          data: {
            ...common,
            series: input.series,
            year,
            number: (last?.number ?? 0) + 1,
            issuerName: settings.issuerName,
            issuerTaxId: settings.issuerTaxId,
            issuerAddress: settings.issuerAddress,
            lines: { create: lines },
          },
          select: { id: true },
        });
      });
      invoiceId = created.id;
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === 2) throw error;
    }
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
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

  const existing = await prisma.invoice.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return { errors: {}, message: "Esa factura ya no existe." };
  }

  const { common, lines } = invoiceData(parsed.data);

  // La serie, el año y el correlativo no se tocan al editar: una factura ya
  // emitida no puede cambiar de número.
  await prisma.$transaction([
    prisma.invoiceLine.deleteMany({ where: { invoiceId: id } }),
    prisma.invoice.update({
      where: { id },
      data: { ...common, lines: { create: lines } },
    }),
  ]);

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  redirect(`/invoices/${id}`);
}

export async function deleteInvoice(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Las líneas caen solas por el onDelete: Cascade del esquema.
  await prisma.invoice.delete({ where: { id } });

  revalidatePath("/invoices");
  redirect("/invoices");
}
