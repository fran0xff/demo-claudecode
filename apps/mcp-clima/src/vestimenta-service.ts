import type { DatosClima } from "./clima-service.js";

/**
 * Reglas de recomendación de vestimenta a partir del clima actual de una
 * ciudad. Se basa en la sensación térmica (no la temperatura seca, que
 * puede engañar con viento o humedad) y añade prendas extra según
 * precipitación, viento y el tipo de condición (lluvia, nieve, tormenta).
 */

const CODIGOS_LLUVIA = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const CODIGOS_NIEVE = new Set([71, 73, 75, 77, 85, 86]);
const CODIGOS_TORMENTA = new Set([95, 96, 99]);
const CODIGOS_NIEBLA = new Set([45, 48]);

const UMBRAL_VIENTO_FUERTE_KMH = 30;
const UMBRAL_HUMEDAD_ALTA = 80;

export type RecomendacionVestimenta = {
  prendas: string[];
  resumen: string;
};

function prendasPorSensacionTermica(sensacionTermica: number): string[] {
  if (sensacionTermica < 0) {
    return ["abrigo de invierno grueso", "gorro", "guantes", "bufanda", "varias capas de ropa"];
  }
  if (sensacionTermica < 10) {
    return ["abrigo", "bufanda", "ropa por capas"];
  }
  if (sensacionTermica < 16) {
    return ["chaqueta de entretiempo"];
  }
  if (sensacionTermica < 22) {
    return ["manga larga ligera o camiseta con chaqueta fina"];
  }
  if (sensacionTermica < 28) {
    return ["ropa ligera de manga corta"];
  }
  return ["ropa muy ligera y transpirable", "protección solar"];
}

export function recomendarVestimenta(datos: DatosClima): RecomendacionVestimenta {
  const prendas = [...prendasPorSensacionTermica(datos.sensacionTermica)];

  if (CODIGOS_LLUVIA.has(datos.codigoClima) || datos.precipitacion > 0) {
    prendas.push("paraguas o chubasquero", "calzado impermeable");
  }

  if (CODIGOS_NIEVE.has(datos.codigoClima)) {
    prendas.push("botas impermeables y antideslizantes", "guantes térmicos");
  }

  if (CODIGOS_TORMENTA.has(datos.codigoClima)) {
    prendas.push("evita permanecer al aire libre mientras dure la tormenta eléctrica");
  }

  if (CODIGOS_NIEBLA.has(datos.codigoClima)) {
    prendas.push("prendas con elementos reflectantes si caminas cerca de tráfico");
  }

  if (datos.velocidadViento >= UMBRAL_VIENTO_FUERTE_KMH) {
    prendas.push("cortavientos");
  }

  if (datos.humedadRelativa >= UMBRAL_HUMEDAD_ALTA && datos.sensacionTermica >= 22) {
    prendas.push("tejidos transpirables, evita sintéticos");
  }

  const resumen =
    `En ${datos.ciudad} hace ${datos.temperatura}°C ` +
    `(sensación de ${datos.sensacionTermica}°C), ${datos.descripcionClima.toLowerCase()}. ` +
    `Se recomienda: ${prendas.join(", ")}.`;

  return { prendas, resumen };
}
