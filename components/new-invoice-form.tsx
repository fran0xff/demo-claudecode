"use client";

import { InvoiceForm } from "@/components/invoice-form";
import { createInvoiceAction } from "@/lib/api/invoice-client";
import type { SettingsDTO } from "@/lib/repositories/settings-repository";

type Props = {
  settings: SettingsDTO;
  today: string;
};

/**
 * Ata `InvoiceForm` a `createInvoiceAction`.
 *
 * Existe porque `app/invoices/new/page.tsx` es un Server Component: no puede
 * pasar una función cliente (no marcada `"use server"`) como prop a través de
 * la frontera RSC. Al vivir aquí, en un Client Component, la referencia a la
 * función se queda en el navegador y no necesita cruzar esa frontera.
 */
export function NewInvoiceForm({ settings, today }: Props) {
  return <InvoiceForm action={createInvoiceAction} settings={settings} today={today} />;
}
