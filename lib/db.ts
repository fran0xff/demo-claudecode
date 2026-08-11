import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Prisma 7 se conecta a SQLite a través de un driver adapter en vez del motor
// nativo, así que hay que construirlo explícitamente.
function createClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}

// En desarrollo Next recarga los módulos en caliente, lo que crearía un
// PrismaClient nuevo (y una conexión nueva) en cada recarga. Lo guardamos en
// globalThis para reutilizar siempre la misma instancia.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
