/**
 * Nombre de la cookie httpOnly de sesión, en su propio fichero sin
 * dependencias: lo importan tanto `lib/security/auth-cookie.ts` (que sí usa
 * `next/headers`, solo válido en Route Handlers/Server Components) como
 * `middleware.ts` (Edge), y este no debe arrastrar nada que no funcione ahí.
 */
export const AUTH_COOKIE_NAME = "factura-sesion";
