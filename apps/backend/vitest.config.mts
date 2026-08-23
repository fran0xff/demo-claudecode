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
    // `invoice-service.test.ts` e `invoice-routes.test.ts` montan cada uno su
    // propia SQLite temporal aplicando todas las migraciones en `beforeAll`.
    // En paralelo compiten por CPU y el montaje puede superar el timeout por
    // defecto; en serie es estable sin tocar los tests.
    fileParallelism: false,
  },
});
