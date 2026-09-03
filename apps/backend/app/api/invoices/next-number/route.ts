import type { NextRequest } from "next/server";
import * as invoiceService from "@/lib/services/invoice-service";

/**
 * Correlativo que le tocaría a la próxima factura de una serie y año, solo
 * informativo (el número de verdad se asigna al emitir, dentro de una
 * transacción — ver `POST /api/invoices/[id]/issue`). No existía como ruta
 * mientras el frontend leía el repositorio en el mismo proceso; al separar
 * las dos apps, `app/invoices/page.tsx` y `app/invoices/[id]/page.tsx` de
 * `apps/frontend` necesitan pedirlo por HTTP.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const series = searchParams.get("series");
  const year = Number(searchParams.get("year"));

  if (!series || !Number.isInteger(year)) {
    return Response.json({ message: "Faltan 'series' o 'year' en la consulta." }, { status: 400 });
  }

  const number = await invoiceService.nextInvoiceNumber(series, year);
  return Response.json({ number });
}
