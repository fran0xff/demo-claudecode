import "server-only";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/security/auth-cookie-name";

/**
 * Cookie httpOnly con el mismo JWT que ya viaja en el body de
 * `POST /api/auth/login` para `localStorage`.
 *
 * Existe solo para que `middleware.ts` pueda autorizar la carga de las
 * páginas Server Component (`app/invoices/**`, `app/settings/page.tsx`), que
 * leen el repositorio directamente en el servidor — antes de que llegue una
 * sola línea de JavaScript al navegador, así que no hay `localStorage` que
 * consultar ahí.
 *
 * Regla que no se debe romper: esta cookie NUNCA autoriza una mutación en
 * `app/api/**`, solo ver páginas. Aceptarla ahí perdería la protección CSRF
 * implícita de exigir un header `Authorization` que un sitio ajeno no puede
 * forjar.
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
