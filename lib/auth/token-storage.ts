/**
 * Lectura/escritura del JWT en `localStorage`, tal como se pidió: el backend
 * también deja un JWT en una cookie httpOnly aparte (ver
 * `lib/security/auth-cookie.ts`), pero esa cookie nunca autoriza mutaciones
 * en `app/api/**` — para eso siempre se manda este token como header
 * `Authorization: Bearer`.
 *
 * Sin "use client": son solo funciones, se ejecutan en el navegador porque
 * solo las importan Client Components (mismo patrón que
 * `lib/api/invoice-client.ts`).
 */

const TOKEN_KEY = "facturacion.authToken";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}
