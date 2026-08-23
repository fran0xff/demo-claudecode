export type Theme = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "facturas:theme";

/**
 * Se ejecuta en el <head>, antes de pintar nada, para que la página no aparezca
 * un instante con el tema del sistema y salte al elegido. Va como string porque
 * tiene que ser síncrono y anterior a que React tome el control.
 *
 * Si no hay preferencia guardada no toca el atributo: manda el CSS y su
 * `prefers-color-scheme`.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})()`;
