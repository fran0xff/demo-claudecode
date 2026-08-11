"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState } from "react";
import { InvoiceTotals } from "@/components/invoice-totals";
import { formatCurrency, toDateInputValue } from "@/lib/format";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form-state";
import { computeInvoiceTotals, formatInvoiceNumber, VAT_RATES } from "@/lib/invoice-math";
import type { InvoiceDTO, SettingsDTO } from "@/lib/invoices";

type LineState = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
  discountPct: string;
};

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  settings: SettingsDTO;
  /**
   * Fecha de hoy en formato "YYYY-MM-DD", calculada en el servidor. Si la
   * calculásemos aquí durante el render, el servidor y el navegador podrían
   * discrepar (zona horaria, cambio de día) y romper la hidratación.
   */
  today: string;
  /** Presente al editar; ausente al crear. */
  invoice?: InvoiceDTO;
};

/** Lo que teclea el usuario es texto; para el previsualizado vale 0 si no cuadra. */
function toNumber(value: string): number {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyLine(key: string, vatRate: number): LineState {
  return {
    key,
    description: "",
    quantity: "1",
    unitPrice: "",
    vatRate: String(vatRate),
    discountPct: "0",
  };
}

export function InvoiceForm({ action, settings, today, invoice }: Props) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const [lines, setLines] = useState<LineState[]>(() => {
    if (invoice) {
      return invoice.lines.map((line, index) => ({
        key: `line-${index}`,
        description: line.description,
        quantity: String(line.quantity),
        unitPrice: String(line.unitPrice),
        vatRate: String(line.vatRate),
        discountPct: String(line.discountPct),
      }));
    }
    return [emptyLine("line-0", settings.defaultVatRate)];
  });

  // Contador para las claves de React de las líneas nuevas. Arranca detrás de
  // las que ya existen y solo se incrementa en el manejador de "Añadir línea",
  // nunca durante el render.
  const nextKey = useRef(invoice ? invoice.lines.length : 1);

  const [irpfRate, setIrpfRate] = useState(String(invoice?.irpfRate ?? 0));

  // El servidor recalcula y es quien manda; esto es solo el previsualizado.
  const totals = useMemo(
    () =>
      computeInvoiceTotals(
        lines.map((line) => ({
          quantity: toNumber(line.quantity),
          unitPrice: toNumber(line.unitPrice),
          vatRate: toNumber(line.vatRate),
          discountPct: toNumber(line.discountPct),
        })),
        toNumber(irpfRate),
      ),
    [lines, irpfRate],
  );

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((current) => [
      ...current,
      emptyLine(`line-${nextKey.current++}`, settings.defaultVatRate),
    ]);
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, i) => i !== index));
  }

  const error = (field: string) => state.errors[field];

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <p className="rounded-md bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
          {state.message}
        </p>
      )}

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Datos de la factura
        </h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="series">
              Serie
            </label>
            {invoice ? (
              // Una factura emitida no cambia de número: serie, año y
              // correlativo quedan fijos tras crearla.
              <>
                <input type="hidden" name="series" value={invoice.series} />
                <p className="tabular field bg-transparent text-[var(--muted)]">
                  {formatInvoiceNumber(invoice.series, invoice.year, invoice.number)}
                </p>
              </>
            ) : (
              <input
                id="series"
                name="series"
                className="field"
                defaultValue={settings.defaultSeries}
                maxLength={10}
              />
            )}
            {error("series") && <span className="error-text">{error("series")}</span>}
          </div>

          <div>
            <label className="label" htmlFor="issueDate">
              Fecha de emisión
            </label>
            <input
              id="issueDate"
              name="issueDate"
              type="date"
              className="field"
              defaultValue={invoice ? toDateInputValue(invoice.issueDate) : today}
            />
            {error("issueDate") && <span className="error-text">{error("issueDate")}</span>}
          </div>

          <div>
            <label className="label" htmlFor="dueDate">
              Vencimiento <span className="font-normal">(opcional)</span>
            </label>
            <input
              id="dueDate"
              name="dueDate"
              type="date"
              className="field"
              defaultValue={invoice?.dueDate ? toDateInputValue(invoice.dueDate) : ""}
            />
            {error("dueDate") && <span className="error-text">{error("dueDate")}</span>}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Cliente
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="clientName">
              Nombre o razón social
            </label>
            <input
              id="clientName"
              name="clientName"
              className="field"
              defaultValue={invoice?.clientName ?? ""}
            />
            {error("clientName") && <span className="error-text">{error("clientName")}</span>}
          </div>

          <div>
            <label className="label" htmlFor="clientTaxId">
              NIF / CIF
            </label>
            <input
              id="clientTaxId"
              name="clientTaxId"
              className="field"
              placeholder="B12345674"
              defaultValue={invoice?.clientTaxId ?? ""}
            />
            {error("clientTaxId") && <span className="error-text">{error("clientTaxId")}</span>}
          </div>

          <div>
            <label className="label" htmlFor="clientAddress">
              Dirección
            </label>
            <textarea
              id="clientAddress"
              name="clientAddress"
              rows={2}
              className="field"
              defaultValue={invoice?.clientAddress ?? ""}
            />
            {error("clientAddress") && (
              <span className="error-text">{error("clientAddress")}</span>
            )}
          </div>

          <div>
            <label className="label" htmlFor="clientEmail">
              Email <span className="font-normal">(opcional)</span>
            </label>
            <input
              id="clientEmail"
              name="clientEmail"
              type="email"
              className="field"
              defaultValue={invoice?.clientEmail ?? ""}
            />
            {error("clientEmail") && <span className="error-text">{error("clientEmail")}</span>}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Líneas
          </h2>
          <button type="button" onClick={addLine} className="btn-secondary">
            Añadir línea
          </button>
        </div>

        {error("lines") && <p className="error-text mb-3">{error("lines")}</p>}

        <div className="space-y-3">
          {lines.map((line, index) => (
            <div
              key={line.key}
              className="grid gap-3 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_5rem_6rem_7rem_2rem] sm:items-start"
            >
              <LineField
                label="Descripción"
                showLabel={index === 0}
                error={error(`lines.${index}.description`)}
              >
                <input
                  name={`lines.${index}.description`}
                  aria-label={`Descripción de la línea ${index + 1}`}
                  className="field"
                  value={line.description}
                  onChange={(event) => updateLine(index, { description: event.target.value })}
                />
              </LineField>

              <LineField
                label="Cantidad"
                showLabel={index === 0}
                error={error(`lines.${index}.quantity`)}
              >
                <input
                  name={`lines.${index}.quantity`}
                  aria-label={`Cantidad de la línea ${index + 1}`}
                  type="number"
                  step="any"
                  min="0"
                  className="field tabular text-right"
                  value={line.quantity}
                  onChange={(event) => updateLine(index, { quantity: event.target.value })}
                />
              </LineField>

              <LineField
                label="Precio"
                showLabel={index === 0}
                error={error(`lines.${index}.unitPrice`)}
              >
                <input
                  name={`lines.${index}.unitPrice`}
                  aria-label={`Precio unitario de la línea ${index + 1}`}
                  type="number"
                  step="any"
                  min="0"
                  className="field tabular text-right"
                  value={line.unitPrice}
                  onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
                />
              </LineField>

              <LineField
                label="Dto. %"
                showLabel={index === 0}
                error={error(`lines.${index}.discountPct`)}
              >
                <input
                  name={`lines.${index}.discountPct`}
                  aria-label={`Descuento en porcentaje de la línea ${index + 1}`}
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  className="field tabular text-right"
                  value={line.discountPct}
                  onChange={(event) => updateLine(index, { discountPct: event.target.value })}
                />
              </LineField>

              <LineField
                label="IVA"
                showLabel={index === 0}
                error={error(`lines.${index}.vatRate`)}
              >
                <select
                  name={`lines.${index}.vatRate`}
                  aria-label={`Tipo de IVA de la línea ${index + 1}`}
                  className="field tabular"
                  value={line.vatRate}
                  onChange={(event) => updateLine(index, { vatRate: event.target.value })}
                >
                  {VAT_RATES.map((rate) => (
                    <option key={rate} value={rate}>
                      {rate} %
                    </option>
                  ))}
                </select>
              </LineField>

              <LineField label="Importe" showLabel={index === 0}>
                <p className="tabular px-3 py-2 text-right text-sm">
                  {formatCurrency(totals.lineTotals[index] ?? 0)}
                </p>
              </LineField>

              <div className={index === 0 ? "sm:pt-[1.375rem]" : ""}>
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  disabled={lines.length === 1}
                  aria-label={`Eliminar línea ${index + 1}`}
                  title={
                    lines.length === 1
                      ? "La factura necesita al menos una línea"
                      : "Eliminar línea"
                  }
                  className="w-full rounded-md px-2 py-2 text-sm text-[var(--muted)] transition hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4 p-5">
          <div>
            <label className="label" htmlFor="irpfRate">
              Retención IRPF (%)
            </label>
            <input
              id="irpfRate"
              name="irpfRate"
              type="number"
              step="any"
              min="0"
              max="100"
              className="field tabular max-w-32"
              value={irpfRate}
              onChange={(event) => setIrpfRate(event.target.value)}
            />
            {error("irpfRate") && <span className="error-text">{error("irpfRate")}</span>}
          </div>

          <div>
            <label className="label" htmlFor="notes">
              Notas <span className="font-normal">(opcional)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="field"
              placeholder="Forma de pago, número de cuenta, condiciones…"
              defaultValue={invoice?.notes ?? ""}
            />
            {error("notes") && <span className="error-text">{error("notes")}</span>}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Resumen
          </h2>
          <InvoiceTotals
            vatBreakdown={totals.vatBreakdown}
            subtotal={totals.subtotal}
            taxTotal={totals.taxTotal}
            irpfRate={toNumber(irpfRate)}
            irpfTotal={totals.irpfTotal}
            total={totals.total}
            currency={invoice?.currency ?? "EUR"}
          />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Guardando…" : invoice ? "Guardar cambios" : "Crear factura"}
        </button>
        <Link
          href={invoice ? `/invoices/${invoice.id}` : "/invoices"}
          className="btn-secondary"
        >
          Cancelar
        </Link>
      </div>
    </form>
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
  children: React.ReactNode;
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
