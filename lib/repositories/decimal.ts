/**
 * Conversión `Decimal` de Prisma -> `number` plano.
 *
 * Solo los repositorios importan Prisma, así que solo ellos ven objetos
 * `Decimal`; este helper es lo que usan para no dejarlos cruzar hacia la capa
 * de servicio, que espera `number`s ya listos para operar o serializar.
 */

// `Decimal` de Prisma expone toNumber(); aceptamos también number por si el
// driver ya lo entrega convertido.
export type DecimalLike = { toNumber(): number } | number;

export function num(value: DecimalLike): number {
  return typeof value === "number" ? value : value.toNumber();
}
