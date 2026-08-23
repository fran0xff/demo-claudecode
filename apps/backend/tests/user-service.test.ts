import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "@/lib/services/errors";

/**
 * Tests de la capa de servicio contra una base de datos SQLite temporal,
 * mismo patrón que `invoice-service.test.ts`.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const dbPath = path.join(root, "tests", ".tmp", "user-service.db");

type Service = typeof import("@/lib/services/user-service");
type Db = typeof import("@/lib/db");

let service: Service;
let prisma: Db["prisma"];

function formDataFrom(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

function userForm(overrides: Record<string, string> = {}): FormData {
  return formDataFrom({
    email: "nueva@ejemplo.com",
    password: "contraseña-larga-1",
    confirmPassword: "contraseña-larga-1",
    ...overrides,
  });
}

beforeAll(async () => {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  rmSync(dbPath, { force: true });

  const migrationsDir = path.join(root, "prisma", "migrations");
  const migrations = readdirSync(migrationsDir)
    .filter((entry) => /^\d+_/.test(entry))
    .sort();
  if (migrations.length === 0) throw new Error("No se encontró ninguna migración");

  const database = new Database(dbPath);
  for (const migration of migrations) {
    database.exec(readFileSync(path.join(migrationsDir, migration, "migration.sql"), "utf8"));
  }
  database.close();

  process.env.DATABASE_URL = `file:${dbPath}`;
  // `lib/security/jwt.ts` calcula el secreto una sola vez al cargar el
  // módulo, y `user-service.ts` lo arrastra a través de `auth-service.ts`
  // (`hashPassword`); mismo secreto de pruebas que `security-jwt.test.ts`.
  process.env.AUTH_JWT_SECRET ??= "clave-de-pruebas-con-al-menos-32-bytes-de-largo";

  service = await import("@/lib/services/user-service");
  ({ prisma } = await import("@/lib/db"));
});

beforeEach(async () => {
  await prisma.user.deleteMany();
});

describe("createUser", () => {
  it("crea el usuario con la contraseña hasheada", async () => {
    const { id } = await service.createUser(userForm());

    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(user.email).toBe("nueva@ejemplo.com");
    expect(user.passwordHash).not.toBe("contraseña-larga-1");
    expect(await bcrypt.compare("contraseña-larga-1", user.passwordHash)).toBe(true);
  });

  it("rechaza un email ya usado por otro usuario", async () => {
    await service.createUser(userForm());

    await expect(service.createUser(userForm())).rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.user.count()).toBe(1);
  });

  it("rechaza una contraseña demasiado corta", async () => {
    const promise = service.createUser(userForm({ password: "corta", confirmPassword: "corta" }));

    await expect(promise).rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.user.count()).toBe(0);
  });

  it("rechaza si la confirmación no coincide", async () => {
    try {
      await service.createUser(userForm({ confirmPassword: "otra-contraseña-distinta" }));
      throw new Error("Se esperaba que createUser lanzase ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).errors.confirmPassword).toMatch(/no coinciden/);
    }
  });
});

describe("changePassword", () => {
  it("actualiza el hash y permite validar la contraseña nueva", async () => {
    const { id } = await service.createUser(userForm());

    await service.changePassword(
      id,
      formDataFrom({ password: "otra-contraseña-larga", confirmPassword: "otra-contraseña-larga" }),
    );

    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(await bcrypt.compare("otra-contraseña-larga", user.passwordHash)).toBe(true);
  });

  it("lanza NotFoundError si el usuario ya no existe", async () => {
    const promise = service.changePassword(
      "no-existe",
      formDataFrom({ password: "otra-contraseña-larga", confirmPassword: "otra-contraseña-larga" }),
    );

    await expect(promise).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rechaza si la confirmación no coincide", async () => {
    const { id } = await service.createUser(userForm());

    const promise = service.changePassword(
      id,
      formDataFrom({ password: "otra-contraseña-larga", confirmPassword: "no-coincide" }),
    );

    await expect(promise).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("deleteUser", () => {
  it("borra el usuario", async () => {
    const { id } = await service.createUser(userForm());

    await service.deleteUser(id);

    expect(await prisma.user.count()).toBe(0);
  });

  it("lanza NotFoundError si el usuario ya no existe", async () => {
    await expect(service.deleteUser("no-existe")).rejects.toBeInstanceOf(NotFoundError);
  });
});
