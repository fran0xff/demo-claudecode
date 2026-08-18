import { FlashBanner } from "@/components/flash-banner";
import { readFlash } from "@/lib/flash-cookie";

/**
 * Recoge el aviso que dejó la última acción.
 *
 * Va en las páginas que son destino de esas acciones y no en el layout: al
 * redirigir, Next solo vuelve a renderizar los segmentos que cambian, y el
 * layout no es uno de ellos.
 */
export async function Flash() {
  const flash = await readFlash();
  if (!flash) return null;

  // La `key` remonta el banner cuando llega otro aviso, aunque diga lo mismo.
  return <FlashBanner key={flash.id} flash={flash} />;
}
