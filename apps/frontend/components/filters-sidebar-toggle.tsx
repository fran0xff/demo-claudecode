"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import {
  setRootAttribute,
  useStoredPreference,
  writeStoredPreference,
} from "@/hooks/use-stored-preference";
import { FILTERS_SIDEBAR_STORAGE_KEY } from "@/lib/filters-sidebar";

/**
 * Mismo patrón que `NavToggle`: quién se ve lo decide el CSS a partir de
 * `data-filtros` en <html>, no este estado — así el botón correcto ya está
 * pintado en el primer frame, con el atributo que puso el script del
 * `<head>`. Aquí el estado solo sirve para que `aria-expanded` y el texto
 * accesible digan la verdad.
 */

function parseHidden(stored: string | null): boolean {
  return stored === "hidden";
}

function toggleSidebar(hidden: boolean) {
  const value = hidden ? null : "hidden";
  setRootAttribute("data-filtros", value);
  writeStoredPreference(FILTERS_SIDEBAR_STORAGE_KEY, value);
}

export function FiltersSidebarToggle() {
  const hidden = useStoredPreference(FILTERS_SIDEBAR_STORAGE_KEY, parseHidden);
  const label = hidden ? "Mostrar filtros" : "Ocultar filtros";

  return (
    <button
      type="button"
      onClick={() => toggleSidebar(hidden)}
      aria-expanded={!hidden}
      aria-controls="filtros-facturas"
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)]
        text-[var(--muted)] transition hover:text-[var(--foreground)]"
    >
      {hidden ? <ChevronRightIcon /> : <ChevronLeftIcon />}
      <span className="sr-only">{label}</span>
    </button>
  );
}
