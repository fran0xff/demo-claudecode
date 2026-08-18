/*
 * Aviso de un solo uso: lo escribe la Server Action que acaba de cambiar algo y
 * lo pinta la pantalla a la que se llega. Vive exactamente una petición.
 *
 * Este módulo es puro a propósito. Lo importan las dos orillas: el servidor
 * para escribir y leer la cookie, y el banner en el navegador para borrarla en
 * cuanto la enseña. Si `next/headers` entrara aquí, el cliente no compilaría.
 */

export const FLASH_COOKIE = "factura-aviso";

/** `exito` para lo que queda registrado; `aviso` para lo que se da de baja. */
export type FlashTone = "exito" | "aviso";

export type Flash = {
  /** Cambia en cada aviso: es la `key` que remonta el banner cuando llega otro
      con el mismo texto, y sin la cual el segundo no reiniciaría su cuenta. */
  id: string;
  tone: FlashTone;
  message: string;
  /** Número de la factura afectada, cuando ya lo tiene. */
  serial?: string;
};

/**
 * La cookie viaja por el navegador y cualquiera puede tocarla, así que de lo
 * que venga solo se acepta lo que tenga la forma esperada; el resto se descarta
 * en silencio y no se enseña nada.
 */
export function parseFlash(value: string | undefined): Flash | null {
  if (!value) return null;

  try {
    const raw = JSON.parse(value) as Partial<Flash>;
    if (typeof raw.message !== "string" || raw.message === "") return null;
    if (raw.tone !== "exito" && raw.tone !== "aviso") return null;

    return {
      id: typeof raw.id === "string" ? raw.id : raw.message,
      tone: raw.tone,
      message: raw.message.slice(0, 200),
      serial: typeof raw.serial === "string" ? raw.serial.slice(0, 32) : undefined,
    };
  } catch {
    return null;
  }
}
