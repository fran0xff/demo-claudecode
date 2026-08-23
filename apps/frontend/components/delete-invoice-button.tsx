"use client";

import { useActionState } from "react";
import { deleteInvoiceAction } from "@/lib/api/invoice-client";

type Props = {
  invoiceId: string;
  /** Cómo nombrar lo que se borra: "la factura A-2026-0001" o "este borrador". */
  confirmLabel: string;
};

/**
 * Borrar una factura no se deshace, así que pedimos confirmación explícita.
 *
 * Si el borrado falla (404, 500, red caída), `deleteInvoiceAction` no
 * redirige: hacerlo igualmente llevaría al listado dando a entender que se
 * borró cuando la factura sigue ahí. En su lugar devuelve el mensaje de error
 * como el estado de `useActionState`, para enseñarlo aquí mismo.
 */
export function DeleteInvoiceButton({ invoiceId, confirmLabel }: Props) {
  const [message, formAction, pending] = useActionState(deleteInvoiceAction, null);

  return (
    <form
      className="no-print"
      action={formAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `¿Eliminar ${confirmLabel}? Esta acción no se puede deshacer.`,
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={invoiceId} />
      <button
        type="submit"
        disabled={pending}
        className="btn border border-[var(--border)] text-[var(--danger)] transition hover:border-[var(--danger)] hover:bg-[var(--danger-soft)]"
      >
        {pending ? "Eliminando…" : "Eliminar"}
      </button>
      {message && <p className="error-text mt-1">{message}</p>}
    </form>
  );
}
