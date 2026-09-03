"use client";

import { InvoiceForm } from "@/components/invoice-form";
import { updateInvoiceAction } from "@/lib/api/invoice-client";
import type { InvoiceDTO, SettingsDTO } from "@facturas/shared/dto";

type Props = {
  invoice: InvoiceDTO;
  settings: SettingsDTO;
  today: string;
};

/**
 * Ata `InvoiceForm` a `updateInvoiceAction` ligada al id de la factura.
 *
 * Mismo motivo que `new-invoice-form.tsx`: `app/invoices/[id]/edit/page.tsx`
 * es un Server Component y no puede pasar una función cliente como prop a
 * través de la frontera RSC.
 */
export function EditInvoiceForm({ invoice, settings, today }: Props) {
  return (
    <InvoiceForm
      action={updateInvoiceAction.bind(null, invoice.id)}
      settings={settings}
      today={today}
      invoice={invoice}
    />
  );
}
