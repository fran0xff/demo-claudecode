import { jwtVerify } from "jose";

/**
 * Carga del secreto y verificación de JWT — la mitad que necesitan las dos
 * apps. `apps/frontend` la usa en su `proxy.ts` para decidir si una página
 * protegida se puede renderizar en servidor, sin tocar la base de datos (la
 * verificación de un JWT es pura criptografía: no hace falta backend para
 * saber si una firma es válida). `apps/backend` reexporta `verifyAuthToken`
 * desde aquí y añade `signAuthToken` (solo el backend emite sesiones).
 *
 * Requisito operativo: `AUTH_JWT_SECRET` tiene que ser **idéntica** en el
 * entorno de las dos apps desplegadas — si no coincide, el frontend
 * rechazará como inválida una cookie que el backend firmó de verdad.
 */

export const ALGORITHM = "HS256";

export function loadSecret(): Uint8Array {
  const raw = process.env.AUTH_JWT_SECRET;
  if (!raw) {
    throw new Error(
      "Falta AUTH_JWT_SECRET en las variables de entorno. Genera una con: openssl rand -base64 32",
    );
  }

  const key = new TextEncoder().encode(raw);
  if (key.length < 32) {
    throw new Error(
      "AUTH_JWT_SECRET es demasiado corta: usa al menos 32 bytes aleatorios (openssl rand -base64 32).",
    );
  }

  return key;
}

// Se calcula una sola vez al cargar el módulo: si falta o es débil, la app
// falla al arrancar en vez de fallar en la primera petición. Deliberadamente
// sin fallback — un fallback aquí significaría que cualquiera que lea el
// repositorio conoce la clave con la que se firman los tokens.
const secret = loadSecret();

export type AuthTokenPayload = {
  /** Id del usuario. */
  sub: string;
  email: string;
};

/**
 * Verifica firma, algoritmo y expiración. El `algorithms: [ALGORITHM]`
 * explícito es lo que impide que un token manipulado que declare `alg: "none"`
 * (o cualquier otro) se acepte — sin esa lista, se confiaría en lo que el
 * propio token dice llevar.
 */
export async function verifyAuthToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    // `clockTolerance` en segundos: backend y frontend verifican el mismo
    // token en procesos (y en producción, máquinas) distintos, así que un
    // pequeño desfase de reloj entre ellos no debe rechazar un token válido
    // justo en el borde de la expiración.
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [ALGORITHM],
      clockTolerance: 5,
    });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
