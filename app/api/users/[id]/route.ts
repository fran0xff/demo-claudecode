import type { NextRequest } from "next/server";
import { setFlash } from "@/lib/flash-cookie";
import * as userService from "@/lib/services/user-service";
import { NotFoundError } from "@/lib/services/errors";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    await userService.deleteUser(id);
    await setFlash("aviso", "Usuario eliminado.");
    return Response.json({}, { status: 200 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return Response.json({ message: error.message }, { status: 404 });
    }
    return Response.json({ message: "Error inesperado." }, { status: 500 });
  }
}
