import type { NextRequest } from "next/server";
import * as settingsService from "@/lib/services/settings-service";
import { ValidationError } from "@/lib/services/errors";

/**
 * Guarda los ajustes del emisor. Antes era la Server Action `saveSettings`
 * en `app/settings/actions.ts`; se movió aquí porque una Server Action no
 * puede llevar el header `Authorization` que exige `middleware.ts` — el
 * navegador la invoca directamente, sin que el código cliente pueda
 * adjuntarle cabeceras.
 */
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
