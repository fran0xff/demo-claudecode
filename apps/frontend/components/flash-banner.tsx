"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { FLASH_COOKIE, type Flash } from "@facturas/shared/flash";

/** Lo que el aviso tarda en irse solo, y lo que mide la regla del borde. */
const VISIBLE_MS = 6000;
/** Tiene que coincidir con la duración de `.flash-saliendo` en `globals.css`. */
const LEAVE_MS = 160;

/**
 * El aviso, ya en pantalla.
 *
 * Es quien borra la cookie, no quien la lee: un Server Component no puede tocar
 * cookies durante el render. Así el aviso dura una petición de verdad y no
 * reaparece al recargar.
 */
export function FlashBanner({ flash }: { flash: Flash }) {
  const [closing, setClosing] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // El backend la puso con `Domain=.tudominio.com` en producción (los dos
    // apps son subdominios distintos, ver `auth-cookie.ts` del backend): sin
    // repetir ese `Domain` aquí, este borrado crearía una cookie nueva de
    // solo-host en vez de borrar la de verdad, y el aviso reaparecería en la
    // siguiente carga hasta que caduque sola a los 30s.
    const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
    document.cookie = `${FLASH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${domain ? `; Domain=${domain}` : ""}`;

    const timer = window.setTimeout(() => setClosing(true), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // Separado del temporizador de arriba: al cerrar a mano con la `x` también
  // hay que dar tiempo a que `.flash-saliendo` termine antes de desmontar,
  // o la tarjeta desaparecería de golpe en vez de irse con la animación.
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => setHidden(true), LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [closing]);

  if (hidden) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ "--flash-visible": `${VISIBLE_MS}ms` } as CSSProperties}
      className={`flash no-print z-50 flex items-center gap-3 px-4 py-3 text-sm ${
        flash.tone === "aviso" ? "flash-aviso" : ""
      } ${closing ? "flash-saliendo" : ""}`}
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
        onClick={() => setClosing(true)}
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
