import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db";
import { MIN_PASSWORD_LENGTH } from "../lib/validation";

/**
 * Alta manual de un usuario. Deliberadamente fuera de `prisma/seed.ts`: el
 * seed es idempotente y pensado para que cualquiera que clone el repo lo
 * ejecute sin pensarlo — mezclar ahí una credencial real sería el sitio
 * equivocado, nadie debería obtener sin querer una cuenta con contraseña
 * conocida.
 *
 * Uso: npm run create-user -- correo@ejemplo.com "contraseña larga" [--force]
 *
 * Nota: la contraseña pasada como argumento queda en el historial de la
 * shell. Aceptable para un script de aprovisionamiento local que se corre
 * una vez, pero hay que saberlo.
 *
 * Hashea aquí mismo en vez de reutilizar `hashPassword` de
 * `lib/services/auth-service.ts`: ese fichero lleva `import "server-only"`,
 * que lanza en cuanto se ejecuta fuera del runtime de servidor de Next (como
 * aquí, con `tsx` desde la terminal). Mismo coste de bcrypt que el servicio.
 */
const BCRYPT_COST = 12;

async function main() {
  const [email, password, ...rest] = process.argv.slice(2);
  const force = rest.includes("--force");

  if (!email || !password) {
    console.error('Uso: npm run create-user -- correo@ejemplo.com "contraseña" [--force]');
    process.exit(1);
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !force) {
    console.error(`Ya existe un usuario con ese email. Usa --force para sobrescribir la contraseña.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  if (existing) {
    await prisma.user.update({ where: { email }, data: { passwordHash } });
    console.log(`Contraseña actualizada para ${email}.`);
  } else {
    await prisma.user.create({ data: { email, passwordHash } });
    console.log(`Usuario creado: ${email}.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
