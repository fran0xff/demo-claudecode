"use client";

import { useSyncExternalStore } from "react";

/**
 * Preferencias de interfaz guardadas en localStorage (tema, menú plegado).
 *
 * localStorage es estado externo a React, así que se lee con
 * `useSyncExternalStore` en vez de con estado local más un efecto: el render del
 * servidor usa el valor por defecto y el cliente corrige al hidratar, sin
 * parpadeo porque de eso ya se encargó el script del <head>.
 *
 * El `Set` de listeners es lo que hace que todos los componentes suscritos se
 * enteren de un cambio en la misma pestaña; el evento `storage` cubre el resto.
 */

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Devuelve null si el almacenamiento está bloqueado (modo incógnito). */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Guarda una preferencia — o la borra, con `null` — y avisa a los suscritos.
 * Si el almacenamiento falla el cambio se aplica igual: solo no se recordará.
 */
export function writeStoredPreference(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Sin persistencia, pero la interfaz sigue respondiendo.
  }

  for (const listener of listeners) listener();
}

/** Escribe —o quita, con `null`— un atributo en <html>, que es lo que lee el CSS. */
export function setRootAttribute(attribute: string, value: string | null): void {
  if (value === null) document.documentElement.removeAttribute(attribute);
  else document.documentElement.setAttribute(attribute, value);
}

/**
 * `parse` traduce lo guardado al tipo que use el componente y decide el valor
 * por defecto: recibe `null` tanto cuando no hay nada guardado como en el render
 * del servidor. Tiene que devolver un primitivo, o `useSyncExternalStore`
 * entraría en bucle al comparar dos snapshots que nunca son iguales.
 */
export function useStoredPreference<T extends string | boolean>(
  key: string,
  parse: (stored: string | null) => T,
): T {
  return useSyncExternalStore(
    subscribe,
    () => parse(read(key)),
    () => parse(null),
  );
}
