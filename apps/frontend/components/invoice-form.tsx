"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { FormField } from "@/components/form-field";
import { InvoiceLineRow } from "@/components/invoice-line-row";
import { InvoiceTotals } from "@/components/invoice-totals";
import { useInvoiceLines } from "@/hooks/use-invoice-lines";
import { parseAmountInput, toDateInputValue } from "@/lib/format";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form-state";
import { computeInvoiceTotals, formatInvoiceNumber } from "@facturas/shared/invoice-math";
import type { InvoiceDTO, SettingsDTO } from "@facturas/shared/dto";

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

export function InvoiceForm({ action, settings, today, invoice }: Props) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const { lines, updateLine, addLine, removeLine } = useInvoiceLines(
    invoice?.lines,
    settings.defaultVatRate,
  );
  const [irpfRate, setIrpfRate] = useState(String(invoice?.irpfRate ?? 0));

  // Controlados (en vez de `defaultValue`) para sobrevivir al fallo de
  // validación: tras cualquier `action` de formulario que resuelve sin lanzar
  // -éxito o error de Zod por igual-, React 19 resetea los campos no
  // controlados de un `<form action={fn}>` a su `defaultValue` de montaje. Con
  // `defaultValue` (como estaban antes) eso vaciaba nombre, NIF, dirección,
  // notas, etc. cada vez que el servidor devolvía un error de validación. Al
  // controlarlos, React reafirma su `value` en cada render y el reseteo no
  // llega a verse.
  const [series, setSeries] = useState(invoice ? invoice.series : settings.defaultSeries);
  const [issueDate, setIssueDate] = useState(
    invoice ? toDateInputValue(invoice.issueDate) : today,
  );
  const [dueDate, setDueDate] = useState(
    invoice?.dueDate ? toDateInputValue(invoice.dueDate) : "",
  );
  const [clientName, setClientName] = useState(invoice?.clientName ?? "");
  const [clientTaxId, setClientTaxId] = useState(invoice?.clientTaxId ?? "");
  const [clientAddress, setClientAddress] = useState(invoice?.clientAddress ?? "");
  const [clientEmail, setClientEmail] = useState(invoice?.clientEmail ?? "");
  const [notes, setNotes] = useState(invoice?.notes ?? "");

  // Previsualizado en vivo. El servidor recalcula al guardar y es quien manda.
  const totals = useMemo(
    () =>
      computeInvoiceTotals(
        lines.map((line) => ({
          quantity: parseAmountInput(line.quantity),
          unitPrice: parseAmountInput(line.unitPrice),
          vatRate: parseAmountInput(line.vatRate),
          discountPct: parseAmountInput(line.discountPct),
        })),
        parseAmountInput(irpfRate),
      ),
    [lines, irpfRate],
  );

  const error = (field: string) => state.errors[field];

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <p className="rounded-md bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
          {state.message}
        </p>
      )}

      <section className="card p-5">
        <SectionTitle>Datos de la factura</SectionTitle>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField htmlFor="series" label="Serie" error={error("series")}>
            {invoice && invoice.number !== null ? (
              // Ya emitida: serie, año y correlativo no se tocan. Un borrador
              // todavía no ha gastado número, así que sí puede cambiar de serie.
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
                value={series}
                onChange={(event) => setSeries(event.target.value)}
                maxLength={10}
              />
            )}
          </FormField>

          <FormField htmlFor="issueDate" label="Fecha de emisión" error={error("issueDate")}>
            <input
              id="issueDate"
              name="issueDate"
              type="date"
              className="field"
              value={issueDate}
              onChange={(event) => setIssueDate(event.target.value)}
            />
          </FormField>

          <FormField
            htmlFor="dueDate"
            label="Vencimiento"
            hint="(opcional)"
            error={error("dueDate")}
          >
            <input
              id="dueDate"
              name="dueDate"
              type="date"
              className="field"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </FormField>
        </div>
      </section>

      <section className="card p-5">
        <SectionTitle>Cliente</SectionTitle>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            htmlFor="clientName"
            label="Nombre o razón social"
            error={error("clientName")}
          >
            <input
              id="clientName"
              name="clientName"
              className="field"
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
            />
          </FormField>

          <FormField htmlFor="clientTaxId" label="NIF / CIF" error={error("clientTaxId")}>
            <input
              id="clientTaxId"
              name="clientTaxId"
              className="field"
              placeholder="B12345674"
              value={clientTaxId}
              onChange={(event) => setClientTaxId(event.target.value)}
            />
          </FormField>

          <FormField htmlFor="clientAddress" label="Dirección" error={error("clientAddress")}>
            <textarea
              id="clientAddress"
              name="clientAddress"
              rows={2}
              className="field"
              value={clientAddress}
              onChange={(event) => setClientAddress(event.target.value)}
            />
          </FormField>

          <FormField
            htmlFor="clientEmail"
            label="Email"
            hint="(opcional)"
            error={error("clientEmail")}
          >
            <input
              id="clientEmail"
              name="clientEmail"
              type="email"
              className="field"
              value={clientEmail}
              onChange={(event) => setClientEmail(event.target.value)}
            />
          </FormField>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="eyebrow">Líneas</h2>
          <button type="button" onClick={addLine} className="btn-secondary">
            Añadir línea
          </button>
        </div>

        {error("lines") && <p className="error-text mb-3">{error("lines")}</p>}

        <div className="line-rows overflow-hidden rounded border border-[var(--border)]">
          {lines.map((line, index) => (
            <InvoiceLineRow
              key={line.key}
              line={line}
              index={index}
              lineTotal={totals.lineTotals[index] ?? 0}
              showLabels={index === 0}
              canRemove={lines.length > 1}
              errors={state.errors}
              onChange={updateLine}
              onRemove={removeLine}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4 p-5">
          <FormField htmlFor="irpfRate" label="Retención IRPF (%)" error={error("irpfRate")}>
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
          </FormField>

          <FormField htmlFor="notes" label="Notas" hint="(opcional)" error={error("notes")}>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="field"
              placeholder="Forma de pago, número de cuenta, condiciones…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </FormField>
        </div>

        <div className="card p-5">
          <SectionTitle>Resumen</SectionTitle>
          <InvoiceTotals
            vatBreakdown={totals.vatBreakdown}
            subtotal={totals.subtotal}
            taxTotal={totals.taxTotal}
            irpfRate={parseAmountInput(irpfRate)}
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="eyebrow mb-4">{children}</h2>;
}
