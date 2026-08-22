import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FLASH_COOKIE, parseFlash } from "@/lib/flash";

/**
 * Tests de integración de las rutas REST de `app/api/users/**`, mismo patrón
 * que `invoice-routes.test.ts`: se invocan directamente los `GET`/`POST`/
 * `DELETE` exportados por cada `route.ts`.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const dbPath = path.join(root, "tests", ".tmp", "user-routes.db");

const { cookieJar } = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
  }),
}));

function lastFlash() {
  return parseFlash(cookieJar.get(FLASH_COOKIE));
}

type UsersRoute = typeof import("@/app/api/users/route");
type UserRoute = typeof import("@/app/api/users/[id]/route");
type PasswordRoute = typeof import("@/app/api/users/[id]/password/route");
type Db = typeof import("@/lib/db");

let usersRoute: UsersRoute;
let userRoute: UserRoute;
let passwordRoute: PasswordRoute;
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

function formRequest(url: string, formData: FormData, method = "POST"): NextRequest {
  return new NextRequest(url, { method, body: formData });
}

function paramsOf(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** Crea un usuario vía `POST /api/users` y devuelve su id. */
async function createUser(overrides: Record<string, string> = {}): Promise<string> {
  const response = await usersRoute.POST(formRequest("http://localhost/api/users", userForm(overrides)));
  const body = (await response.json()) as { id: string };
  return body.id;
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
  // Ver el comentario equivalente en `user-service.test.ts`.
  process.env.AUTH_JWT_SECRET ??= "clave-de-pruebas-con-al-menos-32-bytes-de-largo";

  usersRoute = await import("@/app/api/users/route");
  userRoute = await import("@/app/api/users/[id]/route");
  passwordRoute = await import("@/app/api/users/[id]/password/route");
  ({ prisma } = await import("@/lib/db"));
});

beforeEach(async () => {
  cookieJar.clear();
  await prisma.user.deleteMany();
});

describe("GET /api/users", () => {
  it("lista los usuarios", async () => {
    await createUser();

    const response = await usersRoute.GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as unknown[];
    expect(body).toHaveLength(1);
  });
});

describe("POST /api/users", () => {
  it("crea el usuario y responde 201 con el id", async () => {
    const response = await usersRoute.POST(formRequest("http://localhost/api/users", userForm()));

    expect(response.status).toBe(201);
    const body = (await response.json()) as { id: string };
    expect(typeof body.id).toBe("string");
    expect(await prisma.user.count()).toBe(1);
  });

  it("anuncia el alta", async () => {
    await createUser();

    expect(lastFlash()).toMatchObject({ tone: "exito", message: "Usuario creado." });
  });

  it("responde 400 con el error de campo si el email ya existe", async () => {
    await createUser();

    const response = await usersRoute.POST(formRequest("http://localhost/api/users", userForm()));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { errors: Record<string, string> };
    expect(body.errors.email).toMatch(/ya existe/i);
  });

  it("responde 400 si las contraseñas no coinciden", async () => {
    const response = await usersRoute.POST(
      formRequest("http://localhost/api/users", userForm({ confirmPassword: "otra-distinta" })),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { errors: Record<string, string> };
    expect(body.errors.confirmPassword).toMatch(/no coinciden/);
  });
});

describe("POST /api/users/[id]/password", () => {
  it("cambia la contraseña y responde con el mensaje en el cuerpo, sin flash", async () => {
    const id = await createUser();
    cookieJar.clear();

    const response = await passwordRoute.POST(
      formRequest(
        `http://localhost/api/users/${id}/password`,
        formDataFrom({ password: "otra-contraseña-larga", confirmPassword: "otra-contraseña-larga" }),
      ),
      paramsOf(id),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { message: string };
    expect(body.message).toBe("Contraseña actualizada.");
    expect(lastFlash()).toBeNull();
  });

  it("responde 404 si el usuario ya no existe", async () => {
    const response = await passwordRoute.POST(
      formRequest(
        "http://localhost/api/users/no-existe/password",
        formDataFrom({ password: "otra-contraseña-larga", confirmPassword: "otra-contraseña-larga" }),
      ),
      paramsOf("no-existe"),
    );

    expect(response.status).toBe(404);
  });

  it("responde 400 si la contraseña es demasiado corta", async () => {
    const id = await createUser();

    const response = await passwordRoute.POST(
      formRequest(
        `http://localhost/api/users/${id}/password`,
        formDataFrom({ password: "corta", confirmPassword: "corta" }),
      ),
      paramsOf(id),
    );

    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/users/[id]", () => {
  it("borra el usuario y anuncia la baja", async () => {
    const id = await createUser();

    const response = await userRoute.DELETE(
      new NextRequest(`http://localhost/api/users/${id}`, { method: "DELETE" }),
      paramsOf(id),
    );

    expect(response.status).toBe(200);
    expect(await prisma.user.count()).toBe(0);
    expect(lastFlash()).toMatchObject({ tone: "aviso", message: "Usuario eliminado." });
  });

  it("responde 404 si el usuario ya no existe", async () => {
    const response = await userRoute.DELETE(
      new NextRequest("http://localhost/api/users/no-existe", { method: "DELETE" }),
      paramsOf("no-existe"),
    );

    expect(response.status).toBe(404);
  });
});
