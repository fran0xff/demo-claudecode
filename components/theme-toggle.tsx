"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: "system", label: "Sistema", icon: <MonitorIcon /> },
  { value: "light", label: "Claro", icon: <SunIcon /> },
  { value: "dark", label: "Oscuro", icon: <MoonIcon /> },
];

/*
 * El tema elegido vive en localStorage, que es estado externo a React. Se lee
 * con useSyncExternalStore en vez de con estado local + efecto: así el render
 * del servidor usa "sistema" (lo único que puede saber) y el cliente corrige al
 * hidratar, sin parpadeo de colores porque de eso ya se encargó el script del
 * <head>. De regalo, el evento `storage` mantiene el selector sincronizado
 * entre pestañas.
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

function getSnapshot(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    // Modo incógnito o almacenamiento bloqueado.
    return "system";
  }
}

function getServerSnapshot(): Theme {
  return "system";
}

function applyTheme(next: Theme) {
  if (next === "system") {
    // Sin atributo, vuelve a mandar `prefers-color-scheme`.
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", next);
  }

  try {
    if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // El tema se aplica igual, solo que no se recordará.
  }

  for (const listener of listeners) listener();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      role="group"
      aria-label="Tema"
      className="flex items-center gap-0.5 rounded-full border border-[var(--border)] p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => applyTheme(option.value)}
            aria-pressed={active}
            title={option.label}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
              active
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {option.icon}
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
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

function SunIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...iconProps}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg {...iconProps}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
