import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/security/auth-cookie-name";
import { verifyAuthToken } from "@/lib/security/jwt";

/**
 * Único punto de protección de rutas: nada bajo `app/api/invoices/**`,
 * `app/api/settings`, `app/invoices/**` o `app/settings/**` tiene que
 * acordarse de comprobar sesión por su cuenta — lo hace este `matcher`. Una
 * ruta nueva que se añada mañana bajo esos prefijos queda protegida sin que
 * nadie tenga que recordar añadir el chequeo.
 *
 * Dos canales de credencial, cada uno para lo suyo:
 * - `/api/**`: header `Authorization: Bearer <token>` (lo manda `authFetch`).
 * - páginas: cookie httpOnly `factura-sesion` (no hay header posible en una
 *   navegación normal, y `localStorage` no existe durante el render en
 *   servidor). Ver `lib/security/auth-cookie.ts`.
 *
 * Se llama `proxy.ts` y no `middleware.ts`: en Next 16 el convenio
 * `middleware` está deprecado en favor de `proxy` (mismo mecanismo, solo
 * cambia el nombre del fichero y de la función exportada).
 */

const API_PREFIXES = ["/api/invoices", "/api/settings", "/api/users"];
const PAGE_PREFIXES = ["/invoices", "/settings", "/users"];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (matchesPrefix(pathname, API_PREFIXES)) {
    const header = request.headers.get("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    const payload = token ? await verifyAuthToken(token) : null;

    if (!payload) {
      return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (matchesPrefix(pathname, PAGE_PREFIXES)) {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const payload = token ? await verifyAuthToken(token) : null;

    if (!payload) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/invoices/:path*",
    "/settings/:path*",
    "/users/:path*",
    "/api/invoices/:path*",
    "/api/settings/:path*",
    "/api/users/:path*",
  ],
};
