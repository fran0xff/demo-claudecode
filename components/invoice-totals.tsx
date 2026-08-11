import type { VatBreakdownEntry } from "@/lib/invoice-math";
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
    <dl className="tabular space-y-2 text-sm">
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

      <div className="flex items-baseline justify-between border-t border-[var(--border)] pt-2">
        <dt className="text-base font-semibold">Total</dt>
        <dd className="text-lg font-semibold">{formatCurrency(total, currency)}</dd>
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
      className={`flex items-baseline justify-between gap-4 ${
        muted ? "text-[var(--muted)]" : ""
      }`}
    >
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
