import { fileURLToPath } from "node:url";
import { config } from "dotenv";

/**
 * Carga apps/invoices-mcp/.env resolviendo la ruta respecto a este fichero,
 * no a process.cwd(): el cliente MCP puede lanzar este proceso desde
 * cualquier directorio (ver .mcp.json, que lo invoca con rutas relativas a
 * la raíz del repo), así que no podemos depender del cwd para encontrarlo.
 */
const envPath = fileURLToPath(new URL("../.env", import.meta.url));
config({ path: envPath });

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      `Falta DATABASE_URL. Copia apps/invoices-mcp/.env.example a apps/invoices-mcp/.env ` +
        `y rellena la URL del pooler de Supabase (se esperaba encontrarla en ${envPath}).`,
    );
  }
  return url;
}
