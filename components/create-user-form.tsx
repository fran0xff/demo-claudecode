"use client";

import { useActionState } from "react";
import { createUserAction } from "@/lib/api/user-client";
import { FormField } from "@/components/form-field";
import { EMPTY_FORM_STATE } from "@/lib/form-state";

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, EMPTY_FORM_STATE);
  const error = (field: string) => state.errors[field];

  return (
    <form action={formAction} className="space-y-4">
      {state.message && <p className="error-text">{state.message}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField htmlFor="email" label="Email" error={error("email")}>
          <input id="email" name="email" type="email" autoComplete="email" className="field" required />
        </FormField>

        <FormField htmlFor="password" label="Contraseña" error={error("password")}>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            className="field"
            required
          />
        </FormField>

        <FormField
          htmlFor="confirmPassword"
          label="Confirmar contraseña"
          error={error("confirmPassword")}
        >
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            className="field"
            required
          />
        </FormField>
      </div>

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Creando…" : "Crear usuario"}
      </button>
    </form>
  );
}
