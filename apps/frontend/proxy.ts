import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@facturas/shared/auth-cookie-name";
import { verifyAuthToken } from "@facturas/shared/jwt-verify";

/**
 * Único punto de protección de páginas: `/invoices/**`, `/settings/**` y
 * `/users/**` no tienen que comprobar sesión por su cuenta. Esta app ya no
 * tiene rutas API propias (todo `/api/**` vive en `apps/backend`), así que
 * aquí no hay CORS ni rate limit — ver el `proxy.ts` del backend para eso.
 *
 * Verifica el JWT localmente, sin llamar al backend: verificar una firma
 * HS256 es pura criptografía y no necesita la base de datos, así que
 * `apps/frontend` puede decidir "¿hay sesión válida?" sin ninguna petición
 * de red, exactamente igual que cuando todo era un solo proceso — siempre
 * que `AUTH_JWT_SECRET` sea idéntica en las dos apps (ver
 * `lib/security/auth-cookie.ts` del backend).
 *
 * Se llama `proxy.ts` y no `middleware.ts`: en Next 16 el convenio
 * `middleware` está deprecado en favor de `proxy` (mismo mecanismo, solo
 * cambia el nombre del fichero y de la función exportada).
 */

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/invoices/:path*", "/settings/:path*", "/users/:path*"],
};
