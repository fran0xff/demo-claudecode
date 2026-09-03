import "server-only";
import { SignJWT } from "jose";
import { ALGORITHM, loadSecret, type AuthTokenPayload } from "@facturas/shared/jwt-verify";

export type { AuthTokenPayload };
export { verifyAuthToken } from "@facturas/shared/jwt-verify";

/**
 * Firma de los JWT de sesión. La verificación vive en
 * `@facturas/shared/jwt-verify` (reexportada aquí) porque `apps/frontend`
 * también la necesita para su propio `proxy.ts`, sin tocar la base de datos;
 * firmar en cambio es exclusivo del backend, que es quien emite sesiones.
 *
 * `jose` y no `jsonwebtoken` porque tiene que funcionar tanto en Node (rutas
 * de `app/api/auth/**`) como en el runtime Edge (`proxy.ts`), y a diferencia
 * de `jsonwebtoken` no depende del `crypto` de Node.
 */

const EXPIRATION = "24h";

// Mismo secreto y misma validación que la verificación (ver
// `loadSecret` en `@facturas/shared/jwt-verify`): si falta o es débil, la
// app falla al arrancar en vez de fallar en la primera petición.
const secret = loadSecret();

/** Firma un token de sesión válido durante 24 horas. Sin refresh token: un
 * solo operador local no necesita renovación silenciosa. */
export async function signAuthToken(
  payload: AuthTokenPayload,
): Promise<{ token: string; expiresAt: string }> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const token = await new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(secret);

  return { token, expiresAt: expiresAt.toISOString() };
}
