import { describe, expect, it } from "vitest";
import type { DatosClima } from "../src/clima-service.js";
import { recomendarVestimenta } from "../src/vestimenta-service.js";

function crearClima(overrides: Partial<DatosClima> = {}): DatosClima {
  return {
    ciudad: "Madrid",
    pais: "España",
    zonaHoraria: "Europe/Madrid",
    horaLocal: "2026-09-07T12:00",
    temperatura: 20,
    sensacionTermica: 20,
    humedadRelativa: 50,
    precipitacion: 0,
    velocidadViento: 10,
    codigoClima: 0,
    descripcionClima: "Despejado",
    ...overrides,
  };
}

describe("recomendarVestimenta", () => {
  it("recomienda abrigo de invierno con sensación térmica bajo cero", () => {
    const { prendas } = recomendarVestimenta(crearClima({ sensacionTermica: -5 }));
    expect(prendas).toContain("abrigo de invierno grueso");
    expect(prendas).toContain("guantes");
  });

  it("recomienda ropa ligera con calor", () => {
    const { prendas } = recomendarVestimenta(crearClima({ sensacionTermica: 30 }));
    expect(prendas).toContain("ropa muy ligera y transpirable");
    expect(prendas).toContain("protección solar");
  });

  it("añade paraguas cuando el código de clima indica lluvia", () => {
    const { prendas } = recomendarVestimenta(crearClima({ codigoClima: 61, precipitacion: 2 }));
    expect(prendas).toContain("paraguas o chubasquero");
    expect(prendas).toContain("calzado impermeable");
  });

  it("añade botas impermeables cuando el código de clima indica nieve", () => {
    const { prendas } = recomendarVestimenta(crearClima({ sensacionTermica: -2, codigoClima: 73 }));
    expect(prendas).toContain("botas impermeables y antideslizantes");
  });

  it("añade aviso de tormenta con códigos de tormenta eléctrica", () => {
    const { prendas } = recomendarVestimenta(crearClima({ codigoClima: 95 }));
    expect(prendas.some((p) => p.includes("tormenta eléctrica"))).toBe(true);
  });

  it("añade cortavientos con viento fuerte", () => {
    const { prendas } = recomendarVestimenta(crearClima({ velocidadViento: 40 }));
    expect(prendas).toContain("cortavientos");
  });

  it("incluye el nombre de la ciudad y la temperatura en el resumen", () => {
    const { resumen } = recomendarVestimenta(crearClima({ ciudad: "Sevilla", temperatura: 22 }));
    expect(resumen).toContain("Sevilla");
    expect(resumen).toContain("22°C");
  });
});
