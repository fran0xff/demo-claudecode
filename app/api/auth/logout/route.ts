import { clearAuthCookie } from "@/lib/security/auth-cookie";

/**
 * Borra la cookie httpOnly de sesión. Es la única forma de borrarla desde el
 * cliente: al ser httpOnly, `document.cookie` no puede tocarla. El token de
 * `localStorage` lo borra directamente `components/logout-button.tsx`.
 */
export async function POST() {
  await clearAuthCookie();
  return Response.json({ ok: true });
}
