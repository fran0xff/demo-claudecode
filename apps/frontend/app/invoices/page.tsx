import Link from "next/link";
import { Flash } from "@/components/flash";
import { InvoiceNumber } from "@/components/invoice-number";
import { InvoiceStatusControl } from "@/components/invoice-status-control";
import { Pagination } from "@/components/pagination";
import { formatCurrency, formatDate } from "@/lib/format";
import { isOverdue } from "@facturas/shared/invoice-status";
import { getSettings, listInvoices, nextInvoiceNumber } from "@/lib/backend";

export const metadata = { title: "Facturas" };

// El listado sale de la base de datos: se rehace en cada petición en vez de
// quedarse congelado en el build.
export const dynamic = "force-dynamic";

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const query = await searchParams;
  const requestedPage = Number(query.page) || 1;
  const search = typeof query.q === "string" && query.q.trim() ? query.q.trim() : undefined;

  const [invoicePage, settings] = await Promise.all([
    listInvoices(requestedPage, search),
    getSettings(),
  ]);
  const { items: invoices, page, totalPages, total, draftsTotal } = invoicePage;
  const issued = total - draftsTotal;
  const issuerConfigured = Boolean(settings.issuerName && settings.issuerTaxId);

  const year = new Date().getFullYear();
  const nextNumber = await nextInvoiceNumber(settings.defaultSeries, year);

  return (
    <>
      <Flash />

      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Facturas</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {total > 0 && (
                <>
                  {draftsTotal > 0 &&
                    `${draftsTotal} ${draftsTotal === 1 ? "borrador" : "borradores"}`}
                  {draftsTotal > 0 && issued > 0 && " · "}
                  {issued > 0 && `${issued} ${issued === 1 ? "emitida" : "emitidas"}`}
                  {". "}
                </>
              )}
              La siguiente que emitas llevará el número{" "}
              <InvoiceNumber
                series={settings.defaultSeries}
                year={year}
                number={nextNumber}
                className="text-[var(--foreground)]"
              />
              .
            </p>
          </div>
          {(search || total > 0) && (
            <Link href="/invoices/new" className="btn-primary">
              Nueva factura
            </Link>
          )}
        </div>

        <form action="/invoices" method="get" role="search" className="flex items-center gap-3">
          <input
            type="search"
            name="q"
            defaultValue={search ?? ""}
            placeholder="Buscar por cliente o por el texto de un ítem…"
            aria-label="Buscar facturas"
            className="field max-w-sm"
          />
          <button type="submit" className="btn-secondary shrink-0">
            Buscar
          </button>
          {search && (
            <Link
              href="/invoices"
              className="text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              Limpiar
            </Link>
          )}
        </form>

        {!issuerConfigured && (
          <p className="card border-[var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3 text-sm">
            Falta el emisor. Completa tu nombre y NIF en{" "}
            <Link href="/settings" className="font-medium text-[var(--accent)] underline">
              Ajustes
            </Link>{" "}
            antes de emitir.
          </p>
        )}

        {total === 0 && search ? (
          <div className="card px-6 py-16 text-center">
            <p className="text-base font-medium">Sin resultados para «{search}».</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">
              Prueba con otro nombre de cliente o con el texto de una línea.
            </p>
            <Link href="/invoices" className="btn-secondary mt-6">
              Limpiar búsqueda
            </Link>
          </div>
        ) : total === 0 ? (
          <div className="card px-6 py-16 text-center">
            <p className="text-base font-medium">Aquí irán tus facturas.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">
              Se crean como borrador y reciben su número al emitirlas, correlativo dentro
              de su serie y su año.
            </p>
            <Link href="/invoices/new" className="btn-primary mt-6">
              Nueva factura
            </Link>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="ledger ledger-rows min-w-[52rem] text-sm">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th className="num">Total</th>
                  <th className="num">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="transition-colors">
                    <td>
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="text-[var(--accent)] hover:underline"
                      >
                        {invoice.number === null ? (
                          <span className="text-[var(--muted)]">Borrador</span>
                        ) : (
                          <InvoiceNumber
                            series={invoice.series}
                            year={invoice.year}
                            number={invoice.number}
                          />
                        )}
                      </Link>
                    </td>

                    <td>
                      <div className="flex items-center gap-2">
                        <InvoiceStatusControl
                          invoiceId={invoice.id}
                          status={invoice.status}
                        />
                        {isOverdue(invoice.status, invoice.dueDate) && (
                          <span className="badge-vencida" title="La fecha de vencimiento ya pasó">
                            Vencida
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="tabular text-[var(--muted)]">
                      {formatDate(invoice.issueDate)}
                    </td>
                    <td>{invoice.clientName}</td>
                    <td className="tabular num text-[0.9375rem] font-semibold">
                      {formatCurrency(invoice.total, invoice.currency)}
                    </td>

                    <td className="num">
                      <span className="inline-flex items-center gap-3 text-sm">
                        <Link
                          href={`/invoices/${invoice.id}/edit`}
                          className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
                        >
                          Editar
                        </Link>
                        <Link
                          href={`/invoices/${invoice.id}?imprimir=1`}
                          title="Abre el diálogo de impresión: elige «Guardar como PDF»"
                          className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
                        >
                          PDF
                        </Link>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          basePath="/invoices"
          page={page}
          totalPages={totalPages}
          extraParams={{ q: search }}
        />
      </div>
    </>
  );
}
