"use client";

import { ChevronDownIcon, ChevronUpIcon } from "@/components/icons";
import {
  setRootAttribute,
  useStoredPreference,
  writeStoredPreference,
} from "@/hooks/use-stored-preference";
import { NAV_STORAGE_KEY } from "@/lib/nav";

/*
 * Mostrar u ocultar el menú superior. Comparte con el selector de tema el hook
 * `useStoredPreference`: la preferencia vive en localStorage.
 *
 * Quién se ve y quién no lo decide el CSS a partir de `data-nav` en <html>, no
 * este estado: así el botón correcto ya está pintado en el primer frame, con el
 * atributo que puso el script del <head>. Aquí el estado solo sirve para que
 * `aria-expanded` y el texto accesible digan la verdad.
 */

/** Visible es el estado por defecto y no ensucia el <html> con un atributo. */
function parseHidden(stored: string | null): boolean {
  return stored === "hidden";
}

function toggleNav(hidden: boolean) {
  const value = hidden ? null : "hidden";
  setRootAttribute("data-nav", value);
  writeStoredPreference(NAV_STORAGE_KEY, value);
}

type Props = {
  /** "inline" va dentro del menú; "floating" es el que lo devuelve cuando está oculto. */
  variant: "inline" | "floating";
};

export function NavToggle({ variant }: Props) {
  const hidden = useStoredPreference(NAV_STORAGE_KEY, parseHidden);
  const label = hidden ? "Mostrar el menú" : "Ocultar el menú";

  const base =
    "flex items-center justify-center rounded-full transition text-[var(--muted)] hover:text-[var(--foreground)]";

  return (
    <button
      type="button"
      onClick={() => toggleNav(hidden)}
      aria-expanded={!hidden}
      aria-controls="menu-principal"
      title={label}
      className={
        variant === "floating"
          ? `nav-restore fixed right-4 top-4 z-50 h-9 w-9 border border-[var(--border)] bg-[var(--surface)] shadow-sm ${base}`
          : `h-7 w-7 border border-[var(--border)] ${base}`
      }
    >
      {variant === "floating" ? <ChevronDownIcon /> : <ChevronUpIcon />}
      <span className="sr-only">{label}</span>
    </button>
  );
}
