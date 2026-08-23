import "server-only";
import { cookies } from "next/headers";
import { FLASH_COOKIE, parseFlash, type Flash, type FlashTone } from "@/lib/flash";

/**
 * Deja el aviso preparado para la siguiente pantalla.
 *
 * Va en cookie y no en el estado del formulario porque estas acciones terminan
 * en `redirect` o en `revalidatePath`: lo que devuelven no llega a pintarse.
 *
 * `httpOnly: false` es deliberado —quien borra el aviso es el banner, desde el
 * navegador— y aquí no viaja nada secreto: un texto que se acaba de enseñar.
 * El `maxAge` corto es solo la red de seguridad para cuando ese borrado no
 * llega a ejecutarse: el aviso caduca solo en vez de quedarse pegado.
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
    sameSite: "lax",
    httpOnly: false,
    maxAge: 30,
  });
}

export async function readFlash(): Promise<Flash | null> {
  const store = await cookies();
  return parseFlash(store.get(FLASH_COOKIE)?.value);
}
