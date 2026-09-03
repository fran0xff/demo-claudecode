import "server-only";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@facturas/shared/auth-cookie-name";
import { verifyAuthToken, type AuthTokenPayload } from "@facturas/shared/jwt-verify";

/**
 * Sesión actual, para decidir qué pintar en el navbar (`app/layout.tsx`).
 * Distinto de `proxy.ts`: aquel redirige a `/login` si falta; esto solo
 * informa, porque el layout envuelve también páginas públicas como `/login`.
 */
export async function getSession(): Promise<AuthTokenPayload | null> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  return token ? verifyAuthToken(token) : null;
}
