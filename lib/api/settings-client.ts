import { handleUnauthorized } from "@/lib/api/unauthorized";
import type { FormState } from "@/lib/form-state";

/**
 * Sustituye a la Server Action `saveSettings` de `app/settings/actions.ts`,
 * igual que `lib/api/invoice-client.ts` sustituyó a las de facturas.
 */

const ERROR_GENERICO: FormState = {
  errors: {},
  message: "No se pudo conectar con el servidor. Inténtalo de nuevo.",
};

export async function saveSettingsAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  let response: Response;
  try {
    response = await fetch("/api/settings", { method: "POST", body: formData });
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
