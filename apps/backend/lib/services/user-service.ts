import "server-only";
import type { UserDTO } from "@facturas/shared/dto";
import {
  createUser as createUserRow,
  deleteUser as deleteUserRow,
  listUsers as listUsersRow,
  updateUserPassword,
} from "@/lib/repositories/user-repository";
import { hashPassword } from "@/lib/services/auth-service";
import { NotFoundError, ValidationError } from "@/lib/services/errors";
import { changePasswordSchema, createUserSchema, fieldErrors } from "@/lib/validation";

/**
 * Gestión de usuarios (alta, cambio de contraseña, baja). No conoce
 * `Request`/`Response`/cookies, igual que `invoice-service.ts`: eso es cosa
 * de `app/api/users/**`.
 */

export type { UserDTO };

/** Errores de restricción única de Prisma (email repetido). Mismo criterio
 * que `isUniqueViolation` en `invoice-service.ts`. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/** Error "no encontrado" de Prisma (p. ej. tocar un id que ya no existe). */
function isRecordNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2025"
  );
}

export async function listUsers(): Promise<UserDTO[]> {
  const rows = await listUsersRow();
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function createUser(formData: FormData): Promise<{ id: string }> {
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new ValidationError(fieldErrors(parsed.error));
  }

  const { email, password } = parsed.data;
  const passwordHash = await hashPassword(password);

  try {
    return await createUserRow(email, passwordHash);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ValidationError({ email: "Ya existe un usuario con ese email." });
    }
    throw error;
  }
}

export async function changePassword(id: string, formData: FormData): Promise<void> {
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new ValidationError(fieldErrors(parsed.error));
  }

  const passwordHash = await hashPassword(parsed.data.password);

  try {
    await updateUserPassword(id, passwordHash);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      throw new NotFoundError("El usuario ya no existe.");
    }
    throw error;
  }
}

export async function deleteUser(id: string): Promise<void> {
  try {
    await deleteUserRow(id);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      throw new NotFoundError("El usuario ya no existe.");
    }
    throw error;
  }
}
