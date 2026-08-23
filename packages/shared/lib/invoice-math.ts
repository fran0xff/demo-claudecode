import Decimal from "decimal.js";

/**
 * Cálculo de importes de una factura.
 *
 * Módulo puro: no depende de React ni de Prisma, así que lo usan tanto el
 * formulario (para el previsualizado en vivo) como el servidor (que es quien
 * tiene la última palabra sobre los importes que se guardan).
 *
 * Toda la aritmética intermedia va en Decimal; solo se redondea al cerrar cada
 * nivel (línea → base por tipo de IVA → total) y se devuelven `number` ya
 * cuadrados a 2 decimales para que la UI y Prisma los consuman sin fricción.
 */

// En facturación española el redondeo es al alza en el 0,5.
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export type LineInput = {
  quantity: Decimal.Value;
  unitPrice: Decimal.Value;
  /** Tipo de IVA en %: 21, 10, 4 o 0. */
  vatRate: Decimal.Value;
  /** Descuento de la línea en %. */
  discountPct?: Decimal.Value;
};

export type VatBreakdownEntry = {
  vatRate: number;
  /** Base imponible acumulada de las líneas con este tipo. */
  base: number;
  /** Cuota de IVA para esa base. */
  amount: number;
};

export type InvoiceTotals = {
  /** Base imponible de cada línea, en el mismo orden que la entrada. */
  lineTotals: number[];
  /** Desglose por tipo de IVA, de mayor a menor tipo. */
  vatBreakdown: VatBreakdownEntry[];
  subtotal: number;
  taxTotal: number;
  irpfTotal: number;
  total: number;
};

function round2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2);
}

function toNumber(value: Decimal): number {
  return value.toDecimalPlaces(2).toNumber();
}

/** Base imponible de una línea: cantidad x precio, menos el descuento. */
export function computeLineTotal(line: LineInput): number {
  const quantity = new Decimal(line.quantity || 0);
  const unitPrice = new Decimal(line.unitPrice || 0);
  const discount = new Decimal(line.discountPct || 0);
  const factor = new Decimal(1).minus(discount.dividedBy(100));

  return toNumber(round2(quantity.times(unitPrice).times(factor)));
}

/**
 * Calcula todos los importes de una factura.
 *
 * El IVA se aplica sobre la base agrupada por tipo, no línea a línea: sumar
 * cuotas ya redondeadas de cada línea produce descuadres de céntimos y no es
 * como se desglosa una factura española.
 */
export function computeInvoiceTotals(
  lines: LineInput[],
  irpfRate: Decimal.Value = 0,
): InvoiceTotals {
  const lineTotals = lines.map(computeLineTotal);

  // Base imponible acumulada por tipo de IVA.
  const basesByRate = new Map<string, { rate: Decimal; base: Decimal }>();

  lines.forEach((line, index) => {
    const rate = new Decimal(line.vatRate || 0);
    const key = rate.toString();
    const entry = basesByRate.get(key) ?? { rate, base: new Decimal(0) };
    entry.base = entry.base.plus(lineTotals[index]);
    basesByRate.set(key, entry);
  });

  const vatBreakdown = [...basesByRate.values()]
    .sort((a, b) => b.rate.comparedTo(a.rate))
    .map(({ rate, base }) => ({
      vatRate: rate.toNumber(),
      base: toNumber(base),
      amount: toNumber(round2(base.times(rate).dividedBy(100))),
    }));

  const subtotal = lineTotals.reduce(
    (acc: Decimal, value) => acc.plus(value),
    new Decimal(0),
  );
  const taxTotal = vatBreakdown.reduce(
    (acc: Decimal, entry) => acc.plus(entry.amount),
    new Decimal(0),
  );
  const irpfTotal = round2(subtotal.times(new Decimal(irpfRate || 0)).dividedBy(100));
  const total = subtotal.plus(taxTotal).minus(irpfTotal);

  return {
    lineTotals,
    vatBreakdown,
    subtotal: toNumber(subtotal),
    taxTotal: toNumber(taxTotal),
    irpfTotal: toNumber(irpfTotal),
    total: toNumber(total),
  };
}

/**
 * Los tres segmentos del número de factura: serie, año y correlativo. La
 * interfaz los compone por separado para poder atenuar los guiones.
 */
export function invoiceNumberParts(
  series: string,
  year: number,
  number: number,
): [string, string, string] {
  return [series, String(year), String(number).padStart(4, "0")];
}

/** Número de factura legible: "A-2026-0001". */
export function formatInvoiceNumber(
  series: string,
  year: number,
  number: number,
): string {
  return invoiceNumberParts(series, year, number).join("-");
}

/** Tipos de IVA vigentes en España. */
export const VAT_RATES = [21, 10, 4, 0] as const;
