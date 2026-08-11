import Link from "next/link";
import { notFound } from "next/navigation";
import { updateInvoice } from "@/app/invoices/actions";
import { InvoiceForm } from "@/components/invoice-form";
import { toDateInputValue } from "@/lib/format";
import { formatInvoiceNumber } from "@/lib/invoice-math";
import { getInvoice, getSettings } from "@/lib/invoices";

export default async function EditInvoicePage({
  params,
}: PageProps<"/invoices/[id]/edit">) {
  const { id } = await params;
  const [invoice, settings] = await Promise.all([getInvoice(id), getSettings()]);
  if (!invoice) notFound();

  const number = formatInvoiceNumber(invoice.series, invoice.year, invoice.number);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/invoices/${invoice.id}`} className="text-sm text-[var(--muted)] hover:underline">
          ← Volver a la factura
        </Link>
        <h1 className="tabular mt-2 text-2xl font-semibold">Editar factura {number}</h1>
        <p className="text-sm text-[var(--muted)]">
          El número, la serie y el año no cambian: una factura ya emitida conserva su
          numeración.
        </p>
      </div>

      <InvoiceForm
        action={updateInvoice.bind(null, invoice.id)}
        settings={settings}
        today={toDateInputValue(new Date())}
        invoice={invoice}
      />
    </div>
  );
}
