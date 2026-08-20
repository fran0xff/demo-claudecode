import type { NextRequest } from "next/server";
import { setFlash } from "@/lib/flash-cookie";
import { listInvoices } from "@/lib/repositories/invoice-repository";
import * as invoiceService from "@/lib/services/invoice-service";
import { SettingsNotConfiguredError, ValidationError } from "@/lib/services/errors";

/** Lista de facturas para la pantalla `/invoices`. Sin lógica que orquestar. */
export async function GET() {
  const invoices = await listInvoices();
  return Response.json(invoices);
}

/**
 * Crea un borrador. El correlativo no se gasta aquí: eso pasa en
 * `POST /api/invoices/[id]/issue`.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();

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
