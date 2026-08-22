"use client";

import { useRouter } from "next/navigation";
import { clearToken } from "@/lib/auth/token-storage";

/**
 * `router.push` en vez de `redirect()` de `next/navigation`: este botón se
 * dispara desde un `onClick` normal, no desde un `<form action>`, así que no
 * corre dentro de la transición que hace que `redirect()` funcione (ver
 * `lib/api/auth-fetch.ts`).
 */
export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    clearToken();
    // Borra la cookie httpOnly: no se puede hacer desde `document.cookie`.
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleLogout} className="transition hover:text-[var(--foreground)]">
      Salir
    </button>
  );
}
