import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@facturas/shared/auth-cookie-name";
import { verifyAuthToken } from "@/lib/security/jwt";
import { checkApiRateLimit, clientKey } from "@/lib/security/rate-limit";

/**
 * Único punto de protección de `/api/**`: ninguna ruta bajo `app/api/**`
 * tiene que acordarse de comprobar sesión, límite de peticiones ni CORS por
 * su cuenta — lo hace este `matcher`. Esta app ya no tiene páginas (ese
 * papel lo hace `apps/frontend`, con su propio `proxy.ts` mínimo que solo
 * verifica la cookie para decidir si redirige a `/login`), así que aquí no
 * hay bloque de páginas ni redirect: todo lo que entra por `/api/**` es una
 * API JSON, y lo que no entra por ahí no lo toca este fichero.
 *
 * Un solo canal de credencial: la cookie httpOnly `factura-sesion` (ver
 * `lib/security/auth-cookie.ts`), compartida con `apps/frontend` porque los
 * dos son subdominios del mismo dominio raíz en producción — `sameSite:
 * "lax"` sigue bastando (ver el comentario de `auth-cookie.ts`).
 *
 * CORS explícito porque, a diferencia de cuando todo era un proceso, ahora
 * el navegador SÍ hace peticiones cross-origin de verdad (`app.tudominio.com`
 * llamando a `api.tudominio.com`): sin estas cabeceras el navegador
 * bloquearía la respuesta antes de que el código cliente la viera, y sin
 * responder al `OPTIONS` de preflight ni llegaría a intentar la petición
 * real. `Access-Control-Allow-Origin` no puede ser `"*"` porque se mandan
 * credenciales (la cookie) — tiene que ser el origen exacto del frontend.
 *
 * Se llama `proxy.ts` y no `middleware.ts`: en Next 16 el convenio
 * `middleware` está deprecado en favor de `proxy` (mismo mecanismo, solo
 * cambia el nombre del fichero y de la función exportada).
 */

/** Rutas que exigen sesión válida y límite general de peticiones. */
const PROTECTED_PREFIXES = ["/api/invoices", "/api/settings", "/api/users"];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function frontendOrigin(): string {
  const origin = process.env.FRONTEND_ORIGIN;
  if (!origin) {
    throw new Error("Falta FRONTEND_ORIGIN en las variables de entorno del backend.");
  }
  return origin;
}

function withCors(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", frontendOrigin());
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Vary", "Origin");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Preflight: el navegador lo manda solo, sin cookie ni body, antes de la
  // petición real — de cualquier ruta de `/api/**`, incluido el login (que
  // por definición no puede exigir sesión todavía). Se contesta aquí mismo,
  // antes de rate limit o de auth.
  if (request.method === "OPTIONS") {
    return withCors(
      new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      }),
    );
  }

  if (!matchesPrefix(pathname, PROTECTED_PREFIXES)) {
    // `/api/auth/**`: sin sesión que exigir (es donde se consigue), pero
    // sigue necesitando las cabeceras CORS para que el navegador acepte la
    // respuesta.
    return withCors(NextResponse.next());
  }

  const limit = checkApiRateLimit(clientKey(request));
  if (!limit.allowed) {
    return withCors(
      NextResponse.json(
        { message: "Demasiadas peticiones. Inténtalo más tarde." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      ),
    );
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (!payload) {
    return withCors(NextResponse.json({ message: "No autorizado." }, { status: 401 }));
  }

  return withCors(NextResponse.next());
}

export const config = {
  matcher: ["/api/:path*"],
};
