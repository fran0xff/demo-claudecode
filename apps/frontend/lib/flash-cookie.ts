import "server-only";
import { cookies } from "next/headers";
import { FLASH_COOKIE, parseFlash, type Flash } from "@facturas/shared/flash";

/**
 * Solo lectura: quien deja el aviso es el backend (`setFlash`, en
 * `apps/backend/lib/flash-cookie.ts`), justo antes de responder a una
 * mutación. La cookie la ve este frontend porque comparte dominio raíz con
 * el backend en producción (ver `lib/security/auth-cookie.ts` del backend).
 */
export async function readFlash(): Promise<Flash | null> {
  const store = await cookies();
  return parseFlash(store.get(FLASH_COOKIE)?.value);
}
