import { redirect } from "next/navigation";
import { authFetch, handleUnauthorized } from "@/lib/api/auth-fetch";
import type { FormState } from "@/lib/form-state";

/**
 * Funciones que los Client Components llaman por `fetch` contra
 * `app/api/invoices/**`, en sustitución de las Server Actions que exponía
 * `app/invoices/actions.ts`.
 *
 * No lleva `"use client"` en la cabecera: no es un componente ni un hook, solo
 * funciones. Se ejecutan en el navegador porque solo las importan Client
 * Components.
 */

const ERROR_GENERICO: FormState = {
  errors: {},
  message: "No se pudo conectar con el servidor. Inténtalo de nuevo.",
};

/** Las rutas devuelven `{errors, message?}` en los errores; si el cuerpo no es JSON, cae al genérico. */
async function errorFormState(response: Response): Promise<FormState> {
  try {
    return (await response.json()) as FormState;
  } catch {
    return ERROR_GENERICO;
  }
}

/** Mismo cuerpo de error que `errorFormState`, pero solo el mensaje: lo que
 * consumen los controles que no llevan campos propios que pintar (emitir,
 * cambiar estado, borrar). */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? ERROR_GENERICO.message!;
  } catch {
    return ERROR_GENERICO.message!;
  }
}

export async function createInvoiceAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  let response: Response;
  try {
    response = await authFetch("/api/invoices", { method: "POST", body: formData });
  } catch {
    return ERROR_GENERICO;
  }
  if (response.status === 401) handleUnauthorized();

  if (!response.ok) return errorFormState(response);

  const { id } = (await response.json()) as { id: string };
  redirect(`/invoices/${id}`);
}

export async function updateInvoiceAction(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  let response: Response;
  try {
    response = await authFetch(`/api/invoices/${id}`, { method: "POST", body: formData });
  } catch {
    return ERROR_GENERICO;
  }
  if (response.status === 401) handleUnauthorized();

  if (!response.ok) return errorFormState(response);

  redirect(`/invoices/${id}`);
}

/**
 * El aviso de éxito ya queda listo en cookie desde la propia ruta. Aquí solo
 * se dispara la petición y se devuelve el mensaje de error si falla — `null`
 * en éxito — para que el componente que llama pueda enseñarlo: sin esto, un
 * 409 (correlativo en conflicto), un 500 o la red caída pasaban en silencio y
 * el desplegable/botón simplemente volvían a su valor anterior sin explicar
 * por qué.
 */
export async function issueInvoiceAction(formData: FormData): Promise<string | null> {
  const id = String(formData.get("id") ?? "");
  if (!id) return null;

  let response: Response;
  try {
    response = await authFetch(`/api/invoices/${id}/issue`, { method: "POST" });
  } catch {
    return ERROR_GENERICO.message!;
  }
  if (response.status === 401) handleUnauthorized();

  return response.ok ? null : errorMessage(response);
}

export async function setInvoiceStatusAction(formData: FormData): Promise<string | null> {
  const id = String(formData.get("id") ?? "");
  if (!id) return null;

  let response: Response;
  try {
    response = await authFetch(`/api/invoices/${id}/status`, { method: "POST", body: formData });
  } catch {
    return ERROR_GENERICO.message!;
  }
  if (response.status === 401) handleUnauthorized();

  return response.ok ? null : errorMessage(response);
}

/** Si el borrado falla, no se redirige: redirigir igualmente haría pensar que
 * se borró cuando la factura sigue ahí. */
export async function deleteInvoiceAction(
  _prevMessage: string | null,
  formData: FormData,
): Promise<string | null> {
  const id = String(formData.get("id") ?? "");
  if (!id) return null;

  let response: Response;
  try {
    response = await authFetch(`/api/invoices/${id}`, { method: "DELETE" });
  } catch {
    return ERROR_GENERICO.message!;
  }
  if (response.status === 401) handleUnauthorized();

  if (!response.ok) return errorMessage(response);

  redirect("/invoices");
}
