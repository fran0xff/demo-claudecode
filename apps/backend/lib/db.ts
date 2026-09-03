import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Prisma 7 se conecta a Postgres a través de un driver adapter en vez del
// motor nativo, así que hay que construirlo explícitamente. No hay fallback a
// un fichero local: sin `DATABASE_URL` no hay a qué conectarse.
//
// `?schema=` en la URL (lo usa `TEST_DATABASE_URL` para aislar los tests en
// `facturas_test`) es una convención del propio motor de Prisma — el CLI
// (`prisma migrate deploy`) lo entiende solo, pero el driver adapter no: `pg`
// no sabe qué es un parámetro "schema" y lo ignora en silencio. Hacen falta
// dos cosas, no solo una:
//   1. La opción `schema` del adapter, para que las consultas tipadas de
//      Prisma (`prisma.invoice.count()`...) cualifiquen el esquema al
//      generar su propio SQL.
//   2. `search_path` como parámetro de arranque de la conexión (`-c
//      search_path=...`), para el SQL en crudo de
//      `invoice-repository.ts` (`$queryRaw`): esas consultas usan
//      identificadores sin cualificar (`"Invoice"`, no `"facturas_test"."Invoice"`)
//      y Postgres los resuelve con el `search_path` de la sesión, que la
//      opción `schema` del punto 1 **no** toca — sin esto, el SQL en crudo
//      seguiría leyendo/escribiendo en `public` aunque las consultas tipadas
//      ya apuntaran bien a `facturas_test`.
function createClient() {
  const url = process.env.DATABASE_URL;
  const schema = url ? (new URL(url).searchParams.get("schema") ?? undefined) : undefined;
  const adapter = new PrismaPg(
    schema ? { connectionString: url, options: `-c search_path=${schema}` } : { connectionString: url },
    schema ? { schema } : undefined,
  );
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
