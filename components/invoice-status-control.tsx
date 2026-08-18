"use client";

import { useRef } from "react";
import { issueInvoice, setInvoiceStatus } from "@/app/invoices/actions";
import {
  ISSUED_STATUSES,
  STATUS_LABELS,
  type InvoiceStatus,
} from "@/lib/invoice-status";

type Props = {
  invoiceId: string;
  status: InvoiceStatus;
};

/**
 * Estado de la factura, y a la vez el sitio donde se cambia.
 *
 * Un borrador no tiene estado que elegir: tiene una decisión pendiente, que es
 * emitirlo. Por eso enseña un botón y no un desplegable — emitir gasta el
 * correlativo y no se deshace, así que no debe parecer un valor más de una
 * lista.
 */
export function InvoiceStatusControl({ invoiceId, status }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  if (status === "BORRADOR") {
    return (
      <form action={issueInvoice} className="no-print">
        <input type="hidden" name="id" value={invoiceId} />
        <button type="submit" className="btn-primary px-3 py-1 text-xs">
          Emitir
        </button>
      </form>
    );
  }

  return (
    <form ref={formRef} action={setInvoiceStatus} className="no-print inline-flex items-center">
      <input type="hidden" name="id" value={invoiceId} />
      <select
        // El desplegable no está controlado, y al re-renderizar React le
        // reaplicaría el `defaultValue` con el que se montó, deshaciendo el
        // cambio en pantalla aunque el servidor ya lo hubiera guardado. La
        // `key` lo remonta cuando el estado cambia de verdad.
        key={status}
        name="status"
        defaultValue={status}
        aria-label="Estado de la factura"
        className={`status-select status-${status.toLowerCase()}`}
        onChange={() => formRef.current?.requestSubmit()}
      >
        {ISSUED_STATUSES.map((value) => (
          <option key={value} value={value}>
            {STATUS_LABELS[value]}
          </option>
        ))}
      </select>
      {/* Sin JavaScript el `change` no envía nada, así que el botón sigue en el
          formulario: invisible, pero alcanzable con el teclado. */}
      <button type="submit" className="sr-only focus:not-sr-only focus:ml-2 focus:underline">
        Guardar estado
      </button>
    </form>
  );
}
