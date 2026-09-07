import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { describirCodigoClima, obtenerClimaCiudad } from "../src/clima-service.js";

function respuestaJson(cuerpo: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => cuerpo,
  } as Response;
}

describe("describirCodigoClima", () => {
  it("traduce códigos WMO conocidos al español", () => {
    expect(describirCodigoClima(0)).toBe("Despejado");
    expect(describirCodigoClima(61)).toBe("Lluvia ligera");
  });

  it("devuelve un texto por defecto para códigos desconocidos", () => {
    expect(describirCodigoClima(-1)).toBe("Condición desconocida");
  });
});

describe("obtenerClimaCiudad", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("geocodifica la ciudad y combina el resultado con el pronóstico actual", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        respuestaJson({
          results: [{ name: "Madrid", country: "España", latitude: 40.4, longitude: -3.7 }],
        }),
      )
      .mockResolvedValueOnce(
        respuestaJson({
          timezone: "Europe/Madrid",
          current: {
            time: "2026-09-07T12:00",
            temperature_2m: 25,
            apparent_temperature: 24,
            relative_humidity_2m: 40,
            precipitation: 0,
            weather_code: 0,
            wind_speed_10m: 10,
          },
        }),
      );

    const clima = await obtenerClimaCiudad("Madrid");

    expect(clima).toEqual({
      ciudad: "Madrid",
      pais: "España",
      zonaHoraria: "Europe/Madrid",
      horaLocal: "2026-09-07T12:00",
      temperatura: 25,
      sensacionTermica: 24,
      humedadRelativa: 40,
      precipitacion: 0,
      velocidadViento: 10,
      codigoClima: 0,
      descripcionClima: "Despejado",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("lanza un error en español si no encuentra la ciudad", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(respuestaJson({ results: [] }));

    await expect(obtenerClimaCiudad("Ciudad Inexistente")).rejects.toThrow(
      /No se encontró ninguna ciudad/,
    );
  });

  it("lanza un error en español si la geocodificación falla", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(respuestaJson({}, false, 500));

    await expect(obtenerClimaCiudad("Madrid")).rejects.toThrow(/No se pudo geocodificar/);
  });
});
