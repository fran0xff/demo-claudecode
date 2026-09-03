import Link from "next/link";
import { notFound } from "next/navigation";
import { EditInvoiceForm } from "@/components/edit-invoice-form";
import { InvoiceNumber } from "@/components/invoice-number";
import { toDateInputValue } from "@/lib/format";
import { formatInvoiceNumber } from "@facturas/shared/invoice-math";
import { getInvoice, getSettings } from "@/lib/backend";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params,
}: PageProps<"/invoices/[id]/edit">) {
  const { id } = await params;
  const [invoice, settings] = await Promise.all([getInvoice(id), getSettings()]);
  if (!invoice) notFound();

  const isDraft = invoice.number === null;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/invoices/${invoice.id}`}
          className="text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          ←{" "}
          {isDraft
            ? "Borrador"
            : formatInvoiceNumber(invoice.series, invoice.year, invoice.number!)}
        </Link>

        <p className="eyebrow mt-6">Editando</p>

        {isDraft ? (
          <>
            <h1 className="mt-1 text-[2rem] leading-none tracking-tight sm:text-[2.75rem]">
              Borrador
            </h1>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Todavía no ha gastado correlativo, así que puedes cambiarle la serie y la
              fecha: el número se decide al emitirla.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-1 text-[2rem] leading-none sm:text-[2.75rem]">
              <InvoiceNumber
                series={invoice.series}
                year={invoice.year}
                number={invoice.number!}
              />
            </h1>
            <p className="mt-3 text-sm text-[var(--muted)]">
              La serie, el año y el correlativo no cambian: una factura emitida conserva
              su numeración.
            </p>
          </>
        )}
      </div>

      <EditInvoiceForm
        invoice={invoice}
        settings={settings}
        today={toDateInputValue(new Date())}
      />
    </div>
  );
}
