/**
 * Obtiene hora local y clima actual de una ciudad usando la API pública de
 * Open-Meteo (sin API key, apta para un servidor MCP local): primero se
 * geocodifica el nombre de la ciudad a coordenadas, y con esas coordenadas
 * se pide el tiempo actual con `timezone=auto`, que además devuelve la hora
 * ya expresada en la zona horaria del lugar.
 */

const URL_GEOCODIFICACION = "https://geocoding-api.open-meteo.com/v1/search";
const URL_PRONOSTICO = "https://api.open-meteo.com/v1/forecast";

/** Descripciones en español de los códigos de tiempo WMO que usa Open-Meteo. */
const DESCRIPCIONES_CODIGO_CLIMA: Record<number, string> = {
  0: "Despejado",
  1: "Mayormente despejado",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Niebla",
  48: "Niebla con escarcha",
  51: "Llovizna ligera",
  53: "Llovizna moderada",
  55: "Llovizna intensa",
  56: "Llovizna helada ligera",
  57: "Llovizna helada intensa",
  61: "Lluvia ligera",
  63: "Lluvia moderada",
  65: "Lluvia intensa",
  66: "Lluvia helada ligera",
  67: "Lluvia helada intensa",
  71: "Nevada ligera",
  73: "Nevada moderada",
  75: "Nevada intensa",
  77: "Granos de nieve",
  80: "Chubascos ligeros",
  81: "Chubascos moderados",
  82: "Chubascos violentos",
  85: "Chubascos de nieve ligeros",
  86: "Chubascos de nieve intensos",
  95: "Tormenta eléctrica",
  96: "Tormenta eléctrica con granizo ligero",
  99: "Tormenta eléctrica con granizo intenso",
};

export function describirCodigoClima(codigo: number): string {
  return DESCRIPCIONES_CODIGO_CLIMA[codigo] ?? "Condición desconocida";
}

export type DatosClima = {
  ciudad: string;
  pais: string;
  zonaHoraria: string;
  horaLocal: string;
  temperatura: number;
  sensacionTermica: number;
  humedadRelativa: number;
  precipitacion: number;
  velocidadViento: number;
  codigoClima: number;
  descripcionClima: string;
};

type ResultadoGeocodificacion = {
  results?: Array<{
    name: string;
    country: string;
    latitude: number;
    longitude: number;
  }>;
};

type ResultadoPronostico = {
  timezone: string;
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
  };
};

async function geocodificarCiudad(
  ciudad: string,
): Promise<{ nombre: string; pais: string; latitud: number; longitud: number }> {
  const url = new URL(URL_GEOCODIFICACION);
  url.searchParams.set("name", ciudad);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "es");
  url.searchParams.set("format", "json");

  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new Error(`No se pudo geocodificar la ciudad "${ciudad}" (HTTP ${respuesta.status}).`);
  }

  const datos = (await respuesta.json()) as ResultadoGeocodificacion;
  const resultado = datos.results?.[0];
  if (!resultado) {
    throw new Error(`No se encontró ninguna ciudad que coincida con "${ciudad}".`);
  }

  return {
    nombre: resultado.name,
    pais: resultado.country,
    latitud: resultado.latitude,
    longitud: resultado.longitude,
  };
}

async function consultarPronostico(latitud: number, longitud: number): Promise<ResultadoPronostico> {
  const url = new URL(URL_PRONOSTICO);
  url.searchParams.set("latitude", String(latitud));
  url.searchParams.set("longitude", String(longitud));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
  );
  url.searchParams.set("timezone", "auto");

  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new Error(`No se pudo obtener el pronóstico del tiempo (HTTP ${respuesta.status}).`);
  }

  return (await respuesta.json()) as ResultadoPronostico;
}

export async function obtenerClimaCiudad(ciudad: string): Promise<DatosClima> {
  const ubicacion = await geocodificarCiudad(ciudad);
  const pronostico = await consultarPronostico(ubicacion.latitud, ubicacion.longitud);
  const actual = pronostico.current;

  return {
    ciudad: ubicacion.nombre,
    pais: ubicacion.pais,
    zonaHoraria: pronostico.timezone,
    horaLocal: actual.time,
    temperatura: actual.temperature_2m,
    sensacionTermica: actual.apparent_temperature,
    humedadRelativa: actual.relative_humidity_2m,
    precipitacion: actual.precipitation,
    velocidadViento: actual.wind_speed_10m,
    codigoClima: actual.weather_code,
    descripcionClima: describirCodigoClima(actual.weather_code),
  };
}
