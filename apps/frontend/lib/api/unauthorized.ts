import { redirect } from "next/navigation";

/**
 * Manda a `/login` cuando una petición a `/api/**` responde 401.
 *
 * Antes también limpiaba el JWT de `localStorage` (ver `authFetch`, ya
 * eliminado): ya no hace falta — la única credencial es la cookie httpOnly
 * de sesión (`lib/security/auth-cookie.ts`), que gestiona el propio
 * servidor; el cliente no tiene nada que borrar aquí (el borrado explícito
 * al cerrar sesión sigue siendo `POST /api/auth/logout`, ver
 * `components/logout-button.tsx`).
 *
 * Se llama SIEMPRE fuera de un `try/catch` que capture errores de red:
 * `redirect()` de `next/navigation` lanza una excepción especial que Next
 * intercepta para navegar, y un `catch` genérico de "la petición falló" se la
 * tragaría, convirtiendo la redirección en un mensaje de error silencioso.
 */
export function handleUnauthorized(): never {
  redirect("/login");
}
