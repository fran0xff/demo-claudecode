"use client";

import { useFormStatus } from "react-dom";
import { deleteInvoice } from "@/app/invoices/actions";

type Props = {
  invoiceId: string;
  invoiceNumber: string;
};

/** Borrar una factura no se deshace, así que pedimos confirmación explícita. */
export function DeleteInvoiceButton({ invoiceId, invoiceNumber }: Props) {
  return (
    <form
      action={deleteInvoice}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `¿Eliminar la factura ${invoiceNumber}? Esta acción no se puede deshacer.`,
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
