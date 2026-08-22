import type { NextRequest } from "next/server";
import { setAuthCookie } from "@/lib/security/auth-cookie";
import { checkLoginRateLimit, clientKey } from "@/lib/security/rate-limit";
import * as authService from "@/lib/services/auth-service";
import { InvalidCredentialsError, ValidationError } from "@/lib/services/errors";

export async function POST(request: NextRequest) {
  const limit = checkLoginRateLimit(clientKey(request));
  if (!limit.allowed) {
    return Response.json(
      { errors: {}, message: "Demasiados intentos. Inténtalo más tarde." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ errors: {}, message: "Cuerpo de la petición no válido." }, { status: 400 });
  }

  try {
    const { token, expiresAt } = await authService.login(formData);
    // El JWT solo viaja en la cookie httpOnly (ver `lib/security/auth-cookie.ts`):
    // no hace falta devolverlo también en el body, y no hacerlo evita que un
    // XSS que intercepte esta respuesta concreta pueda leerlo.
    await setAuthCookie(token);
    return Response.json({ expiresAt });
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ errors: error.errors }, { status: 400 });
    }
    if (error instanceof InvalidCredentialsError) {
      return Response.json({ errors: {}, message: error.message }, { status: 401 });
    }
    return Response.json({ errors: {}, message: "Error inesperado." }, { status: 500 });
  }
}
