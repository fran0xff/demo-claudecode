import "server-only";
import bcrypt from "bcryptjs";
import { findUserByEmail } from "@/lib/repositories/user-repository";
import { signAuthToken } from "@/lib/security/jwt";
import { fieldErrors, loginSchema } from "@/lib/validation";
import { InvalidCredentialsError, ValidationError } from "@/lib/services/errors";

/**
 * Lógica de login. No conoce `Request`/`Response`/cookies, igual que
 * `invoice-service.ts`: eso es cosa de `app/api/auth/login/route.ts`.
 */

const BCRYPT_COST = 12;

/**
 * Hash "señuelo", calculado una vez al cargar el módulo. Si el email no
 * existe, comparamos igualmente contra este hash antes de rechazar, para que
 * un email inexistente tarde lo mismo que una contraseña incorrecta y no se
 * pueda distinguir un caso del otro por tiempo de respuesta.
 */
const DUMMY_HASH = bcrypt.hashSync("ningun-usuario-tiene-esta-contrasena", BCRYPT_COST);

export async function login(formData: FormData): Promise<{ token: string; expiresAt: string }> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new ValidationError(fieldErrors(parsed.error));
  }

  const { email, password } = parsed.data;
  const user = await findUserByEmail(email);

  const matches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !matches) {
    throw new InvalidCredentialsError();
  }

  return signAuthToken({ sub: user.id, email: user.email });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}
