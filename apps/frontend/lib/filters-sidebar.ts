export const FILTERS_SIDEBAR_STORAGE_KEY = "facturas:filtros";

/**
 * Mismo mecanismo que `lib/nav.ts`: se ejecuta en el <head>, antes del primer
 * pintado, para que el panel de filtros no aparezca y se colapse un instante
 * después. Visible es el estado por defecto y no ensucia el <html>.
 */
export const FILTERS_SIDEBAR_INIT_SCRIPT = `(function(){try{if(localStorage.getItem(${JSON.stringify(
  FILTERS_SIDEBAR_STORAGE_KEY,
)})==="hidden"){document.documentElement.setAttribute("data-filtros","hidden")}}catch(e){}})()`;
