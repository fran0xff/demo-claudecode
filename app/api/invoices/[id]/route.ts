import type { NextRequest } from "next/server";
import { setFlash } from "@/lib/flash-cookie";
import * as invoiceService from "@/lib/services/invoice-service";
import { NotFoundError, ValidationError } from "@/lib/services/errors";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const invoice = await invoiceService.getInvoice(id);
  if (!invoice) {
    return Response.json({ message: "No encontrada." }, { status: 404 });
  }

  return Response.json(invoice);
}

/**
 * Edita la factura (recalcula totales en servidor). No hay PUT/PATCH a
 * propósito: el formulario de edición envía `FormData`, igual que el resto de
 * rutas de este recurso.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ errors: {}, message: "Cuerpo de la petición no válido." }, { status: 400 });
  }

  try {
    const { serial } = await invoiceService.updateInvoice(id, formData);
    await setFlash("exito", "Cambios guardados.", serial);
    return Response.json({ id });
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ errors: error.errors }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return Response.json({ errors: {}, message: error.message }, { status: 404 });
    }
    return Response.json({ errors: {}, message: "Error inesperado." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const { hadNumber, serial } = await invoiceService.deleteInvoice(id);
    await setFlash("aviso", hadNumber ? "Factura eliminada." : "Borrador eliminado.", serial);
    return Response.json({}, { status: 200 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return Response.json({ message: error.message }, { status: 404 });
    }
    return Response.json({ message: "Error inesperado." }, { status: 500 });
  }
}
