import type { NextRequest } from "next/server";
import { setFlash } from "@/lib/flash-cookie";
import { formatInvoiceNumber } from "@facturas/shared/invoice-math";
import * as invoiceService from "@/lib/services/invoice-service";
import { InvoiceNumberConflictError } from "@/lib/services/errors";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Emite un borrador: le asigna el correlativo y lo pasa a EMITIDA.
 *
 * `issued: null` es la respuesta normal cuando la factura ya no era un
 * borrador (reemitir es un no-op, no un error).
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const { issued } = await invoiceService.issueInvoice(id);

    if (issued) {
      await setFlash(
        "exito",
        "Factura emitida.",
        formatInvoiceNumber(issued.series, issued.year, issued.number),
      );
    }

    return Response.json({ issued });
  } catch (error) {
    if (error instanceof InvoiceNumberConflictError) {
      return Response.json({ message: error.message }, { status: 409 });
    }
    return Response.json({ message: "Error inesperado." }, { status: 500 });
  }
}
