import "server-only";

/**
 * Limitador de intentos de login, en memoria y por proceso.
 *
 * Es una app local de un solo operador: no hay infraestructura compartida
 * (Redis, etc.) que justificar, y un mapa en memoria del propio proceso Node
 * ya frena la fuerza bruta contra `/auth/login`, que es la amenaza real aquí.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { allowed: boolean; retryAfterSeconds?: number };

/** Cuenta un intento para `key` (normalmente la IP) y dice si se puede seguir. */
export function checkLoginRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true };
}
