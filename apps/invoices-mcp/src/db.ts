import { Pool } from "pg";
import { requireDatabaseUrl } from "./env.js";

/**
 * `pg` no entiende el parámetro `?schema=` de la URL de conexión (es una
 * convención propia de Prisma) y lo ignora en silencio: sin `search_path`
 * explícito como opción de arranque de la conexión, el SQL en crudo de
 * invoice-repository.ts —que usa identificadores sin cualificar
 * ("Invoice", no "esquema"."Invoice")— leería/escribiría siempre en
 * `public`, aunque la URL apunte a otro esquema. Mismo problema (y misma
 * solución) que en apps/backend/lib/db.ts, adaptado de Prisma a pg.Pool
 * puro.
 */
function crearPool(): Pool {
  const url = requireDatabaseUrl();
  const schema = new URL(url).searchParams.get("schema") ?? undefined;
  return new Pool({
    connectionString: url,
    options: schema ? `-c search_path=${schema}` : undefined,
    // Falla rápido y con un error claro si la URL no es alcanzable, en vez
    // de colgarse indefinidamente (la misma clase de problema que el host
    // de conexión directa de Supabase, IPv6-only, documentado en
    // apps/backend/CLAUDE.md).
    connectionTimeoutMillis: 10_000,
  });
}

let pool: Pool | undefined;

/** Pool memoizado: una sola conexión para todo el proceso del servidor MCP. */
export function getPool(): Pool {
  pool ??= crearPool();
  return pool;
}
