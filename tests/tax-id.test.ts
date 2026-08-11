import { describe, expect, it } from "vitest";
import { isValidTaxId, normalizeTaxId } from "@/lib/tax-id";

describe("isValidTaxId", () => {
  it("acepta NIF con letra de control correcta", () => {
    expect(isValidTaxId("12345678Z")).toBe(true);
    expect(isValidTaxId("00000000T")).toBe(true);
  });

  it("rechaza NIF con letra de control incorrecta", () => {
    expect(isValidTaxId("12345678A")).toBe(false);
  });

  it("acepta NIE", () => {
    expect(isValidTaxId("X1234567L")).toBe(true);
  });

  it("rechaza NIE con control incorrecto", () => {
    expect(isValidTaxId("X1234567A")).toBe(false);
  });

  it("acepta CIF de sociedad con control numérico", () => {
    expect(isValidTaxId("B12345674")).toBe(true);
  });

  it("rechaza CIF con control incorrecto", () => {
    expect(isValidTaxId("B12345675")).toBe(false);
  });

  it("rechaza un CIF de sociedad cuyo control es letra en vez de dígito", () => {
    // La 'B' exige control numérico, así que la variante con letra no vale.
    expect(isValidTaxId("B1234567E")).toBe(false);
  });

  it("rechaza formatos que no son identificadores fiscales", () => {
    expect(isValidTaxId("")).toBe(false);
    expect(isValidTaxId("1234567")).toBe(false);
    expect(isValidTaxId("HOLA")).toBe(false);
  });

  it("tolera espacios, guiones y minúsculas", () => {
    expect(isValidTaxId(" 12345678-z ")).toBe(true);
  });
});

describe("normalizeTaxId", () => {
  it("pasa a mayúsculas y quita separadores", () => {
    expect(normalizeTaxId(" b-1234 5674 ")).toBe("B12345674");
  });
});
