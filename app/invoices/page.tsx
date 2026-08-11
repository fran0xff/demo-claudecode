import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatInvoiceNumber } from "@/lib/invoice-math";
import { getSettings, listInvoices } from "@/lib/invoices";

export const metadata = { title: "Facturas" };

// El listado sale de la base de datos: se rehace en cada petición en vez de
// quedarse congelado en el build.
export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const [invoices, settings] = await Promise.all([listInvoices(), getSettings()]);
  const issuerConfigured = Boolean(settings.issuerName && settings.issuerTaxId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Facturas</h1>
          <p className="text-sm text-[var(--muted)]">
            {invoices.length === 0
              ? "Todavía no has emitido ninguna factura."
              : `${invoices.length} ${invoices.length === 1 ? "factura emitida" : "facturas emitidas"}.`}
          </p>
        </div>
        <Link href="/invoices/new" className="btn-primary">
          Nueva factura
        </Link>
      </div>

      {!issuerConfigured && (
        <p className="rounded-md border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-3 text-sm">
          Antes de emitir facturas, completa los datos del emisor en{" "}
          <Link href="/settings" className="font-medium underline">
            Ajustes
          </Link>
          .
        </p>
      )}

      {invoices.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-[var(--muted)]">
            Cuando crees tu primera factura aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="px-4 py-3 font-medium">Número</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--accent-soft)]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="tabular font-medium text-[var(--accent)] hover:underline"
                    >
                      {formatInvoiceNumber(invoice.series, invoice.year, invoice.number)}
                    </Link>
                  </td>
                  <td className="tabular px-4 py-3 text-[var(--muted)]">
                    {formatDate(invoice.issueDate)}
                  </td>
                  <td className="px-4 py-3">{invoice.clientName}</td>
                  <td className="tabular px-4 py-3 text-right font-medium">
                    {formatCurrency(invoice.total, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
