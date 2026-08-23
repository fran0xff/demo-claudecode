import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `lib/security/rate-limit.ts` es un módulo puro (mapas en memoria, sin
 * Prisma ni Next), así que se importa una vez normal, sin `beforeAll` con
 * base de datos temporal como el resto de tests. Cada `it` usa una `key`
 * distinta para no compartir bucket con los demás.
 */

import { checkApiRateLimit, checkLoginRateLimit, clientKey } from "@/lib/security/rate-limit";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkLoginRateLimit", () => {
  it("permite hasta 5 intentos y bloquea el sexto", () => {
    const key = "login-key-1";

    for (let i = 0; i < 5; i++) {
      expect(checkLoginRateLimit(key).allowed).toBe(true);
    }

    const sixth = checkLoginRateLimit(key);
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("no comparte el contador entre claves distintas", () => {
    for (let i = 0; i < 5; i++) checkLoginRateLimit("login-key-2");

    expect(checkLoginRateLimit("login-key-2").allowed).toBe(false);
    expect(checkLoginRateLimit("login-key-3").allowed).toBe(true);
  });

  it("reinicia el contador pasada la ventana de 15 minutos", () => {
    const key = "login-key-4";
    for (let i = 0; i < 5; i++) checkLoginRateLimit(key);
    expect(checkLoginRateLimit(key).allowed).toBe(false);

    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    expect(checkLoginRateLimit(key).allowed).toBe(true);
  });
});

describe("checkApiRateLimit", () => {
  it("permite hasta 120 peticiones por minuto y bloquea la 121", () => {
    const key = "api-key-1";

    for (let i = 0; i < 120; i++) {
      expect(checkApiRateLimit(key).allowed).toBe(true);
    }

    const over = checkApiRateLimit(key);
    expect(over.allowed).toBe(false);
    expect(over.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("reinicia el contador pasado el minuto", () => {
    const key = "api-key-2";
    for (let i = 0; i < 120; i++) checkApiRateLimit(key);
    expect(checkApiRateLimit(key).allowed).toBe(false);

    vi.advanceTimersByTime(60 * 1000 + 1);

    expect(checkApiRateLimit(key).allowed).toBe(true);
  });

  it("es independiente del límite de login aunque compartan clave", () => {
    const key = "shared-key";
    for (let i = 0; i < 5; i++) checkLoginRateLimit(key);
    expect(checkLoginRateLimit(key).allowed).toBe(false);

    // El bucket de login para esta clave está agotado, pero el de la API
    // general es un mapa aparte: no debería verse afectado.
    expect(checkApiRateLimit(key).allowed).toBe(true);
  });
});

describe("clientKey", () => {
  it("usa x-forwarded-for cuando está presente", () => {
    const request = { headers: new Headers({ "x-forwarded-for": "203.0.113.5" }) };
    expect(clientKey(request)).toBe("203.0.113.5");
  });

  it("cae a 'local' sin esa cabecera", () => {
    const request = { headers: new Headers() };
    expect(clientKey(request)).toBe("local");
  });
});
