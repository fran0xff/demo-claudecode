import type { NextRequest } from "next/server";
import { setFlash } from "@/lib/flash-cookie";
import { STATUS_LABELS } from "@/lib/invoice-status";
import * as invoiceService from "@/lib/services/invoice-service";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Cambia el estado de una factura ya emitida (emitida / enviada / pagada).
 *
 * `applied: false` es la respuesta normal cuando el estado pedido no es
 * válido, la factura no existe o sigue siendo un borrador: no es un error,
 * es un no-op.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const formData = await request.formData();
  const status = String(formData.get("status") ?? "");

  try {
    const result = await invoiceService.setInvoiceStatus(id, status);

    if (result) {
      await setFlash("exito", `Estado actualizado a ${STATUS_LABELS[result.status]}.`, result.serial);
    }

    return Response.json({ applied: result !== null });
  } catch {
    return Response.json({ message: "Error inesperado." }, { status: 500 });
  }
}
