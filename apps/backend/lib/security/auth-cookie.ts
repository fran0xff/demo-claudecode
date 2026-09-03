import "server-only";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@facturas/shared/auth-cookie-name";

/**
 * Cookie httpOnly con el JWT de sesión. Es la única credencial de la app:
 * la lee `proxy.ts` (de este backend) para autorizar `/api/**`, y la lee
 * también el `proxy.ts` de `apps/frontend` para decidir si una página
 * protegida se puede renderizar en servidor.
 *
 * `sameSite: "lax"` sigue siendo suficiente aunque backend y frontend sean
 * dos apps y dos orígenes distintos, porque en producción son subdominios
 * del mismo dominio raíz (`app.tudominio.com` / `api.tudominio.com`):
 * `SameSite` se define por sitio (dominio raíz registrable), no por origen,
 * así que dos subdominios del mismo sitio siguen siendo "same-site" entre
 * sí — la cookie viaja igual que cuando todo era un solo proceso. Con
 * dominios de verdad ajenos esto no valdría (haría falta `sameSite: "none"`
 * + CORS + reabrir la protección CSRF), pero esa opción se descartó a
 * propósito al migrar a monorepo.
 *
 * `domain: COOKIE_DOMAIN` es lo que hace que la vea el subdominio del
 * frontend además del propio backend que la puso: vacío en local (los dos
 * apps comparten "localhost" sin necesidad de fijarlo), `.tudominio.com` en
 * producción.
 */
export { AUTH_COOKIE_NAME };

// Mismo tiempo de vida que el JWT que contiene (ver `lib/security/jwt.ts`).
const MAX_AGE_SECONDS = 60 * 60 * 24;

function cookieDomain(): string | undefined {
  return process.env.COOKIE_DOMAIN || undefined;
}

export async function setAuthCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE_NAME, token, {
    path: "/",
    domain: cookieDomain(),
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  store.delete({ name: AUTH_COOKIE_NAME, path: "/", domain: cookieDomain() });
}
