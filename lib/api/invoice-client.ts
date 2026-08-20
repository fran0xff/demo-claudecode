import { redirect } from "next/navigation";
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

export async function createInvoiceAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  let response: Response;
  try {
    response = await fetch("/api/invoices", { method: "POST", body: formData });
  } catch {
    return ERROR_GENERICO;
  }

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
    response = await fetch(`/api/invoices/${id}`, { method: "POST", body: formData });
  } catch {
    return ERROR_GENERICO;
  }

  if (!response.ok) return errorFormState(response);

  redirect(`/invoices/${id}`);
}

/** El aviso ya queda listo en cookie desde la propia ruta; aquí solo se dispara la petición. */
export async function issueInvoiceAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await fetch(`/api/invoices/${id}/issue`, { method: "POST" });
}

export async function setInvoiceStatusAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await fetch(`/api/invoices/${id}/status`, { method: "POST", body: formData });
}

export async function deleteInvoiceAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await fetch(`/api/invoices/${id}`, { method: "DELETE" });
  redirect("/invoices");
}
