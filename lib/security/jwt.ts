import "server-only";
import { SignJWT, jwtVerify } from "jose";

/**
 * Firma y verificación de los JWT de sesión.
 *
 * Vive fuera de `lib/services/*` porque lo usan dos runtimes distintos: las
 * rutas de `app/api/auth/**` (Node) y `middleware.ts` (Edge). `jose` es la
 * librería elegida precisamente porque funciona en los dos, a diferencia de
 * `jsonwebtoken`, que depende del `crypto` de Node y no corre en Edge.
 */

const ALGORITHM = "HS256";
const EXPIRATION = "24h";

function loadSecret(): Uint8Array {
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
// sin fallback, a diferencia de `DATABASE_URL` en `prisma.config.ts` — un
// fallback aquí significaría que cualquiera que lea el repositorio conoce la
// clave con la que se firman los tokens.
const secret = loadSecret();

export type AuthTokenPayload = {
  /** Id del usuario. */
  sub: string;
  email: string;
};

/** Firma un token de sesión válido durante 24 horas. Sin refresh token: un
 * solo operador local no necesita renovación silenciosa. */
export async function signAuthToken(
  payload: AuthTokenPayload,
): Promise<{ token: string; expiresAt: string }> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const token = await new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(secret);

  return { token, expiresAt: expiresAt.toISOString() };
}

/**
 * Verifica firma, algoritmo y expiración. El `algorithms: [ALGORITHM]`
 * explícito es lo que impide que un token manipulado que declare `alg: "none"`
 * (o cualquier otro) se acepte — sin esa lista, se confiaría en lo que el
 * propio token dice llevar.
 */
export async function verifyAuthToken(token: string): Promise<AuthTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALGORITHM] });
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
