"use client";

import { useEffect } from "react";

/**
 * El PDF lo genera el propio navegador.
 *
 * En vez de una segunda maquetación en una librería de PDF, la factura se
 * imprime desde el mismo HTML que se ve en pantalla, con la hoja de estilos
 * `@media print` de `globals.css`. Así no hay dos diseños que mantener en
 * sintonía, y el usuario elige "Guardar como PDF" en el diálogo del navegador.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      title="Abre el diálogo de impresión: elige «Guardar como PDF»"
      className="btn-secondary no-print"
    >
      PDF
    </button>
  );
}

/**
 * Abre el diálogo al llegar desde el listado con `?imprimir=1`.
 *
 * `window.print` es un sistema externo, que es justo para lo que sirve un
 * efecto. La pequeña espera deja que se apliquen los estilos antes de que el
 * navegador componga las páginas.
 */
export function AutoPrint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  return null;
}
