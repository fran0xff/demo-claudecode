import { SignJWT } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * `lib/security/jwt.ts` calcula el secreto una sola vez al cargar el módulo
 * (falla rápido si falta o es débil), así que aquí se fija `AUTH_JWT_SECRET`
 * antes de importarlo, igual que los otros tests fijan `DATABASE_URL` antes
 * de importar `lib/db.ts`.
 */

const TEST_SECRET = "clave-de-pruebas-con-al-menos-32-bytes-de-largo";

let jwtModule: typeof import("@/lib/security/jwt");

beforeAll(async () => {
  process.env.AUTH_JWT_SECRET = TEST_SECRET;
  jwtModule = await import("@/lib/security/jwt");
});

describe("signAuthToken / verifyAuthToken", () => {
  it("verifica un token recién firmado y devuelve su payload", async () => {
    const { token } = await jwtModule.signAuthToken({ sub: "user-1", email: "a@b.com" });
    const payload = await jwtModule.verifyAuthToken(token);
    expect(payload).toEqual({ sub: "user-1", email: "a@b.com" });
  });

  it("rechaza un token firmado con otra clave", async () => {
    const otherSecret = new TextEncoder().encode("otra-clave-completamente-distinta-de-32b");
    const token = await new SignJWT({ email: "a@b.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setExpirationTime("24h")
      .sign(otherSecret);

    expect(await jwtModule.verifyAuthToken(token)).toBeNull();
  });

  it("rechaza un token expirado", async () => {
    const secret = new TextEncoder().encode(TEST_SECRET);
    const token = await new SignJWT({ email: "a@b.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(secret);

    expect(await jwtModule.verifyAuthToken(token)).toBeNull();
  });

  it("rechaza un token manipulado con alg:none", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ sub: "user-1", email: "a@b.com", exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url");
    const token = `${header}.${payload}.`;

    expect(await jwtModule.verifyAuthToken(token)).toBeNull();
  });

  it("rechaza basura que no es un JWT", async () => {
    expect(await jwtModule.verifyAuthToken("esto-no-es-un-token")).toBeNull();
  });
});

describe("carga del secreto al importar el módulo", () => {
  it("lanza si falta AUTH_JWT_SECRET", async () => {
    vi.resetModules();
    const original = process.env.AUTH_JWT_SECRET;
    delete process.env.AUTH_JWT_SECRET;

    await expect(import("@/lib/security/jwt")).rejects.toThrow(/AUTH_JWT_SECRET/);

    process.env.AUTH_JWT_SECRET = original;
    vi.resetModules();
  });

  it("lanza si AUTH_JWT_SECRET mide menos de 32 bytes", async () => {
    vi.resetModules();
    const original = process.env.AUTH_JWT_SECRET;
    process.env.AUTH_JWT_SECRET = "demasiado-corta";

    await expect(import("@/lib/security/jwt")).rejects.toThrow(/AUTH_JWT_SECRET/);

    process.env.AUTH_JWT_SECRET = original;
    vi.resetModules();
  });
});
