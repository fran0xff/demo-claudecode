export const NAV_STORAGE_KEY = "facturas:nav";

/**
 * Igual que el del tema: se ejecuta en el <head>, antes del primer pintado,
 * para que el menú no aparezca un instante y desaparezca después.
 *
 * Solo hay atributo cuando el menú está oculto; visible es el estado por
 * defecto y no ensucia el <html>.
 */
export const NAV_INIT_SCRIPT = `(function(){try{if(localStorage.getItem(${JSON.stringify(
  NAV_STORAGE_KEY,
)})==="hidden"){document.documentElement.setAttribute("data-nav","hidden")}}catch(e){}})()`;
