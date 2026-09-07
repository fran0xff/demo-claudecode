import { describe, expect, it, vi } from "vitest";
import {
  findInvoicesByClientName,
  getInvoiceSummary,
  getSummaryTotals,
  type Queryable,
} from "../src/invoice-repository.js";

function crearDbFalsa(...respuestas: Array<{ rows: unknown[] }>): Queryable {
  const query = vi.fn();
  respuestas.forEach((respuesta) => query.mockResolvedValueOnce(respuesta));
  return { query } as unknown as Queryable;
}

describe("getInvoiceSummary", () => {
  it("devuelve null si la factura no existe, sin consultar las líneas", async () => {
    const db = crearDbFalsa({ rows: [] });

    const resultado = await getInvoiceSummary(db, "no-existe");

    expect(resultado).toBeNull();
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it("devuelve el cliente, las líneas y el total, convirtiendo los Decimal a number", async () => {
    const db = crearDbFalsa(
      { rows: [{ id: "inv_1", clientName: "Acme SL", total: "121.00" }] },
      {
        rows: [
          { description: "Consultoría", quantity: "2.00", unitPrice: "50.00", lineTotal: "100.00" },
          { description: "Soporte", quantity: "1.00", unitPrice: "21.00", lineTotal: "21.00" },
        ],
      },
    );

    const resultado = await getInvoiceSummary(db, "inv_1");

    expect(resultado).toEqual({
      invoiceId: "inv_1",
      clientName: "Acme SL",
      total: 121,
      lines: [
        { description: "Consultoría", quantity: 2, unitPrice: 50, subtotal: 100 },
        { description: "Soporte", quantity: 1, unitPrice: 21, subtotal: 21 },
      ],
    });
    expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining("InvoiceLine"), ["inv_1"]);
  });
});

describe("findInvoicesByClientName", () => {
  it("devuelve un array vacío si no hay coincidencias, sin consultar las líneas", async () => {
    const db = crearDbFalsa({ rows: [] });

    const resultado = await findInvoicesByClientName(db, "Nadie SL");

    expect(resultado).toEqual([]);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it("escapa % _ y \\ en el término de búsqueda antes de mandarlo como parámetro", async () => {
    const db = crearDbFalsa({ rows: [] });

    await findInvoicesByClientName(db, "Acme_Corp 100%");

    expect(db.query).toHaveBeenCalledWith(expect.any(String), ["%Acme\\_Corp 100\\%%"]);
  });

  it("agrupa correctamente las líneas de cada factura y convierte fechas y Decimal", async () => {
    const filaBase = {
      series: "A",
      year: 2026,
      status: "PAGADA",
      dueDate: null,
      currency: "EUR",
      issuerName: "Yo",
      issuerTaxId: "X",
      issuerAddress: "Calle 1",
      clientTaxId: "Y",
      clientAddress: "Calle 2",
      clientEmail: null,
      irpfRate: "0",
      notes: null,
      subtotal: "100.00",
      taxTotal: "21.00",
      irpfTotal: "0",
      total: "121.00",
    };

    const db = crearDbFalsa(
      {
        rows: [
          { ...filaBase, id: "inv_1", number: 1, clientName: "Acme SL", issueDate: new Date("2026-01-10") },
          { ...filaBase, id: "inv_2", number: 2, clientName: "Acme Retail", issueDate: new Date("2026-02-05") },
        ],
      },
      {
        rows: [
          {
            id: "line_1",
            invoiceId: "inv_1",
            position: 1,
            description: "Servicio A",
            quantity: "1.00",
            unitPrice: "100.00",
            vatRate: "21.00",
            discountPct: "0",
            lineTotal: "100.00",
          },
          {
            id: "line_2",
            invoiceId: "inv_2",
            position: 1,
            description: "Servicio B",
            quantity: "1.00",
            unitPrice: "100.00",
            vatRate: "21.00",
            discountPct: "0",
            lineTotal: "100.00",
          },
        ],
      },
    );

    const [factura1, factura2] = await findInvoicesByClientName(db, "Acme");

    expect(factura1.id).toBe("inv_1");
    expect(factura1.issueDate).toBe(new Date("2026-01-10").toISOString());
    expect(factura1.dueDate).toBeNull();
    expect(factura1.total).toBe(121);
    expect(factura1.lines).toEqual([
      {
        id: "line_1",
        position: 1,
        description: "Servicio A",
        quantity: 1,
        unitPrice: 100,
        vatRate: 21,
        discountPct: 0,
        lineTotal: 100,
      },
    ]);

    expect(factura2.id).toBe("inv_2");
    expect(factura2.lines).toHaveLength(1);
    expect(factura2.lines[0].id).toBe("line_2");
  });
});

describe("getSummaryTotals", () => {
  it("consulta con los estados correctos y convierte el resultado a number", async () => {
    const db = crearDbFalsa({
      rows: [{ totalEmitidas: "1000.50", totalCobradas: "600.00", totalPorCobrar: "400.50" }],
    });

    const totales = await getSummaryTotals(db);

    expect(totales).toEqual({ totalEmitidas: 1000.5, totalCobradas: 600, totalPorCobrar: 400.5 });
    expect(db.query).toHaveBeenCalledWith(expect.any(String), [
      ["EMITIDA", "ENVIADA", "PAGADA"],
      "PAGADA",
      ["EMITIDA", "ENVIADA"],
    ]);
  });

  it("devuelve ceros cuando no hay ninguna factura", async () => {
    const db = crearDbFalsa({ rows: [{ totalEmitidas: "0", totalCobradas: "0", totalPorCobrar: "0" }] });

    const totales = await getSummaryTotals(db);

    expect(totales).toEqual({ totalEmitidas: 0, totalCobradas: 0, totalPorCobrar: 0 });
  });
});
