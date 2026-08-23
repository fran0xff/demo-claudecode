/**
 * Validación de NIF / NIE / CIF españoles.
 *
 * Comprueba el dígito o letra de control, no solo el formato: un NIF con la
 * letra equivocada es tan inválido como uno con menos dígitos, y en una
 * factura ese error se propaga hasta el modelo 347.
 */

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
const NIE_PREFIX: Record<string, string> = { X: "0", Y: "1", Z: "2" };

// Letras válidas como primer carácter de un CIF, según el tipo de entidad.
const CIF_LETTERS = "ABCDEFGHJNPQRSUVW";
// Entidades cuyo control es siempre una letra (P: corporaciones locales,
// Q: organismos públicos, S: órganos de la Administración, etc.).
const CIF_LETTER_ONLY = "PQRSNW";
// Entidades cuyo control es siempre un dígito (A: S.A., B: S.L., ...).
const CIF_DIGIT_ONLY = "ABEH";
const CIF_CONTROL_LETTERS = "JABCDEFGHI";

export function normalizeTaxId(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]/g, "");
}

function isValidDni(taxId: string): boolean {
  const match = /^(\d{8})([A-Z])$/.exec(taxId);
  if (!match) return false;
  return DNI_LETTERS[Number(match[1]) % 23] === match[2];
}

function isValidNie(taxId: string): boolean {
  const match = /^([XYZ])(\d{7})([A-Z])$/.exec(taxId);
  if (!match) return false;
  const digits = NIE_PREFIX[match[1]] + match[2];
  return DNI_LETTERS[Number(digits) % 23] === match[3];
}

function isValidCif(taxId: string): boolean {
  const match = new RegExp(`^([${CIF_LETTERS}])(\\d{7})([0-9A-J])$`).exec(taxId);
  if (!match) return false;

  const [, kind, digits, control] = match;

  // Posiciones impares (1ª, 3ª, 5ª, 7ª) se duplican y se suman sus cifras;
  // las pares se suman tal cual.
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const digit = Number(digits[i]);
    if (i % 2 === 0) {
      const doubled = digit * 2;
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else {
      sum += digit;
    }
  }

  const controlDigit = (10 - (sum % 10)) % 10;
  const controlLetter = CIF_CONTROL_LETTERS[controlDigit];

  if (CIF_LETTER_ONLY.includes(kind)) return control === controlLetter;
  if (CIF_DIGIT_ONLY.includes(kind)) return control === String(controlDigit);
  return control === String(controlDigit) || control === controlLetter;
}

/** ¿Es un NIF, NIE o CIF español válido? */
export function isValidTaxId(value: string): boolean {
  const taxId = normalizeTaxId(value);
  return isValidDni(taxId) || isValidNie(taxId) || isValidCif(taxId);
}
