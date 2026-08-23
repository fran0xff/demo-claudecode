"use client";

import type { ReactNode } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "@/components/icons";
import {
  setRootAttribute,
  useStoredPreference,
  writeStoredPreference,
} from "@/hooks/use-stored-preference";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: "system", label: "Sistema", icon: <MonitorIcon /> },
  { value: "light", label: "Claro", icon: <SunIcon /> },
  { value: "dark", label: "Oscuro", icon: <MoonIcon /> },
];

/** "sistema" es el valor por defecto y lo único que el servidor puede saber. */
function parseTheme(stored: string | null): Theme {
  return stored === "light" || stored === "dark" ? stored : "system";
}

function applyTheme(next: Theme) {
  // Sin atributo, vuelve a mandar `prefers-color-scheme`.
  const value = next === "system" ? null : next;
  setRootAttribute("data-theme", value);
  writeStoredPreference(THEME_STORAGE_KEY, value);
}

export function ThemeToggle() {
  const theme = useStoredPreference(THEME_STORAGE_KEY, parseTheme);

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
