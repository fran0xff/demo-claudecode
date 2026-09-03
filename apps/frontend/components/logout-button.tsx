"use client";

import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api-url";

/**
 * `router.push` en vez de `redirect()` de `next/navigation`: este botón se
 * dispara desde un `onClick` normal, no desde un `<form action>`, así que no
 * corre dentro de la transición que hace que `redirect()` funcione (ver
 * `lib/api/unauthorized.ts`).
 */
export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    // Borra la cookie httpOnly de sesión: no se puede hacer desde
    // `document.cookie` (por eso `handleLogout` no la borra directamente).
    await fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleLogout} className="transition hover:text-[var(--foreground)]">
      Salir
    </button>
  );
}
