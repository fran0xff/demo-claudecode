import type { prisma as PrismaInstance } from "@/lib/db";

/**
 * Vacía las tablas del esquema de test al principio de cada fichero.
 *
 * Antes cada fichero de test montaba su propia SQLite temporal (aislamiento
 * total). Con Postgres remoto los 4 ficheros comparten el mismo esquema
 * (`facturas_test`, creado una sola vez por `tests/global-setup.ts`), así que
 * hace falta este `TRUNCATE` para no arrastrar filas de un fichero al
 * siguiente — `fileParallelism: false` en `vitest.config.mts` sigue siendo
 * necesario por el mismo motivo: dos ficheros truncando el mismo esquema a
 * la vez se pisarían.
 */
export async function resetDatabase(prisma: typeof PrismaInstance): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "InvoiceLine", "Invoice", "Settings", "User" RESTART IDENTITY CASCADE`,
  );
}
