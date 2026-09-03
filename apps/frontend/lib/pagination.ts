/**
 * Qué números de página pintar alrededor de la actual, sin traer las 20 o 200
 * páginas que pueda haber: siempre la actual ± 3, más la primera y la última
 * sueltas (con un "…" en medio si queda hueco), para poder saltar a los
 * extremos sin recorrer las intermedias.
 */
export type PaginationItem = number | "ellipsis-start" | "ellipsis-end";

export function paginationItems(page: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 1) return [1];

  const windowStart = Math.max(1, page - 3);
  const windowEnd = Math.min(totalPages, page + 3);

  const items: PaginationItem[] = [1];

  if (windowStart > 2) items.push("ellipsis-start");

  for (let p = Math.max(windowStart, 2); p <= Math.min(windowEnd, totalPages - 1); p++) {
    items.push(p);
  }

  if (windowEnd < totalPages - 1) items.push("ellipsis-end");

  items.push(totalPages);

  return items;
}
