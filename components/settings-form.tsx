"use client";

import { useActionState } from "react";
import { saveSettingsAction } from "@/lib/api/settings-client";
import { FormField } from "@/components/form-field";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { VAT_RATES } from "@/lib/invoice-math";
import type { SettingsDTO } from "@/lib/repositories/settings-repository";

export function SettingsForm({ settings }: { settings: SettingsDTO }) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, EMPTY_FORM_STATE);
  const error = (field: string) => state.errors[field];

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <p className="rounded-md border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-3 text-sm">
          {state.message}
        </p>
      )}

      <section className="card space-y-4 p-5">
        <h2 className="eyebrow">Datos del emisor</h2>
        <p className="text-sm text-[var(--muted)]">
          Se copian en cada factura al crearla, así que cambiarlos no afecta a las ya
          emitidas.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            htmlFor="issuerName"
            label="Nombre o razón social"
            error={error("issuerName")}
          >
            <input
              id="issuerName"
              name="issuerName"
              className="field"
              defaultValue={settings.issuerName}
            />
          </FormField>

          <FormField htmlFor="issuerTaxId" label="NIF / CIF" error={error("issuerTaxId")}>
            <input
              id="issuerTaxId"
              name="issuerTaxId"
              className="field"
              placeholder="B12345674"
              defaultValue={settings.issuerTaxId}
            />
          </FormField>

          <FormField
            htmlFor="issuerAddress"
            label="Dirección"
            error={error("issuerAddress")}
            className="sm:col-span-2"
          >
            <textarea
              id="issuerAddress"
              name="issuerAddress"
              rows={2}
              className="field"
              defaultValue={settings.issuerAddress}
            />
          </FormField>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="eyebrow">Valores por defecto</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            htmlFor="defaultSeries"
            label="Serie de numeración"
            error={error("defaultSeries")}
          >
            <input
              id="defaultSeries"
              name="defaultSeries"
              className="field"
              maxLength={10}
              defaultValue={settings.defaultSeries}
            />
          </FormField>

          <FormField
            htmlFor="defaultVatRate"
            label="IVA por defecto"
            error={error("defaultVatRate")}
          >
            <select
              id="defaultVatRate"
              name="defaultVatRate"
              className="field tabular"
              defaultValue={String(settings.defaultVatRate)}
            >
              {VAT_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate} %
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </section>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar ajustes"}
      </button>
    </form>
  );
}
