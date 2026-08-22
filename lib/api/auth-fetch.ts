import { redirect } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth/token-storage";

/**
 * Envoltorio de `fetch` que añade `Authorization: Bearer <token>` a las
 * peticiones contra rutas protegidas (`app/api/invoices/**`,
 * `app/api/settings`). No decide qué hacer si el servidor responde 401 —
 * eso es `handleUnauthorized`, y quien la llama decide cuándo, fuera de
 * cualquier `try/catch` de red (ver el comentario de esa función).
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}

/**
 * Limpia la sesión local y manda a `/login`.
 *
 * Se llama SIEMPRE fuera de un `try/catch` que capture errores de red:
 * `redirect()` de `next/navigation` lanza una excepción especial que Next
 * intercepta para navegar, y un `catch` genérico de "la petición falló" se la
 * tragaría, convirtiendo la redirección en un mensaje de error silencioso.
 */
export function handleUnauthorized(): never {
  clearToken();
  redirect("/login");
}
