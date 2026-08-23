import type { NextRequest } from "next/server";
import { setFlash } from "@/lib/flash-cookie";
import * as userService from "@/lib/services/user-service";
import { ValidationError } from "@/lib/services/errors";

/** Listado de usuarios para la pantalla `/users`. Sin lógica que orquestar. */
export async function GET() {
  const users = await userService.listUsers();
  return Response.json(users);
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ errors: {}, message: "Cuerpo de la petición no válido." }, { status: 400 });
  }

  try {
    const { id } = await userService.createUser(formData);
    await setFlash("exito", "Usuario creado.");
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ errors: error.errors }, { status: 400 });
    }
    return Response.json({ errors: {}, message: "Error inesperado." }, { status: 500 });
  }
}
