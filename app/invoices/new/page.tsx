import Link from "next/link";
import { createInvoice } from "@/app/invoices/actions";
import { InvoiceForm } from "@/components/invoice-form";
import { toDateInputValue } from "@/lib/format";
import { getSettings } from "@/lib/invoices";

export const metadata = { title: "Nueva factura" };

// Lee los ajustes del emisor, que pueden cambiar en cualquier momento.
export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/invoices" className="text-sm text-[var(--muted)] hover:underline">
          ← Volver al listado
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Nueva factura</h1>
        <p className="text-sm text-[var(--muted)]">
          El número se asigna automáticamente al guardar, según la serie y el año.
        </p>
      </div>

      <InvoiceForm
        action={createInvoice}
        settings={settings}
        today={toDateInputValue(new Date())}
      />
    </div>
  );
}
