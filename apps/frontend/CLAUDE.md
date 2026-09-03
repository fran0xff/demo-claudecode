@AGENTS.md

Frontend de la app de facturación: Next.js 16 (App Router, solo páginas) ·
React 19 · Tailwind 4. Nunca toca Prisma ni SQLite — todos los datos vienen
de `apps/backend` por HTTP. Ver `../../CLAUDE.md` (raíz) para el mapa del
monorepo y el contrato de autenticación entre esta app y el backend, y
`../backend/CLAUDE.md` para la tabla completa de rutas REST que consume esta
app.

**El código, los comentarios y la interfaz están en español.**

## Comandos

```bash
npm run dev                  # servidor de desarrollo, puerto 3000
npm run build                # build de producción (también hace el type-check)
npm run lint                 # eslint
```

Necesita `apps/backend` corriendo (`NEXT_PUBLIC_API_URL` en `.env`) para que
las páginas tengan datos que mostrar.

## Cómo leen datos las páginas: `lib/backend.ts`

Antes las páginas (Server Component) leían el repositorio directamente, en
el mismo proceso. Separados en dos apps, `lib/backend.ts` hace ese mismo
papel por HTTP: lee la cookie de la petición entrante (`cookies()`) y la
reenvía como header `Cookie` a un `fetch` de servidor a servidor contra
`apps/backend`. Funciona porque las dos apps comparten dominio raíz en
producción — la cookie de sesión ya trae `Domain=.tudominio.com` (ver
`../../CLAUDE.md`). `proxy.ts` de esta app ya comprobó que la cookie es
válida antes de que la página llegue a pedir nada.

Los `lib/api/*.ts` (los que llaman los Client Components: crear/editar/borrar
factura, cambiar estado, usuarios, ajustes) son distintos: corren en el
navegador, así que usan `fetch` con URL absoluta (`API_URL` de
`lib/api-url.ts`) y `credentials: "include"` en vez de reenviar cookies a
mano.

## El listado de facturas pagina por `?page=`, sin JavaScript

`components/pagination.tsx` es Server Component a propósito: son enlaces
`<Link href="/invoices?page=N">` normales, así que cambiar de página es una
navegación como cualquier otra, sin estado de cliente. `lib/pagination.ts`
(`paginationItems`) es la única pieza con lógica: qué números pintar
alrededor de la página actual (± 3, más la primera y la última sueltas con
un "…" si queda hueco) — ver `../backend/CLAUDE.md` ("El listado pagina en
la base de datos") para cómo se ordena y se recorta `page` del lado del
backend.

## El PDF es la hoja de impresión

No hay librería de PDF. `@media print` en `globals.css` reescribe los tokens a
tinta sobre blanco (pasando por encima del tema oscuro) y esconde todo lo que
lleva `.no-print`; el usuario elige "Guardar como PDF". Así **no hay una segunda
maquetación** que mantener en sintonía con la pantalla. Lo que sea interfaz y no
documento —botones, estado, "vencida"— tiene que llevar `.no-print`.

## Contrato de `FormData` con el backend

Ver `../backend/CLAUDE.md` ("Contrato de FormData con el formulario") para
las cuatro puntas completas. Del lado de esta app: `invoice-form.tsx` emite
los inputs de línea como `lines.0.description`, `lines.0.quantity`, etc., y
`lib/api/invoice-client.ts` manda ese mismo `FormData` tal cual como cuerpo
de un `fetch` (`multipart/form-data`) — no lo toca. Si cambias el nombre en
un sitio, cámbialo en los cuatro (los dos de aquí y los dos del backend) o
los errores dejan de aparecer **en silencio**.

Una consecuencia de que el envío sea `fetch` en vez de un `<form>` enviado de
forma nativa a una Server Action: **no hay degradación progresiva sin
JavaScript** en emitir/cambiar estado/borrar/crear/editar. Es un trade-off
aceptado al separar backend y frontend, no un descuido.

## El aviso: quien lo lee

`components/flash-banner.tsx` (`components/flash.tsx`) pinta el aviso que
dejó la última mutación. Quien lo **escribe** es `apps/backend`
(`setFlash`) — ver `../backend/CLAUDE.md`. La forma de la cookie
(`FLASH_COOKIE`, `Flash`, `parseFlash`) viene de `@facturas/shared/flash`
porque las dos apps tienen que coincidir en ella exactamente.

Tres cosas que parecen arbitrarias y no lo son:

- **`<Flash />` va en las páginas destino, no en el layout.** Al navegar, Next
  solo vuelve a renderizar los segmentos que cambian, y el layout no es uno de
  ellos: allí el aviso no aparecería.
- **Quien borra la cookie es el banner, desde el navegador**, con el mismo
  `Domain` con el que el backend la puso (`NEXT_PUBLIC_COOKIE_DOMAIN`): un
  Server Component no puede tocar cookies durante el render, así que no se
  puede leer y borrar en el mismo sitio, y sin repetir el `Domain` el
  borrado crearía una cookie de solo-host en vez de borrar la de verdad. El
  `maxAge: 30` del lado del backend es solo la red de seguridad para cuando
  ese borrado no llega a ejecutarse.
- **`.flash` lleva su `position: sticky` en el CSS, no como utilidad.** El
  bloque de `globals.css` está fuera de toda capa y le gana a `.sticky` de
  Tailwind, que vive en `@layer utilities`.

## Fronteras que hay que respetar

- Un Server Component **no puede pasar una función cliente corriente como
  prop** a un Client Component — ni siquiera si esa función no es una
  Server Action (ninguna de `lib/api/*.ts` lo es: son `fetch` normal). Por
  eso `app/invoices/new/page.tsx` y `app/invoices/[id]/edit/page.tsx` no le
  pasan `createInvoiceAction`/`updateInvoiceAction` directamente a
  `InvoiceForm`: lo hacen a través de `components/new-invoice-form.tsx`/
  `edit-invoice-form.tsx`, pequeños Client Components cuya única razón de
  existir es importar la función del lado del cliente y pasarla hacia abajo
  dentro del árbol de React, sin cruzar la frontera servidor→cliente.
- **Las páginas que piden datos al backend necesitan
  `export const dynamic = "force-dynamic"`.** Sin eso Next las prerenderiza
  estáticas en el build y se quedan congeladas.

## Trampas del entorno

- **Tailwind v4 no permite que una clase propia haga `@apply` de otra clase
  propia.** Por eso `.btn-primary` repite la base de `.btn` en vez de componerla.
- El tema se marca con `data-theme` en `<html>` desde un script del `<head>`
  (`lib/theme.ts`). Los colores se definen en `:root` **a secas** y los bloques
  de tema solo redefinen tokens; un color cuya única definición viviera dentro
  del media query desaparecería al forzar el tema claro.
- **`AUTH_JWT_SECRET` es obligatoria** y tiene que ser idéntica a la de
  `apps/backend`: esta app verifica el JWT de la cookie sin llamar al
  backend (ver `../../CLAUDE.md`).
- `NEXT_PUBLIC_API_URL` (URL del backend) y `NEXT_PUBLIC_COOKIE_DOMAIN`
  llevan el prefijo `NEXT_PUBLIC_` porque hace falta leerlos también desde
  código que corre en el navegador (`lib/api-url.ts`,
  `components/flash-banner.tsx`).

## Formato es-ES

`2400,00 €` **sin punto de miles es correcto**: el CLDR español no agrupa hasta
los 5 dígitos (`1.234.567,50 €` sí los lleva). No lo "arregles".
