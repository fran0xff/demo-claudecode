import { redirect } from "next/navigation";
import { setToken } from "@/lib/auth/token-storage";
import type { FormState } from "@/lib/form-state";

/**
 * Login: la única petición que no pasa por `authFetch` (todavía no hay
 * token que adjuntar).
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

  const { token } = (await response.json()) as { token: string; expiresAt: string };
  setToken(token);
  redirect("/invoices");
}
