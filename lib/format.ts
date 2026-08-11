const currencyFormatters = new Map<string, Intl.NumberFormat>();

/** "1.234,56 €" */
export function formatCurrency(value: number, currency = "EUR"): string {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("es-ES", { style: "currency", currency });
    currencyFormatters.set(currency, formatter);
  }
  return formatter.format(value);
}

const numberFormatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "1.234,56" — sin símbolo, para cantidades y porcentajes. */
export function formatAmount(value: number): string {
  return numberFormatter.format(value);
}

/** "12,5 %" sin decimales sobrantes. */
export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value)} %`;
}

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** "05/03/2026" */
export function formatDate(value: Date | string): string {
  return dateFormatter.format(new Date(value));
}

/** Fecha en formato "YYYY-MM-DD" para <input type="date">, en hora local. */
export function toDateInputValue(value: Date | string): string {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
