"use client";

import type { ReactNode } from "react";
import type { LineState } from "@/hooks/use-invoice-lines";
import { formatCurrency } from "@/lib/format";
import { VAT_RATES } from "@facturas/shared/invoice-math";

type Props = {
  line: LineState;
  index: number;
  /** Base imponible ya calculada; la fila solo la muestra. */
  lineTotal: number;
  /** Solo la primera fila pinta las etiquetas: hacen de cabecera de columna. */
  showLabels: boolean;
  /** Falso cuando es la única línea: una factura necesita al menos una. */
  canRemove: boolean;
  /** Errores de Zod de todo el formulario, con la ruta `lines.N.campo`. */
  errors: Record<string, string>;
  onChange: (index: number, patch: Partial<LineState>) => void;
  onRemove: (index: number) => void;
};

/**
 * Una línea del formulario de factura.
 *
 * El `name` de cada input (`lines.0.quantity`) es un contrato con
 * `parseInvoiceForm` de la Server Action y con las rutas de error de Zod. Por eso
 * el nombre y la búsqueda del error se construyen aquí, juntos: si cambia el
 * patrón, cambia en un solo sitio de este lado.
 */
export function InvoiceLineRow({
  line,
  index,
  lineTotal,
  showLabels,
  canRemove,
  errors,
  onChange,
  onRemove,
}: Props) {
  const name = (field: keyof LineState) => `lines.${index}.${field}`;
  const error = (field: keyof LineState) => errors[name(field)];

  return (
    <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_5rem_6rem_7rem_2rem] sm:items-start">
      <LineField label="Descripción" showLabel={showLabels} error={error("description")}>
        <input
          name={name("description")}
          aria-label={`Descripción de la línea ${index + 1}`}
          className="field"
          value={line.description}
          onChange={(event) => onChange(index, { description: event.target.value })}
        />
      </LineField>

      <LineField label="Cantidad" showLabel={showLabels} error={error("quantity")}>
        <input
          name={name("quantity")}
          aria-label={`Cantidad de la línea ${index + 1}`}
          type="number"
          step="any"
          min="0"
          className="field tabular text-right"
          value={line.quantity}
          onChange={(event) => onChange(index, { quantity: event.target.value })}
        />
      </LineField>

      <LineField label="Precio" showLabel={showLabels} error={error("unitPrice")}>
        <input
          name={name("unitPrice")}
          aria-label={`Precio unitario de la línea ${index + 1}`}
          type="number"
          step="any"
          min="0"
          className="field tabular text-right"
          value={line.unitPrice}
          onChange={(event) => onChange(index, { unitPrice: event.target.value })}
        />
      </LineField>

      <LineField label="Dto. %" showLabel={showLabels} error={error("discountPct")}>
        <input
          name={name("discountPct")}
          aria-label={`Descuento en porcentaje de la línea ${index + 1}`}
          type="number"
          step="any"
          min="0"
          max="100"
          className="field tabular text-right"
          value={line.discountPct}
          onChange={(event) => onChange(index, { discountPct: event.target.value })}
        />
      </LineField>

      <LineField label="IVA" showLabel={showLabels} error={error("vatRate")}>
        <select
          name={name("vatRate")}
          aria-label={`Tipo de IVA de la línea ${index + 1}`}
          className="field tabular"
          value={line.vatRate}
          onChange={(event) => onChange(index, { vatRate: event.target.value })}
        >
          {VAT_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate} %
            </option>
          ))}
        </select>
      </LineField>

      <LineField label="Importe" showLabel={showLabels}>
        <p className="tabular px-3 py-2 text-right text-sm">{formatCurrency(lineTotal)}</p>
      </LineField>

      <div className={showLabels ? "sm:pt-[1.375rem]" : ""}>
        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
          aria-label={`Eliminar línea ${index + 1}`}
          title={canRemove ? "Eliminar línea" : "La factura necesita al menos una línea"}
          className="w-full rounded-md px-2 py-2 text-sm text-[var(--muted)] transition hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function LineField({
  label,
  showLabel,
  error,
  children,
}: {
  label: string;
  showLabel: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {/* La etiqueta solo se pinta en la primera línea (hace de cabecera de
          columna), pero se mantiene accesible en el resto. */}
      <span className={showLabel ? "label" : "sr-only"}>{label}</span>
      {children}
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}
