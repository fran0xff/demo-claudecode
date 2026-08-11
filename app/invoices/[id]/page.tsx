import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteInvoiceButton } from "@/components/delete-invoice-button";
import { InvoiceTotals } from "@/components/invoice-totals";
import { formatAmount, formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { computeInvoiceTotals, formatInvoiceNumber } from "@/lib/invoice-math";
import { getInvoice } from "@/lib/invoices";

export default async function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const number = formatInvoiceNumber(invoice.series, invoice.year, invoice.number);

  // Los totales mostrados son los guardados con la factura. Solo recalculamos
  // el desglose por tipo de IVA, que no se persiste.
  const { vatBreakdown } = computeInvoiceTotals(invoice.lines, invoice.irpfRate);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/invoices" className="text-sm text-[var(--muted)] hover:underline">
            ← Volver al listado
          </Link>
          <h1 className="tabular mt-2 text-2xl font-semibold">Factura {number}</h1>
          <p className="text-sm text-[var(--muted)]">
            Emitida el {formatDate(invoice.issueDate)}
            {invoice.dueDate && ` · Vence el ${formatDate(invoice.dueDate)}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/invoices/${invoice.id}/edit`} className="btn-secondary">
            Editar
          </Link>
          <DeleteInvoiceButton invoiceId={invoice.id} invoiceNumber={number} />
        </div>
      </div>

      <div className="card grid gap-6 p-5 sm:grid-cols-2">
        <Party
          title="Emisor"
          name={invoice.issuerName}
          taxId={invoice.issuerTaxId}
          address={invoice.issuerAddress}
        />
        <Party
          title="Cliente"
          name={invoice.clientName}
          taxId={invoice.clientTaxId}
          address={invoice.clientAddress}
          email={invoice.clientEmail}
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 text-right font-medium">Cantidad</th>
              <th className="px-4 py-3 text-right font-medium">Precio</th>
              <th className="px-4 py-3 text-right font-medium">Dto.</th>
              <th className="px-4 py-3 text-right font-medium">IVA</th>
              <th className="px-4 py-3 text-right font-medium">Importe</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3">{line.description}</td>
                <td className="tabular px-4 py-3 text-right">{formatAmount(line.quantity)}</td>
                <td className="tabular px-4 py-3 text-right">
                  {formatCurrency(line.unitPrice, invoice.currency)}
                </td>
                <td className="tabular px-4 py-3 text-right text-[var(--muted)]">
                  {line.discountPct > 0 ? formatPercent(line.discountPct) : "—"}
                </td>
                <td className="tabular px-4 py-3 text-right text-[var(--muted)]">
                  {formatPercent(line.vatRate)}
                </td>
                <td className="tabular px-4 py-3 text-right font-medium">
                  {formatCurrency(line.lineTotal, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {invoice.notes ? (
          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Notas
            </h2>
            <p className="whitespace-pre-line text-sm">{invoice.notes}</p>
          </div>
        ) : (
          <div />
        )}

        <div className="card p-5">
          <InvoiceTotals
            vatBreakdown={vatBreakdown}
            subtotal={invoice.subtotal}
            taxTotal={invoice.taxTotal}
            irpfRate={invoice.irpfRate}
            irpfTotal={invoice.irpfTotal}
            total={invoice.total}
            currency={invoice.currency}
          />
        </div>
      </div>
    </div>
  );
}

function Party({
  title,
  name,
  taxId,
  address,
  email,
}: {
  title: string;
  name: string;
  taxId: string;
  address: string;
  email?: string | null;
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h2>
      <p className="font-medium">{name}</p>
      <p className="tabular text-sm text-[var(--muted)]">{taxId}</p>
      <p className="whitespace-pre-line text-sm text-[var(--muted)]">{address}</p>
      {email && <p className="text-sm text-[var(--muted)]">{email}</p>}
    </div>
  );
}
