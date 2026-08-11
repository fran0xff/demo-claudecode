import { describe, expect, it } from "vitest";
import { fieldErrors, invoiceSchema } from "@/lib/validation";

const validInvoice = {
  series: "A",
  issueDate: "2026-03-05",
  dueDate: "",
  clientName: "Acme S.L.",
  clientTaxId: "b12345674",
  clientAddress: "Calle Mayor 1, Madrid",
  clientEmail: "",
  irpfRate: "15",
  notes: "",
  lines: [
    { description: "Consultoría", quantity: "10", unitPrice: "60", vatRate: "21", discountPct: "" },
  ],
};

describe("invoiceSchema", () => {
  it("acepta una factura válida y normaliza los tipos", () => {
    const result = invoiceSchema.safeParse(validInvoice);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.clientTaxId).toBe("B12345674");
    expect(result.data.irpfRate).toBe(15);
    expect(result.data.lines[0].quantity).toBe(10);
    expect(result.data.lines[0].discountPct).toBe(0);
    expect(result.data.issueDate).toBeInstanceOf(Date);
    expect(result.data.issueDate.getFullYear()).toBe(2026);
    // "2026-03-05" no debe desplazarse un día por la zona horaria.
    expect(result.data.issueDate.getDate()).toBe(5);
  });

  it("convierte los campos opcionales vacíos en null", () => {
    const result = invoiceSchema.safeParse(validInvoice);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.dueDate).toBeNull();
    expect(result.data.clientEmail).toBeNull();
    expect(result.data.notes).toBeNull();
  });

  it("acepta la coma como separador decimal", () => {
    const result = invoiceSchema.safeParse({
      ...validInvoice,
      lines: [{ ...validInvoice.lines[0], unitPrice: "60,50" }],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.lines[0].unitPrice).toBe(60.5);
  });

  it("rechaza una factura sin líneas", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, lines: [] });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldErrors(result.error).lines).toMatch(/al menos una línea/);
  });

  it("rechaza un NIF/CIF inválido", () => {
    const result = invoiceSchema.safeParse({ ...validInvoice, clientTaxId: "B12345675" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldErrors(result.error).clientTaxId).toMatch(/no válido/);
  });

  it("rechaza cantidades no positivas y las localiza en su línea", () => {
    const result = invoiceSchema.safeParse({
      ...validInvoice,
      lines: [validInvoice.lines[0], { ...validInvoice.lines[0], quantity: "0" }],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldErrors(result.error)["lines.1.quantity"]).toMatch(/mayor que 0/);
  });

  it("rechaza texto donde se espera un número", () => {
    const result = invoiceSchema.safeParse({
      ...validInvoice,
      lines: [{ ...validInvoice.lines[0], unitPrice: "abc" }],
    });

    expect(result.success).toBe(false);
  });
});
