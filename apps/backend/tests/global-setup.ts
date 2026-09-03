import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * `globalSetup` de Vitest: corre una sola vez, en un proceso aparte, antes de
 * toda la suite (no por fichero). Deja el esquema de test (`facturas_test`,
 * dentro del mismo Supabase que usa la app) con las migraciones aplicadas;
 * cada fichero de test solo tiene que vaciar las tablas (`tests/reset-db.ts`),
 * no recrear el esquema entero.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta TEST_DATABASE_URL en apps/backend/.env: hace falta para preparar el esquema de test antes de la suite.",
    );
  }

  execSync("npx prisma migrate deploy", {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
