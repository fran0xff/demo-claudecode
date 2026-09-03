import { redirect } from "next/navigation";
import { API_URL } from "@/lib/api-url";
import { handleUnauthorized } from "@/lib/api/unauthorized";
import type { FormState } from "@/lib/form-state";

/**
 * Funciones que los Client Components llaman por `fetch` contra
 * `apps/backend` (`/api/users/**`), mismo patrón que `lib/api/invoice-client.ts`.
 */

const ERROR_GENERICO: FormState = {
  errors: {},
  message: "No se pudo conectar con el servidor. Inténtalo de nuevo.",
};

async function errorFormState(response: Response): Promise<FormState> {
  try {
    return (await response.json()) as FormState;
  } catch {
    return ERROR_GENERICO;
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? ERROR_GENERICO.message!;
  } catch {
    return ERROR_GENERICO.message!;
  }
}

export async function createUserAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/users`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
  } catch {
    return ERROR_GENERICO;
  }
  if (response.status === 401) handleUnauthorized();

  if (!response.ok) return errorFormState(response);

  redirect("/users");
}

/**
 * A diferencia de crear/eliminar, no navega a otra pantalla: el aviso de
 * éxito o error se pinta en el propio formulario, así que se devuelve el
 * `FormState` de la respuesta tal cual, sin tocar la cookie de flash.
 */
export async function changePasswordAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return ERROR_GENERICO;

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/users/${id}/password`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
  } catch {
    return ERROR_GENERICO;
  }
  if (response.status === 401) handleUnauthorized();

  try {
    return (await response.json()) as FormState;
  } catch {
    return ERROR_GENERICO;
  }
}

/** Si el borrado falla, no se redirige: redirigir igualmente haría pensar que
 * se borró cuando el usuario sigue ahí. */
export async function deleteUserAction(
  _prevMessage: string | null,
  formData: FormData,
): Promise<string | null> {
  const id = String(formData.get("id") ?? "");
  if (!id) return null;

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/users/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch {
    return ERROR_GENERICO.message!;
  }
  if (response.status === 401) handleUnauthorized();

  if (!response.ok) return errorMessage(response);

  redirect("/users");
}
