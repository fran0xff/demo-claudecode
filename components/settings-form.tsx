"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/settings/actions";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { VAT_RATES } from "@/lib/invoice-math";
import type { SettingsDTO } from "@/lib/invoices";

export function SettingsForm({ settings }: { settings: SettingsDTO }) {
  const [state, formAction, pending] = useActionState(saveSettings, EMPTY_FORM_STATE);
  const error = (field: string) => state.errors[field];

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <p className="rounded-md border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-3 text-sm">
          {state.message}
        </p>
      )}

      <section className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Datos del emisor
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Se copian en cada factura al crearla, así que cambiarlos no afecta a las ya
          emitidas.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="issuerName">
              Nombre o razón social
            </label>
            <input
              id="issuerName"
              name="issuerName"
              className="field"
              defaultValue={settings.issuerName}
            />
            {error("issuerName") && <span className="error-text">{error("issuerName")}</span>}
          </div>

          <div>
            <label className="label" htmlFor="issuerTaxId">
              NIF / CIF
            </label>
            <input
              id="issuerTaxId"
              name="issuerTaxId"
              className="field"
              placeholder="B12345674"
              defaultValue={settings.issuerTaxId}
            />
            {error("issuerTaxId") && <span className="error-text">{error("issuerTaxId")}</span>}
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="issuerAddress">
              Dirección
            </label>
            <textarea
              id="issuerAddress"
              name="issuerAddress"
              rows={2}
              className="field"
              defaultValue={settings.issuerAddress}
            />
            {error("issuerAddress") && (
              <span className="error-text">{error("issuerAddress")}</span>
            )}
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Valores por defecto
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="defaultSeries">
              Serie de numeración
            </label>
            <input
              id="defaultSeries"
              name="defaultSeries"
              className="field"
              maxLength={10}
              defaultValue={settings.defaultSeries}
            />
            {error("defaultSeries") && (
              <span className="error-text">{error("defaultSeries")}</span>
            )}
          </div>

          <div>
            <label className="label" htmlFor="defaultVatRate">
              IVA por defecto
            </label>
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
            {error("defaultVatRate") && (
              <span className="error-text">{error("defaultVatRate")}</span>
            )}
          </div>
        </div>
      </section>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Guardando…" : "Guardar ajustes"}
      </button>
    </form>
  );
}
