import Link from "next/link";
import { NewInvoiceForm } from "@/components/new-invoice-form";
import { toDateInputValue } from "@/lib/format";
import { getSettings } from "@/lib/backend";

export const metadata = { title: "Nueva factura" };

// Lee los ajustes del emisor, que pueden cambiar en cualquier momento.
export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const settings = await getSettings();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/invoices"
          className="text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          ← Listado
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Nueva factura</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Se guarda como borrador. Recibe su número al emitirla, correlativo dentro de
          su serie y su año.
        </p>
      </div>

      <NewInvoiceForm settings={settings} today={toDateInputValue(new Date())} />
    </div>
  );
}
