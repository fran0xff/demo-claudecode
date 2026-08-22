"use client";

import { useActionState } from "react";
import { deleteUserAction } from "@/lib/api/user-client";

type Props = {
  userId: string;
  /** Cómo nombrar lo que se borra: "el usuario correo@ejemplo.com". */
  confirmLabel: string;
};

/**
 * Borrar un usuario no se deshace, así que pedimos confirmación explícita.
 * Mismo patrón que `DeleteInvoiceButton`.
 */
export function DeleteUserButton({ userId, confirmLabel }: Props) {
  const [message, formAction, pending] = useActionState(deleteUserAction, null);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `¿Eliminar ${confirmLabel}? Esta acción no se puede deshacer.`,
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={userId} />
      <button
        type="submit"
        disabled={pending}
        className="btn px-3 py-1 text-xs border border-[var(--border)] text-[var(--danger)] transition hover:border-[var(--danger)] hover:bg-[var(--danger-soft)]"
      >
        {pending ? "Eliminando…" : "Eliminar"}
      </button>
      {message && <p className="error-text mt-1">{message}</p>}
    </form>
  );
}
