"use client";

import { useSyncExternalStore } from "react";
import { NAV_STORAGE_KEY } from "@/lib/nav";

/*
 * Mostrar u ocultar el menú superior. Mismo planteamiento que el selector de
 * tema: la preferencia vive en localStorage (estado externo a React) y se lee
 * con useSyncExternalStore.
 *
 * Quién se ve y quién no lo decide el CSS a partir de `data-nav` en <html>, no
 * este estado: así el botón correcto ya está pintado en el primer frame, con el
 * atributo que puso el script del <head>. Aquí el estado solo sirve para que
 * `aria-expanded` y el texto accesible digan la verdad.
 */

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(NAV_STORAGE_KEY) === "hidden";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

function toggleNav() {
  const ocultar = !getSnapshot();

  if (ocultar) {
    document.documentElement.setAttribute("data-nav", "hidden");
  } else {
    document.documentElement.removeAttribute("data-nav");
  }

  try {
    if (ocultar) localStorage.setItem(NAV_STORAGE_KEY, "hidden");
    else localStorage.removeItem(NAV_STORAGE_KEY);
  } catch {
    // Se aplica igual, solo que no se recordará.
  }

  for (const listener of listeners) listener();
}

type Props = {
  /** "inline" va dentro del menú; "floating" es el que lo devuelve cuando está oculto. */
  variant: "inline" | "floating";
};

export function NavToggle({ variant }: Props) {
  const hidden = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const label = hidden ? "Mostrar el menú" : "Ocultar el menú";

  const base =
    "flex items-center justify-center rounded-full transition text-[var(--muted)] hover:text-[var(--foreground)]";

  return (
    <button
      type="button"
      onClick={toggleNav}
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

const iconProps = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function ChevronUpIcon() {
  return (
    <svg {...iconProps}>
      <path d="m6 15 6-6 6 6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg {...iconProps}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
