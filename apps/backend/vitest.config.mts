import "dotenv/config";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // `server-only` lanza al importarse fuera del entorno de servidor de
      // Next; en los tests lo sustituimos por un módulo vacío.
      "server-only": fileURLToPath(new URL("tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // `tests/global-setup.ts` aplica las migraciones una sola vez, contra
    // `TEST_DATABASE_URL` (un esquema de Postgres aparte, en el mismo
    // Supabase que usa la app).
    globalSetup: ["tests/global-setup.ts"],
    // Los 4 ficheros que tocan la base de datos comparten ese mismo esquema
    // (antes cada uno montaba su propia SQLite temporal, total aislamiento).
    // En serie evita que dos ficheros trunquen el esquema a la vez.
    fileParallelism: false,
  },
});
