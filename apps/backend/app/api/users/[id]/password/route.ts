import type { NextRequest } from "next/server";
import * as userService from "@/lib/services/user-service";
import { NotFoundError, ValidationError } from "@/lib/services/errors";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Cambia la contraseña de un usuario. No usa `setFlash`: a diferencia de
 * crear/eliminar, esta acción no navega a otra pantalla (se queda en
 * `/users`), así que el mensaje viaja en el propio cuerpo de la respuesta,
 * igual que `POST /api/settings`.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ errors: {}, message: "Cuerpo de la petición no válido." }, { status: 400 });
  }

  try {
    await userService.changePassword(id, formData);
    return Response.json({ errors: {}, message: "Contraseña actualizada." });
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ errors: error.errors }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return Response.json({ errors: {}, message: error.message }, { status: 404 });
    }
    return Response.json({ errors: {}, message: "Error inesperado." }, { status: 500 });
  }
}
