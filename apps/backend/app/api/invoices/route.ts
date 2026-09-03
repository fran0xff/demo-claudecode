import type { NextRequest } from "next/server";
import { setFlash } from "@/lib/flash-cookie";
import * as invoiceService from "@/lib/services/invoice-service";
import { SettingsNotConfiguredError, ValidationError } from "@/lib/services/errors";

/** Página del listado de facturas para la pantalla `/invoices`. */
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page")) || 1;

  const invoices = await invoiceService.listInvoices(page, {
    search: params.get("q") ?? undefined,
    dateFrom: params.get("dateFrom") ?? undefined,
    dateTo: params.get("dateTo") ?? undefined,
    minTotal: params.get("minTotal") ?? undefined,
    maxTotal: params.get("maxTotal") ?? undefined,
    statuses: params.getAll("status"),
  });
  return Response.json(invoices);
}

/**
 * Crea un borrador. El correlativo no se gasta aquí: eso pasa en
 * `POST /api/invoices/[id]/issue`.
 */
export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ errors: {}, message: "Cuerpo de la petición no válido." }, { status: 400 });
  }

  try {
    const { id } = await invoiceService.createInvoice(formData);
    await setFlash("exito", "Borrador creado. Todavía no gasta correlativo.");
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ errors: error.errors }, { status: 400 });
    }
    if (error instanceof SettingsNotConfiguredError) {
      return Response.json({ errors: {}, message: error.message }, { status: 400 });
    }
    return Response.json({ errors: {}, message: "Error inesperado." }, { status: 500 });
  }
}
