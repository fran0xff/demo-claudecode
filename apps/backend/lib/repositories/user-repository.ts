import "server-only";
import { prisma } from "@/lib/db";

/**
 * Acceso a datos de usuarios. Igual que el resto de repositorios, es de los
 * únicos ficheros que importan Prisma.
 */

export type UserAuthDTO = {
  id: string;
  email: string;
  passwordHash: string;
};

export async function findUserByEmail(email: string): Promise<UserAuthDTO | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  return { id: user.id, email: user.email, passwordHash: user.passwordHash };
}

export async function createUser(email: string, passwordHash: string): Promise<{ id: string }> {
  const user = await prisma.user.create({ data: { email, passwordHash } });
  return { id: user.id };
}

export type UserDTO = {
  id: string;
  email: string;
  createdAt: Date;
};

export async function listUsers(): Promise<UserDTO[]> {
  return prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, createdAt: true },
  });
}

export async function updateUserPassword(id: string, passwordHash: string): Promise<void> {
  await prisma.user.update({ where: { id }, data: { passwordHash } });
}

export async function deleteUser(id: string): Promise<void> {
  await prisma.user.delete({ where: { id } });
}
