"use client";

import { useActionState, useState } from "react";
import { changePasswordAction } from "@/lib/api/user-client";
import { EMPTY_FORM_STATE } from "@/lib/form-state";

type Props = {
  userId: string;
};

/**
 * Colapsado por defecto: un botón por fila, para no llenar la tabla de
 * campos de contraseña a la vista de todos. Al pulsarlo se despliegan los
 * dos campos. No redirige ni navega (ver `changePasswordAction`), así que
 * `state.message` sirve tanto para el éxito como para el error: mismo
 * comportamiento que `SettingsForm`.
 */
export function ChangePasswordForm({ userId }: Props) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(changePasswordAction, EMPTY_FORM_STATE);
  const error = (field: string) => state.errors[field];

  if (!open) {
    return (
      <button
        type="button"
        className="btn px-3 py-1 text-xs border border-[var(--border)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        onClick={() => setOpen(true)}
      >
        Cambiar contraseña
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-start gap-2">
      <input type="hidden" name="id" value={userId} />

      <div>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Contraseña nueva"
          aria-label="Contraseña nueva"
          className="field text-sm"
          required
        />
        {error("password") && <span className="error-text">{error("password")}</span>}
      </div>

      <div>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Confirmar"
          aria-label="Confirmar contraseña nueva"
          className="field text-sm"
          required
        />
        {error("confirmPassword") && <span className="error-text">{error("confirmPassword")}</span>}
      </div>

      <button type="submit" className="btn-primary px-3 py-1 text-xs" disabled={pending}>
        {pending ? "Cambiando…" : "Guardar"}
      </button>
      <button
        type="button"
        className="btn px-3 py-1 text-xs border border-[var(--border)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        onClick={() => setOpen(false)}
      >
        Cancelar
      </button>

      {state.message && <span className="text-xs text-[var(--muted)]">{state.message}</span>}
    </form>
  );
}
