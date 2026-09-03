import "server-only";
import { cookies } from "next/headers";
import { FLASH_COOKIE, type Flash, type FlashTone } from "@facturas/shared/flash";

/**
 * Deja el aviso preparado para la siguiente pantalla. Solo escribe: quien la
 * lee es `apps/frontend` (`lib/flash-cookie.ts` de ese app), que es donde se
 * renderiza el banner — este backend no tiene páginas.
 *
 * Va en cookie y no en el estado del formulario porque estas acciones terminan
 * en `redirect` o en `revalidatePath`: lo que devuelven no llega a pintarse.
 *
 * `httpOnly: false` es deliberado —quien borra el aviso es el banner, desde el
 * navegador— y aquí no viaja nada secreto: un texto que se acaba de enseñar.
 * El `maxAge` corto es solo la red de seguridad para cuando ese borrado no
 * llega a ejecutarse: el aviso caduca solo en vez de quedarse pegado.
 * `domain: COOKIE_DOMAIN` es necesaria por el mismo motivo que en
 * `lib/security/auth-cookie.ts`: sin ella, el frontend (otro subdominio)
 * nunca la vería.
 */
export async function setFlash(
  tone: FlashTone,
  message: string,
  serial?: string,
): Promise<void> {
  const store = await cookies();
  const flash: Flash = { id: crypto.randomUUID(), tone, message, serial };

  store.set(FLASH_COOKIE, JSON.stringify(flash), {
    path: "/",
    domain: process.env.COOKIE_DOMAIN || undefined,
    sameSite: "lax",
    httpOnly: false,
    maxAge: 30,
  });
}
