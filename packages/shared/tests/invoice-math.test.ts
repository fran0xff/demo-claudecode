import { describe, expect, it } from "vitest";
import {
  computeInvoiceTotals,
  computeLineTotal,
  formatInvoiceNumber,
} from "@/lib/invoice-math";

describe("computeLineTotal", () => {
  it("multiplica cantidad por precio", () => {
    expect(computeLineTotal({ quantity: 3, unitPrice: 100, vatRate: 21 })).toBe(300);
  });

  it("aplica el descuento de la línea", () => {
    expect(
      computeLineTotal({ quantity: 3, unitPrice: 100, vatRate: 21, discountPct: 10 }),
    ).toBe(270);
  });

  it("redondea a 2 decimales", () => {
    // 2,5 x 33,333 = 83,3325
    expect(computeLineTotal({ quantity: 2.5, unitPrice: 33.333, vatRate: 21 })).toBe(83.33);
  });
});

describe("computeInvoiceTotals", () => {
  it("calcula una factura de una sola línea", () => {
    const totals = computeInvoiceTotals([{ quantity: 1, unitPrice: 100, vatRate: 21 }]);

    expect(totals.subtotal).toBe(100);
    expect(totals.taxTotal).toBe(21);
    expect(totals.irpfTotal).toBe(0);
    expect(totals.total).toBe(121);
  });

  it("agrupa el desglose por tipo de IVA, de mayor a menor", () => {
    const totals = computeInvoiceTotals([
      { quantity: 2, unitPrice: 100, vatRate: 21 },
      { quantity: 1, unitPrice: 50, vatRate: 10 },
      { quantity: 1, unitPrice: 100, vatRate: 21 },
    ]);

    expect(totals.vatBreakdown).toEqual([
      { vatRate: 21, base: 300, amount: 63 },
      { vatRate: 10, base: 50, amount: 5 },
    ]);
    expect(totals.subtotal).toBe(350);
    expect(totals.taxTotal).toBe(68);
    expect(totals.total).toBe(418);
  });

  it("aplica el IVA sobre la base agrupada, no línea a línea", () => {
    // Cada línea por separado daría 1,15 x 10 % = 0,115 -> 0,12, y 0,24 en
    // total. Sobre la base agrupada (2,30) son 0,23, que es lo correcto.
    const totals = computeInvoiceTotals([
      { quantity: 1, unitPrice: 1.15, vatRate: 10 },
      { quantity: 1, unitPrice: 1.15, vatRate: 10 },
    ]);

    expect(totals.subtotal).toBe(2.3);
    expect(totals.taxTotal).toBe(0.23);
    expect(totals.total).toBe(2.53);
  });

  it("resta la retención de IRPF sobre la base imponible", () => {
    const totals = computeInvoiceTotals(
      [
        { quantity: 2, unitPrice: 100, vatRate: 21 },
        { quantity: 1, unitPrice: 50, vatRate: 10 },
      ],
      15,
    );

    expect(totals.subtotal).toBe(250);
    expect(totals.taxTotal).toBe(47);
    expect(totals.irpfTotal).toBe(37.5);
    expect(totals.total).toBe(259.5);
  });

  it("el desglose cuadra siempre con el total", () => {
    const totals = computeInvoiceTotals(
      [
        { quantity: 3, unitPrice: 33.33, vatRate: 21 },
        { quantity: 7, unitPrice: 1.99, vatRate: 4, discountPct: 5 },
        { quantity: 1, unitPrice: 12.5, vatRate: 0 },
      ],
      7,
    );

    const basesSum = totals.vatBreakdown.reduce((acc, entry) => acc + entry.base, 0);
    expect(basesSum).toBeCloseTo(totals.subtotal, 2);
    expect(totals.subtotal + totals.taxTotal - totals.irpfTotal).toBeCloseTo(totals.total, 2);
  });

  it("soporta una factura sin líneas", () => {
    const totals = computeInvoiceTotals([]);

    expect(totals.subtotal).toBe(0);
    expect(totals.total).toBe(0);
    expect(totals.vatBreakdown).toEqual([]);
  });
});

describe("formatInvoiceNumber", () => {
  it("rellena el correlativo a 4 dígitos", () => {
    expect(formatInvoiceNumber("A", 2026, 1)).toBe("A-2026-0001");
    expect(formatInvoiceNumber("B", 2026, 1234)).toBe("B-2026-1234");
  });
});
