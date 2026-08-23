"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { FLASH_COOKIE, type Flash } from "@/lib/flash";

/** Lo que el aviso tarda en irse solo, y lo que mide la regla del borde. */
const VISIBLE_MS = 6000;

/**
 * El aviso, ya en pantalla.
 *
 * Es quien borra la cookie, no quien la lee: un Server Component no puede tocar
 * cookies durante el render. Así el aviso dura una petición de verdad y no
 * reaparece al recargar.
 */
export function FlashBanner({ flash }: { flash: Flash }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    document.cookie = `${FLASH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;

    const timer = window.setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ "--flash-visible": `${VISIBLE_MS}ms` } as CSSProperties}
      className={`flash no-print z-20 flex items-center gap-3 px-4 py-3 text-sm ${
        flash.tone === "aviso" ? "flash-aviso" : ""
      }`}
    >
      <p className="flex-1">
        {/* El número identifica el documento, así que encabeza la anotación
            igual que encabeza la factura. */}
        {flash.serial && (
          <>
            <span className="serial">{flash.serial}</span>
            <span className="text-[var(--muted)]"> · </span>
          </>
        )}
        {flash.message}
      </p>

      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Cerrar el aviso"
        className="-my-1 shrink-0 rounded px-2 py-1 text-lg leading-none text-[var(--muted)] transition hover:text-[var(--foreground)]"
      >
        ×
      </button>

      {/* Lo que le queda al aviso, dicho con un filete: sin esto se iría de
          golpe y parecería que algo ha fallado. */}
      <span className="flash-timer" aria-hidden="true" />
    </div>
  );
}
