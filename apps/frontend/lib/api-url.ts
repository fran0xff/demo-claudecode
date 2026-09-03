/**
 * URL absoluta del backend. Antes las rutas eran relativas (`/api/invoices`)
 * porque backend y frontend eran el mismo proceso; separados en dos apps,
 * cada `fetch` del navegador tiene que decir a qué origen va.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
