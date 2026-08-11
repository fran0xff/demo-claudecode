import { z } from "zod";
import { isValidTaxId, normalizeTaxId } from "@/lib/tax-id";

/**
 * Esquemas compartidos entre el formulario y las Server Actions, para que el
 * cliente y el servidor apliquen exactamente las mismas reglas.
 */

/**
 * Los `<input>` entregan strings. Los normalizamos (coma decimal incluida)
 * antes de validarlos como número.
 */
function numeric(schema: z.ZodNumber, { fallback }: { fallback?: number } = {}) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const normalized = value.trim().replace(",", ".");
    if (normalized === "") return fallback;
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? value : parsed;
  }, schema);
}

/** Cadena opcional: "" y espacios en blanco cuentan como ausencia. */
function optionalText(schema: z.ZodString) {
  return z.preprocess((value) => {
    if (typeof value !== "string") return value ?? null;
    return value.trim() === "" ? null : value.trim();
  }, schema.nullable());
}

const dateFromInput = z.preprocess(
  (value) => {
    if (typeof value !== "string" || value.trim() === "") return value;
    // "2026-03-05" -> medianoche local, no UTC, para que no se desplace un día.
    const parsed = new Date(`${value.trim()}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? value : parsed;
  },
  z.date({ error: "Introduce una fecha válida" }),
);

const optionalDateFromInput = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.union([z.null(), dateFromInput]),
);

const taxId = z
  .string()
  .trim()
  .min(1, "El NIF/CIF es obligatorio")
  .refine(isValidTaxId, "NIF/CIF no válido (por ejemplo: B12345674 o 12345678Z)")
  .transform(normalizeTaxId);

export const invoiceLineSchema = z.object({
  description: z.string().trim().min(1, "La descripción es obligatoria"),
  quantity: numeric(z.number().gt(0, "La cantidad debe ser mayor que 0")),
  unitPrice: numeric(z.number().min(0, "El precio no puede ser negativo")),
  vatRate: numeric(
    z.number().min(0, "El IVA no puede ser negativo").max(100, "El IVA no puede superar el 100 %"),
  ),
  discountPct: numeric(
    z
      .number()
      .min(0, "El descuento no puede ser negativo")
      .max(100, "El descuento no puede superar el 100 %"),
    { fallback: 0 },
  ),
});

export const invoiceSchema = z.object({
  series: z.string().trim().min(1, "La serie es obligatoria").max(10, "Serie demasiado larga"),
  issueDate: dateFromInput,
  dueDate: optionalDateFromInput,
  clientName: z.string().trim().min(1, "El nombre del cliente es obligatorio"),
  clientTaxId: taxId,
  clientAddress: z.string().trim().min(1, "La dirección del cliente es obligatoria"),
  clientEmail: optionalText(z.string().email("Email no válido")),
  irpfRate: numeric(
    z
      .number()
      .min(0, "La retención no puede ser negativa")
      .max(100, "La retención no puede superar el 100 %"),
    { fallback: 0 },
  ),
  notes: optionalText(z.string().max(2000, "Las notas son demasiado largas")),
  lines: z.array(invoiceLineSchema).min(1, "Añade al menos una línea a la factura"),
});

export const settingsSchema = z.object({
  issuerName: z.string().trim().min(1, "El nombre del emisor es obligatorio"),
  issuerTaxId: taxId,
  issuerAddress: z.string().trim().min(1, "La dirección del emisor es obligatoria"),
  defaultSeries: z.string().trim().min(1, "La serie es obligatoria").max(10, "Serie demasiado larga"),
  defaultVatRate: numeric(z.number().min(0).max(100), { fallback: 21 }),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;

/**
 * Aplana los errores de Zod a `{ "lines.0.quantity": "mensaje" }`, que es lo
 * que el formulario necesita para pintar el error junto a cada campo.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    result[key] ??= issue.message;
  }
  return result;
}
