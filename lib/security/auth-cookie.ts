import "server-only";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/security/auth-cookie-name";

/**
 * Cookie httpOnly con el JWT de sesión. Es la única credencial de la app:
 * la lee `proxy.ts` tanto para autorizar la carga de las páginas Server
 * Component (`app/invoices/**`, `app/settings/page.tsx`) como para autorizar
 * las mutaciones bajo `app/api/**`.
 *
 * Antes esta cookie no autorizaba `app/api/**` a propósito: se exigía un
 * header `Authorization: Bearer` aparte (guardado en `localStorage`) para no
 * depender de la protección CSRF de `sameSite`. Se abandonó ese diseño
 * porque `sameSite: "lax"` ya impide que un sitio ajeno adjunte esta cookie
 * en la petición que dispararía la mutación (ni en `fetch`/XHR cross-origin,
 * ni en un `<form>` cross-site enviado por POST — solo viajaría en una
 * navegación de nivel superior por GET, y aquí ninguna ruta muta con GET), y
 * mantener el JWT solo aquí evita que un XSS pueda leerlo desde
 * `localStorage` y reutilizarlo fuera de la propia página. Ver el comentario
 * de `proxy.ts` para el razonamiento completo.
 */
export { AUTH_COOKIE_NAME };

// Mismo tiempo de vida que el JWT que contiene (ver `lib/security/jwt.ts`).
const MAX_AGE_SECONDS = 60 * 60 * 24;

export async function setAuthCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE_NAME, token, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  store.delete(AUTH_COOKIE_NAME);
}
