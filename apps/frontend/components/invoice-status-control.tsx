"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { issueInvoiceAction, setInvoiceStatusAction } from "@/lib/api/invoice-client";
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
  const router = useRouter();
  // `issueInvoiceAction`/`setInvoiceStatusAction` no lanzan si la petición
  // falla (404/409/500 o red caída): devuelven el mensaje. Sin este estado no
  // había forma de enseñarlo, y el desplegable simplemente volvía a su valor
  // anterior al refrescar sin explicar por qué.
  const [error, setError] = useState<string | null>(null);

  // Ni emitir ni cambiar de estado navegan a otra pantalla: a diferencia de
  // `revalidatePath` en el servidor, aquí hace falta refrescar explícitamente
  // los datos de la página tras la petición. Vive en el componente porque es
  // el único sitio con acceso al router; `lib/api/invoice-client.ts` se limita
  // a la petición `fetch`.
  const handleIssue = async (formData: FormData) => {
    setError(await issueInvoiceAction(formData));
    router.refresh();
  };

  const handleStatusChange = async (formData: FormData) => {
    setError(await setInvoiceStatusAction(formData));
    router.refresh();
  };

  if (status === "BORRADOR") {
    return (
      <div className="no-print">
        <form action={handleIssue}>
          <input type="hidden" name="id" value={invoiceId} />
          <button type="submit" className="btn-primary px-3 py-1 text-xs">
            Emitir
          </button>
        </form>
        {error && <p className="error-text mt-1 text-xs">{error}</p>}
      </div>
    );
  }

  return (
    <div className="no-print">
      <form ref={formRef} action={handleStatusChange} className="inline-flex items-center">
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
        {/* Sin JavaScript el `change` no envía nada, así que el botón sigue en
            el formulario: invisible, pero alcanzable con el teclado. */}
        <button type="submit" className="sr-only focus:not-sr-only focus:ml-2 focus:underline">
          Guardar estado
        </button>
      </form>
      {error && <p className="error-text mt-1 text-xs">{error}</p>}
    </div>
  );
}
