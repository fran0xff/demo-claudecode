import { clearAuthCookie } from "@/lib/security/auth-cookie";

/**
 * Borra la cookie httpOnly de sesión — la única credencial de la app desde
 * la migración a cookie-only. Es la única forma de borrarla desde el
 * cliente: al ser httpOnly, `document.cookie` no puede tocarla.
 */
export async function POST() {
  await clearAuthCookie();
  return Response.json({ ok: true });
}
