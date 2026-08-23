import "server-only";

/**
 * Limitadores de peticiones, en memoria y por proceso.
 *
 * Es una app local de un solo operador: no hay infraestructura compartida
 * (Redis, etc.) que justificar, y un mapa en memoria del propio proceso ya
 * frena tanto la fuerza bruta contra `/auth/login` como una avalancha de
 * peticiones contra el resto de `/api/**`. `proxy.ts` lo importa igual que
 * importa `lib/security/jwt.ts`: ambos corren bien en el runtime Edge pese al
 * `"server-only"`, que solo lanza al colarse en un Client Component.
 */

type Bucket = { count: number; resetAt: number };

export type RateLimitResult = { allowed: boolean; retryAfterSeconds?: number };

/** Cuenta un intento para `key` dentro de `buckets` y dice si se puede seguir. */
function checkBucket(
  buckets: Map<string, Bucket>,
  key: string,
  windowMs: number,
  maxAttempts: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= maxAttempts) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true };
}

/** IP del cliente si hay una cabecera de proxy; si no, un proceso local
 * único ya es efectivamente "una sola clave" y el límite sigue teniendo sentido. */
export function clientKey(request: { headers: { get(name: string): string | null } }): string {
  return request.headers.get("x-forwarded-for") ?? "local";
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginBuckets = new Map<string, Bucket>();

/** Fuerza bruta contra `/api/auth/login`: 5 intentos cada 15 minutos por IP. */
export function checkLoginRateLimit(key: string): RateLimitResult {
  return checkBucket(loginBuckets, key, LOGIN_WINDOW_MS, LOGIN_MAX_ATTEMPTS);
}

const API_WINDOW_MS = 60 * 1000;
const API_MAX_REQUESTS = 120;
const apiBuckets = new Map<string, Bucket>();

/**
 * Freno general para el resto de `/api/**` (facturas, ajustes, usuarios):
 * 120 peticiones por minuto por IP, aplicado en `proxy.ts` antes de
 * comprobar el JWT. Es mucho más laxo que el de login a propósito — aquí no
 * se está limitando fuerza bruta sobre una credencial, solo una avalancha.
 */
export function checkApiRateLimit(key: string): RateLimitResult {
  return checkBucket(apiBuckets, key, API_WINDOW_MS, API_MAX_REQUESTS);
}
