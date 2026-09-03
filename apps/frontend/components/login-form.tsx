"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/api/auth-client";
import { FormField } from "@/components/form-field";
import { EMPTY_FORM_STATE } from "@/lib/form-state";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, EMPTY_FORM_STATE);
  const error = (field: string) => state.errors[field];

  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <p className="rounded-md border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-3 text-sm">
          {state.message}
        </p>
      )}

      <FormField htmlFor="email" label="Email" error={error("email")}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="correo@ejemplo.com"
          className="field"
          required
        />
      </FormField>

      <FormField htmlFor="password" label="Contraseña" error={error("password")}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Contraseña"
          className="field"
          required
        />
      </FormField>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
