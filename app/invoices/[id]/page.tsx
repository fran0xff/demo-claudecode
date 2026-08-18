import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteInvoiceButton } from "@/components/delete-invoice-button";
import { Flash } from "@/components/flash";
import { InvoiceNumber } from "@/components/invoice-number";
import { InvoiceStatusControl } from "@/components/invoice-status-control";
import { InvoiceTotals } from "@/components/invoice-totals";
import { AutoPrint, PrintButton } from "@/components/print-button";
import { formatAmount, formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { computeInvoiceTotals, formatInvoiceNumber } from "@/lib/invoice-math";
import { isOverdue } from "@/lib/invoice-status";
import { getInvoice, nextInvoiceNumber } from "@/lib/invoices";

export const dynamic = "force-dynamic";

export default async function InvoicePage({
  params,
  searchParams,
}: PageProps<"/invoices/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  const isDraft = invoice.number === null;

  // Un borrador todavía no tiene número, pero sí se puede decir cuál le tocaría.
  const pendingNumber = isDraft
    ? await nextInvoiceNumber(invoice.series, invoice.year)
    : null;

  const confirmLabel = isDraft
    ? "este borrador"
    : `la factura ${formatInvoiceNumber(invoice.series, invoice.year, invoice.number!)}`;

  // Los totales mostrados son los guardados con la factura. Solo recalculamos
  // el desglose por tipo de IVA, que no se persiste.
  const { vatBreakdown } = computeInvoiceTotals(invoice.lines, invoice.irpfRate);

  return (
    <div className="space-y-8">
      <AutoPrint enabled={query.imprimir === "1"} />
      <Flash />

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <Link
            href="/invoices"
            className="no-print text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            ← Listado
          </Link>

          {/* El número es lo que identifica el documento, así que es el título
              de la página y lo primero que se ve. */}
          <p className="eyebrow mt-6">{isDraft ? "Borrador" : "Factura"}</p>

          {isDraft ? (
            <>
              <h1 className="mt-1 text-[2rem] leading-none tracking-tight sm:text-[2.75rem]">
                Sin numerar
              </h1>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Al emitirla llevará el número{" "}
                <InvoiceNumber
                  series={invoice.series}
                  year={invoice.year}
                  number={pendingNumber!}
                  className="text-[var(--foreground)]"
                />
                . Hasta entonces no gasta correlativo.
              </p>
            </>
          ) : (
            <h1 className="mt-1 text-[2rem] leading-none sm:text-[2.75rem]">
              <InvoiceNumber
                series={invoice.series}
                year={invoice.year}
                number={invoice.number!}
              />
            </h1>
          )}

          <p className="mt-3 text-sm text-[var(--muted)]">
            Emitida el <span className="tabular">{formatDate(invoice.issueDate)}</span>
            {invoice.dueDate && (
              <>
                {" · Vence el "}
                <span className="tabular">{formatDate(invoice.dueDate)}</span>
              </>
            )}
            {/* El estado de cobro es información interna: no va en el documento
                que se le manda al cliente, así que no se imprime. */}
            {isOverdue(invoice.status, invoice.dueDate) && (
              <span className="no-print">
                {" · "}
                <span className="badge-vencida">Vencida</span>
              </span>
            )}
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-3">
          <InvoiceStatusControl invoiceId={invoice.id} status={invoice.status} />
          <Link href={`/invoices/${invoice.id}/edit`} className="btn-secondary">
            Editar
          </Link>
          <PrintButton />
          <DeleteInvoiceButton invoiceId={invoice.id} confirmLabel={confirmLabel} />
        </div>
      </div>

      <div className="card grid gap-8 p-6 sm:grid-cols-2">
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
        <table className="ledger min-w-[40rem] text-sm">
          <thead>
            <tr>
              <th>Descripción</th>
              <th className="num">Cantidad</th>
              <th className="num">Precio</th>
              <th className="num">Dto.</th>
              <th className="num">IVA</th>
              <th className="num">Importe</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.description}</td>
                <td className="tabular num">{formatAmount(line.quantity)}</td>
                <td className="tabular num">
                  {formatCurrency(line.unitPrice, invoice.currency)}
                </td>
                <td className="tabular num text-[var(--muted)]">
                  {line.discountPct > 0 ? formatPercent(line.discountPct) : "—"}
                </td>
                <td className="tabular num text-[var(--muted)]">
                  {formatPercent(line.vatRate)}
                </td>
                <td className="tabular num font-medium">
                  {formatCurrency(line.lineTotal, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Los totales van abajo a la derecha, como en el papel; si no hay notas,
          el hueco de la izquierda se queda vacío a propósito. */}
      <div className="grid gap-6 lg:grid-cols-2">
        {invoice.notes && (
          <div className="card p-6">
            <h2 className="eyebrow mb-3">Notas</h2>
            <p className="whitespace-pre-line text-sm">{invoice.notes}</p>
          </div>
        )}

        <div className="card p-6 lg:col-start-2">
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
      <h2 className="eyebrow mb-3">{title}</h2>
      <p className="font-medium">{name}</p>
      <p className="tabular mt-0.5 text-sm text-[var(--muted)]">{taxId}</p>
      <p className="mt-2 whitespace-pre-line text-sm text-[var(--muted)]">{address}</p>
      {email && <p className="mt-0.5 text-sm text-[var(--muted)]">{email}</p>}
    </div>
  );
}
