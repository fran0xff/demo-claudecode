import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";

/**
 * Login: la única mutación que no necesita comprobar un 401 antes — es
 * precisamente la petición que crea la sesión.
 */

const ERROR_GENERICO: FormState = {
  errors: {},
  message: "No se pudo conectar con el servidor. Inténtalo de nuevo.",
};

export async function loginAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  let response: Response;
  try {
    response = await fetch("/api/auth/login", { method: "POST", body: formData });
  } catch {
    return ERROR_GENERICO;
  }

  if (!response.ok) {
    try {
      return (await response.json()) as FormState;
    } catch {
      return ERROR_GENERICO;
    }
  }

  // La cookie httpOnly de sesión ya la puso `POST /api/auth/login`: no hay
  // nada más que guardar en el cliente.
  redirect("/invoices");
}
