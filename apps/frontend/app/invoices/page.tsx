import Link from "next/link";
import { Flash } from "@/components/flash";
import { InvoiceNumber } from "@/components/invoice-number";
import { InvoiceStatusControl } from "@/components/invoice-status-control";
import { InvoicesFiltersSidebar } from "@/components/invoices-filters-sidebar";
import { Pagination } from "@/components/pagination";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatInvoiceNumber } from "@facturas/shared/invoice-math";
import { isOverdue } from "@facturas/shared/invoice-status";
import { getSettings, listInvoices, nextInvoiceNumber } from "@/lib/backend";

export const metadata = { title: "Facturas" };

// El listado sale de la base de datos: se rehace en cada petición en vez de
// quedarse congelado en el build.
export const dynamic = "force-dynamic";

function asString(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const query = await searchParams;
  const requestedPage = Number(query.page) || 1;

  const search = asString(query.q);
  const dateFrom = asString(query.dateFrom);
  const dateTo = asString(query.dateTo);
  const minTotal = asString(query.minTotal);
  const maxTotal = asString(query.maxTotal);
  const statuses = asList(query.status);

  const hasActiveFilters = Boolean(
    search || dateFrom || dateTo || minTotal || maxTotal || statuses.length > 0,
  );

  const [invoicePage, settings] = await Promise.all([
    listInvoices(requestedPage, { search, dateFrom, dateTo, minTotal, maxTotal, statuses }),
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
          {(hasActiveFilters || total > 0) && (
            <Link href="/invoices/new" className="btn-primary">
              Nueva factura
            </Link>
          )}
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* `display: contents` (`.contents`): el <form> no puede envolver la
              tabla de abajo (cada fila trae su propio <form> para el estado, y
              HTML no admite <form> anidado), así que solo envuelve la barra
              lateral, sin generar caja propia en el flex — el buscador de la
              derecha se asocia con `form="filtros-facturas-form"` en vez de
              vivir dentro. */}
          <form
            id="filtros-facturas-form"
            action="/invoices"
            method="get"
            className="contents"
          >
            <InvoicesFiltersSidebar
              dateFrom={dateFrom}
              dateTo={dateTo}
              minTotal={minTotal}
              maxTotal={maxTotal}
              statuses={statuses}
            />
          </form>

          <div className="min-w-0 flex-1 space-y-6">
            <div role="search" className="flex items-center gap-3">
              <input
                type="search"
                name="q"
                form="filtros-facturas-form"
                defaultValue={search ?? ""}
                placeholder="Buscar por cliente o por el texto de un ítem…"
                aria-label="Buscar facturas"
                className="field max-w-sm"
              />
              <button type="submit" form="filtros-facturas-form" className="btn-secondary shrink-0">
                Buscar
              </button>
              {hasActiveFilters && (
                <Link
                  href="/invoices"
                  className="text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]"
                >
                  Limpiar filtros
                </Link>
              )}
            </div>

            {!issuerConfigured && (
              <p className="card border-[var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3 text-sm">
                Falta el emisor. Completa tu nombre y NIF en{" "}
                <Link href="/settings" className="font-medium text-[var(--accent)] underline">
                  Ajustes
                </Link>{" "}
                antes de emitir.
              </p>
            )}

            {total === 0 && hasActiveFilters ? (
              <div className="card px-6 py-16 text-center">
                <p className="text-base font-medium">
                  {search ? `Sin resultados para «${search}».` : "Sin resultados con estos filtros."}
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">
                  Prueba con otro cliente, otro texto de línea o un rango distinto.
                </p>
                <Link href="/invoices" className="btn-secondary mt-6">
                  Limpiar filtros
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
              <div className="card max-h-[70vh] overflow-y-auto overflow-x-hidden">
                <table className="ledger ledger-rows w-full table-fixed text-sm">
                  <thead className="sticky top-0 z-10 bg-[var(--surface)]">
                    <tr>
                      <th className="w-[14%]">Número</th>
                      <th className="w-[20%]">Estado</th>
                      <th className="w-[13%]">Fecha</th>
                      <th className="w-[27%]">Cliente</th>
                      <th className="num w-[13%]">Total</th>
                      <th className="num w-[13%]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="transition-colors">
                        <td
                          className="truncate"
                          title={
                            invoice.number === null
                              ? "Borrador"
                              : formatInvoiceNumber(invoice.series, invoice.year, invoice.number)
                          }
                        >
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
                          <div className="flex flex-wrap items-center gap-2">
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

                        <td className="tabular whitespace-nowrap text-[var(--muted)]">
                          {formatDate(invoice.issueDate)}
                        </td>
                        <td className="truncate" title={invoice.clientName}>
                          {invoice.clientName}
                        </td>
                        <td className="tabular num whitespace-nowrap text-[0.9375rem] font-semibold">
                          {formatCurrency(invoice.total, invoice.currency)}
                        </td>

                        <td className="num whitespace-nowrap">
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
              extraParams={{ q: search, dateFrom, dateTo, minTotal, maxTotal, status: statuses }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
