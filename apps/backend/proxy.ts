import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/security/auth-cookie-name";
import { verifyAuthToken } from "@/lib/security/jwt";
import { checkApiRateLimit, clientKey } from "@/lib/security/rate-limit";

/**
 * Único punto de protección de rutas: nada bajo `app/api/invoices/**`,
 * `app/api/settings`, `app/invoices/**` o `app/settings/**` tiene que
 * acordarse de comprobar sesión por su cuenta — lo hace este `matcher`. Una
 * ruta nueva que se añada mañana bajo esos prefijos queda protegida sin que
 * nadie tenga que recordar añadir el chequeo. Mismo razonamiento para el
 * límite de peticiones de `checkApiRateLimit`: una sola vez aquí cubre todo
 * `/api/**`, en vez de que cada ruta nueva tenga que acordarse de aplicarlo
 * (como sí tiene que hacerlo `/api/auth/login` a propósito, con su propio
 * límite mucho más estricto — ver `lib/security/rate-limit.ts`).
 *
 * Un solo canal de credencial para todo: la cookie httpOnly `factura-sesion`
 * (ver `lib/security/auth-cookie.ts`), tanto para páginas como para
 * `/api/**`. Antes `/api/**` exigía además un header `Authorization: Bearer`
 * separado — pensado como protección CSRF implícita, ya que un sitio ajeno
 * no puede forjar un header custom — pero esa protección la sigue dando la
 * propia cookie: se fija `sameSite: "lax"`, así que el navegador no la
 * adjunta en peticiones cross-site que no sean una navegación de nivel
 * superior con GET (ni en `fetch`/XHR cross-origin, con cualquier método, ni
 * en un `<form>` cross-site enviado por POST). Como ninguna ruta de este
 * proyecto muta estado con GET (ver la tabla de rutas en `CLAUDE.md`), un
 * sitio ajeno no tiene forma de disparar una mutación con la cookie puesta.
 * Guardar esa invariante importa: añadir una ruta que mute por GET
 * reabriría el CSRF que este diseño da por cerrado.
 *
 * El header `Authorization` duplicaba esa protección sin añadir nada, a
 * costa de guardar el JWT en `localStorage` (legible por cualquier XSS
 * durante las 24h de validez, sin revocación posible) en vez de solo en una
 * cookie httpOnly (invisible a JavaScript, incluido un XSS).
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
  const isApi = matchesPrefix(pathname, API_PREFIXES);
  const isPage = matchesPrefix(pathname, PAGE_PREFIXES);

  if (isApi) {
    const limit = checkApiRateLimit(clientKey(request));
    if (!limit.allowed) {
      return NextResponse.json(
        { message: "Demasiadas peticiones. Inténtalo más tarde." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }
  }

  if (isApi || isPage) {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const payload = token ? await verifyAuthToken(token) : null;

    if (!payload) {
      if (isApi) {
        return NextResponse.json({ message: "No autorizado." }, { status: 401 });
      }
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
