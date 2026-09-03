import type { VatBreakdownEntry } from "@facturas/shared/invoice-math";
import { formatCurrency, formatPercent } from "@/lib/format";

type Props = {
  vatBreakdown: VatBreakdownEntry[];
  subtotal: number;
  taxTotal: number;
  irpfRate: number;
  irpfTotal: number;
  total: number;
  currency?: string;
};

/**
 * Desglose de importes de una factura. Lo comparten el formulario (con los
 * totales calculados en vivo) y la vista de detalle (con los ya guardados).
 *
 * El total es la respuesta a la que viene el lector, así que es lo único que
 * rompe la escala: el resto del desglose se queda en cuerpo pequeño.
 */
export function InvoiceTotals({
  vatBreakdown,
  subtotal,
  taxTotal,
  irpfRate,
  irpfTotal,
  total,
  currency = "EUR",
}: Props) {
  return (
    <dl className="text-sm">
      <Row label="Base imponible" value={formatCurrency(subtotal, currency)} />

      {vatBreakdown.map((entry) => (
        <Row
          key={entry.vatRate}
          label={`IVA ${formatPercent(entry.vatRate)} sobre ${formatCurrency(entry.base, currency)}`}
          value={formatCurrency(entry.amount, currency)}
          muted
        />
      ))}

      {vatBreakdown.length > 1 && (
        <Row label="Total IVA" value={formatCurrency(taxTotal, currency)} />
      )}

      {irpfRate > 0 && (
        <Row
          label={`Retención IRPF ${formatPercent(irpfRate)}`}
          value={`−${formatCurrency(irpfTotal, currency)}`}
        />
      )}

      <div className="mt-3 flex items-baseline justify-between gap-4 border-t-2 border-[var(--foreground)] pt-3">
        <dt className="eyebrow">Total</dt>
        <dd className="tabular text-2xl font-semibold">{formatCurrency(total, currency)}</dd>
      </div>
    </dl>
  );
}

function Row({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-1 ${
        muted ? "text-[var(--muted)]" : ""
      }`}
    >
      <dt>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}
