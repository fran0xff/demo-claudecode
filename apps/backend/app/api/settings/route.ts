import type { NextRequest } from "next/server";
import * as settingsService from "@/lib/services/settings-service";
import { ValidationError } from "@/lib/services/errors";

/**
 * Ajustes del emisor. Antes era la Server Action `saveSettings` en
 * `app/settings/actions.ts`; se movió a REST cuando `/api/**` exigía un
 * header `Authorization` que una Server Action invocada de forma nativa no
 * podía adjuntar. Esa razón concreta ya no aplica (la autenticación es una
 * cookie httpOnly compartida, ver `lib/security/auth-cookie.ts`), pero se
 * mantiene como REST porque ahora es la única forma de que
 * `apps/frontend` (otra app, otro proceso) pueda leer y guardar los ajustes.
 *
 * `GET` no existía cuando todo era un único proceso: la página de ajustes
 * leía `getSettings()` del repositorio directamente. Al separar frontend y
 * backend, esa lectura tiene que cruzar la red igual que ya cruzaba la
 * escritura.
 */
export async function GET() {
  const settings = await settingsService.getSettings();
  return Response.json(settings);
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ errors: {}, message: "Cuerpo de la petición no válido." }, { status: 400 });
  }

  try {
    await settingsService.saveSettings(formData);
    return Response.json({ errors: {}, message: "Ajustes guardados." });
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ errors: error.errors }, { status: 400 });
    }
    return Response.json(
      { errors: {}, message: "No se pudo guardar. Inténtalo de nuevo." },
      { status: 500 },
    );
  }
}
