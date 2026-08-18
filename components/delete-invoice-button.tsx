"use client";

import { useFormStatus } from "react-dom";
import { deleteInvoice } from "@/app/invoices/actions";

type Props = {
  invoiceId: string;
  /** Cómo nombrar lo que se borra: "la factura A-2026-0001" o "este borrador". */
  confirmLabel: string;
};

/** Borrar una factura no se deshace, así que pedimos confirmación explícita. */
export function DeleteInvoiceButton({ invoiceId, confirmLabel }: Props) {
  return (
    <form
      className="no-print"
      action={deleteInvoice}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `¿Eliminar ${confirmLabel}? Esta acción no se puede deshacer.`,
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={invoiceId} />
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn border border-[var(--border)] text-[var(--danger)] transition hover:border-[var(--danger)] hover:bg-[var(--danger-soft)]"
    >
      {pending ? "Eliminando…" : "Eliminar"}
    </button>
  );
}
