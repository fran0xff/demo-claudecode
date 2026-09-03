import { FiltersSidebarToggle } from "@/components/filters-sidebar-toggle";
import { INVOICE_STATUSES, STATUS_LABELS } from "@facturas/shared/invoice-status";

type Props = {
  dateFrom?: string;
  dateTo?: string;
  minTotal?: string;
  maxTotal?: string;
  statuses: string[];
};

/**
 * Server Component: los campos son parte del mismo `<form method="get">` que
 * envuelve toda la pantalla de facturas (ver `app/invoices/page.tsx`), así
 * que "aplicar filtros" es una navegación normal, sin JavaScript. Lo único
 * de cliente es `FiltersSidebarToggle`, que solo decide si el cuerpo se ve.
 */
export function InvoicesFiltersSidebar({ dateFrom, dateTo, minTotal, maxTotal, statuses }: Props) {
  return (
    <aside id="filtros-facturas" className="filters-sidebar no-print w-full shrink-0 lg:w-56">
      <div className="flex items-center justify-between">
        <h2 className="eyebrow">Filtros</h2>
        <FiltersSidebarToggle />
      </div>

      <div className="filters-sidebar-body mt-4 space-y-6">
        <fieldset className="space-y-2">
          <legend className="label">Fecha de emisión</legend>
          <label className="block text-xs text-[var(--muted)]" htmlFor="dateFrom">
            Desde
          </label>
          <input
            id="dateFrom"
            name="dateFrom"
            type="date"
            defaultValue={dateFrom ?? ""}
            className="field"
          />
          <label className="block text-xs text-[var(--muted)]" htmlFor="dateTo">
            Hasta
          </label>
          <input id="dateTo" name="dateTo" type="date" defaultValue={dateTo ?? ""} className="field" />
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="label">Importe</legend>
          <label className="block text-xs text-[var(--muted)]" htmlFor="minTotal">
            Mínimo
          </label>
          <input
            id="minTotal"
            name="minTotal"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={minTotal ?? ""}
            className="field"
          />
          <label className="block text-xs text-[var(--muted)]" htmlFor="maxTotal">
            Máximo
          </label>
          <input
            id="maxTotal"
            name="maxTotal"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="Sin límite"
            defaultValue={maxTotal ?? ""}
            className="field"
          />
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="label">Estado</legend>
          {INVOICE_STATUSES.map((status) => (
            <label key={status} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="status"
                value={status}
                defaultChecked={statuses.includes(status)}
                className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
              />
              {STATUS_LABELS[status]}
            </label>
          ))}
        </fieldset>

        <button type="submit" className="btn-primary w-full">
          Aplicar filtros
        </button>
      </div>
    </aside>
  );
}
