# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

App de facturación local: facturas con líneas de detalle, desglose de IVA por
tipo y retención de IRPF, siguiendo la práctica española. Next.js 16 (App
Router) · React 19 · Prisma 7 sobre SQLite · Tailwind 4 · Zod 4 · decimal.js.

**El código, los comentarios, la interfaz y los mensajes de commit están en
español.** Mantén ese idioma al añadir código.

## Comandos

```bash
npm run dev                  # servidor de desarrollo
npm run build                # build de producción (también hace el type-check)
npm run lint                 # eslint
npm test                     # toda la suite (vitest)
npm run seed                 # datos de ejemplo, idempotente

npx vitest run tests/invoice-math.test.ts   # un solo fichero
npx vitest run -t "IRPF"                    # un solo test por nombre

npx prisma migrate dev --name <nombre>      # cambiar el esquema
npx prisma generate                         # tras clonar: el cliente está gitignored
npx prisma studio                           # inspeccionar la base de datos
```

La base de datos es `./dev.db` **en la raíz**, no dentro de `prisma/`.
`prisma.config.ts` (no `package.json`) es donde se configura Prisma 7, y trae un
fallback para que el proyecto funcione recién clonado sin `.env`.

## Arquitectura

### Facturas: rutas REST → servicio → repositorio, separado del frontend

Las mutaciones de facturas (crear, emitir, cambiar estado, editar, borrar) no
son Server Actions: viven en `app/api/invoices/**` (rutas delgadas) →
`lib/services/invoice-service.ts` (lógica de negocio) →
`lib/repositories/invoice-repository.ts` (el único fichero, junto a
`lib/repositories/settings-repository.ts`, que importa Prisma). Los
Client Components llaman a esas rutas por `fetch` a través de
`lib/api/invoice-client.ts`; las páginas (Server Components) leen llamando
**directamente** al repositorio/servicio, sin pasar por HTTP — el `fetch`
solo existe para cruzar la frontera cliente→servidor, no como capa de lectura
interna.

| Método | Ruta | Qué hace |
| --- | --- | --- |
| `GET`    | `/api/invoices` | Listado |
| `POST`   | `/api/invoices` | Crear borrador |
| `GET`    | `/api/invoices/[id]` | Detalle |
| `POST`   | `/api/invoices/[id]` | Editar (recalcula totales; no hay PUT/PATCH a propósito) |
| `DELETE` | `/api/invoices/[id]` | Borrar |
| `POST`   | `/api/invoices/[id]/issue` | Emitir (asigna correlativo) |
| `POST`   | `/api/invoices/[id]/status` | Cambiar estado |

El servicio no conoce `Request`/`Response`/cookies: devuelve datos o lanza los
errores tipados de `lib/services/errors.ts`; es la ruta quien los traduce a
código HTTP y quien llama a `setFlash` (ver más abajo). Por eso
`lib/services/invoice-service.ts` se puede testear sin HTTP
(`tests/invoice-service.test.ts`) y las rutas se testean aparte, invocando
directamente las funciones `GET`/`POST`/`DELETE` exportadas
(`tests/invoice-routes.test.ts`).

`app/settings/actions.ts` (`saveSettings`) sigue siendo una Server Action
clásica — no se movió a REST porque no tiene la complejidad de numeración ni
estado que motivó separar facturas. No asumas que todas las mutaciones del
proyecto pasan por `app/api`; solo facturas.

### El cálculo es el núcleo y vive aparte

`lib/invoice-math.ts` es un módulo **puro** — sin React, sin Prisma. Lo importan
tanto `components/invoice-form.tsx` (previsualizado en vivo mientras se teclea)
como `lib/services/invoice-service.ts` (los importes que realmente se
guardan). El cliente nunca envía totales: **el servidor siempre recalcula**
antes de persistir.

Reglas que no se deben "simplificar":

- **El IVA se aplica sobre la base agrupada por tipo, no línea a línea.** Sumar
  cuotas ya redondeadas de cada línea descuadra céntimos. Hay un test que fija
  el caso (`tests/invoice-math.test.ts`, dos líneas de 1,15 € al 10 % → 0,23 €
  agrupadas frente a 0,24 € línea a línea).
- Toda la aritmética intermedia va en `Decimal`, redondeando solo al cerrar cada
  nivel: línea → base por tipo → total.

### El número se gasta al emitir, no al crear

`Invoice.number` es **nullable**: una factura nace como `BORRADOR` sin número y
lo recibe en `invoiceService.issueInvoice`. Si se numerase al crear, borrar un
borrador dejaría un hueco en la serie, que es justo lo que la numeración no
puede tener.

La numeración es por serie y año, se asigna dentro de una transacción, está
respaldada por `@@unique([series, year, number])` (en SQLite los `NULL` no
colisionan entre sí, así que puede haber muchos borradores) y reintenta ante
colisión.

Los estados viven en `lib/invoice-status.ts`, no en un enum: SQLite no los
admite en Prisma, así que la columna es un `String` y las acciones validan
contra esa lista. **"Vencida" no es un estado guardado**, se deduce de
`dueDate` al leer para que no se quede desfasado.

### Lo que queda congelado en una factura

Una factura emitida no puede cambiar retroactivamente, así que:

- Los **totales se persisten** en `Invoice` en vez de derivarse al leer.
- Los datos del **emisor se copian** desde `Settings` al crear la factura; no
  hay relación. Cambiar los ajustes no toca las facturas ya emitidas.
- Los datos del **cliente van embebidos** en `Invoice` (todavía no hay modelo
  `Client`).
- **Serie, año y correlativo son inmutables una vez emitida**:
  `invoiceService.updateInvoice` solo toca serie y año mientras es
  `BORRADOR`, y el formulario muestra el número en solo lectura.
- De `EMITIDA`/`ENVIADA`/`PAGADA` **no se vuelve a `BORRADOR`**: el correlativo
  ya está gastado.

### El PDF es la hoja de impresión

No hay librería de PDF. `@media print` en `globals.css` reescribe los tokens a
tinta sobre blanco (pasando por encima del tema oscuro) y esconde todo lo que
lleva `.no-print`; el usuario elige "Guardar como PDF". Así **no hay una segunda
maquetación** que mantener en sintonía con la pantalla. Lo que sea interfaz y no
documento —botones, estado, "vencida"— tiene que llevar `.no-print`.

### Contrato entre formulario y ruta REST

Los inputs de línea se llaman `lines.0.description`, `lines.0.quantity`, etc.
Ese nombre es un contrato de tres puntas:

1. `components/invoice-form.tsx` lo emite como `name`. El formulario sigue
   usando `useActionState` + `<form action={fn}>` nativo: `fn` ya no tiene que
   ser una Server Action, cualquier `(prevState, formData) => Promise<FormState>`
   vale, así que el `FormData` que arma el navegador llega intacto.
2. Las funciones cliente de `lib/api/invoice-client.ts`
   (`createInvoiceAction`/`updateInvoiceAction`) mandan ese mismo `FormData`
   tal cual como cuerpo de un `fetch` (`multipart/form-data`) — no lo tocan.
3. `parseInvoiceForm`, ya en `lib/services/invoice-service.ts`, lo reagrupa en
   un array a partir de `request.formData()` en la ruta.
4. `fieldErrors` en `lib/validation.ts` devuelve los errores de Zod con esa
   misma ruta, que es como el formulario los pinta junto a cada campo.

Si cambias el patrón en un sitio, cámbialo en los cuatro o los errores dejan de
aparecer **en silencio**.

Una consecuencia de que el envío ahora sea `fetch` en vez de un `<form>`
enviado de forma nativa a una Server Action: **se perdió la degradación
progresiva sin JavaScript** en emitir/cambiar estado/borrar/crear/editar. Es
un trade-off aceptado al separar el backend del frontend, no un descuido.

### El aviso dura una petición

Crear, guardar, emitir, cambiar de estado y eliminar dejan un aviso arriba de la
pantalla (`components/flash-banner.tsx`). Va en **cookie**
(`lib/flash-cookie.ts`), no en el `FormState`/la respuesta JSON: para
facturas, la ruta de `app/api/invoices/**` llama a `setFlash` antes de
devolver la respuesta; para ajustes, sigue siendo la Server Action
`saveSettings` quien la llama. En ambos casos la cookie ya está puesta cuando
el navegador llega a la página siguiente (`redirect()` de `next/navigation`
funciona igual desde una función cliente invocada por `useActionState` que
desde una Server Action).

Tres cosas que parecen arbitrarias y no lo son:

- **`<Flash />` va en las páginas destino, no en el layout.** Al navegar, Next
  solo vuelve a renderizar los segmentos que cambian, y el layout no es uno de
  ellos: allí el aviso no aparecería.
- **Quien borra la cookie es el banner, desde el navegador.** Un Server
  Component no puede tocar cookies durante el render, así que no se puede leer y
  borrar en el mismo sitio. El `maxAge: 30` es solo la red de seguridad para
  cuando ese borrado no llega a ejecutarse.
- **`.flash` lleva su `position: sticky` en el CSS, no como utilidad.** El
  bloque de `globals.css` está fuera de toda capa y le gana a `.sticky` de
  Tailwind, que vive en `@layer utilities`.

### Fronteras que hay que respetar

- Un fichero `"use server"` **solo puede exportar funciones async** (sigue
  aplicando a `app/settings/actions.ts`). Por eso `FormState` y
  `EMPTY_FORM_STATE` viven en `lib/form-state.ts` y no junto a las acciones.
- Un Server Component **no puede pasar una función cliente corriente como
  prop** a un Client Component — solo funciones `"use server"` cruzan esa
  frontera. Por eso `app/invoices/new/page.tsx` y
  `app/invoices/[id]/edit/page.tsx` no le pasan `createInvoiceAction`/
  `updateInvoiceAction` directamente a `InvoiceForm`: lo hacen a través de
  `components/new-invoice-form.tsx`/`edit-invoice-form.tsx`, pequeños Client
  Components cuya única razón de existir es esa.
- `lib/repositories/invoice-repository.ts` y
  `lib/repositories/settings-repository.ts` son los únicos ficheros que
  importan Prisma, y convierten los `Decimal` a `number` planos ahí: los
  `Decimal` no cruzan la frontera hacia los Client Components.
- **Las páginas que leen la base de datos necesitan
  `export const dynamic = "force-dynamic"`.** Sin eso Next las prerenderiza
  estáticas en el build y se quedan congeladas.

## Trampas del entorno

- **Prisma 7 exige driver adapter** para SQLite. El export se llama
  `PrismaBetterSqlite3` (q minúscula), no `PrismaBetterSQLite3`.
- El cliente generado va a `lib/generated/prisma` y **está gitignored**: tras
  clonar hay que ejecutar `npx prisma generate`.
- `better-sqlite3` es un módulo nativo y está en `serverExternalPackages`
  (`next.config.ts`). Sin eso el bundler falla al resolverlo.
- **Tailwind v4 no permite que una clase propia haga `@apply` de otra clase
  propia.** Por eso `.btn-primary` repite la base de `.btn` en vez de componerla.
- El tema se marca con `data-theme` en `<html>` desde un script del `<head>`
  (`lib/theme.ts`). Los colores se definen en `:root` **a secas** y los bloques
  de tema solo redefinen tokens; un color cuya única definición viviera dentro
  del media query desaparecería al forzar el tema claro.

## Formato es-ES

`2400,00 €` **sin punto de miles es correcto**: el CLDR español no agrupa hasta
los 5 dígitos (`1.234.567,50 €` sí los lleva). No lo "arregles".

## Tests

`vitest.config.mts` alias `server-only` a un stub vacío (el paquete real lanza
fuera del entorno de servidor de Next) y fuerza `fileParallelism: false`:
`invoice-service.test.ts` e `invoice-routes.test.ts` montan cada uno su propia
SQLite temporal aplicando todas las migraciones en `beforeAll`, y en paralelo
compiten por CPU hasta superar el timeout por defecto — en serie es estable.
No lo quites para "acelerar" la suite sin comprobar que sigue siendo estable.

`tests/invoice-service.test.ts` prueba `lib/services/invoice-service.ts`
directamente (sin HTTP): alta como borrador, validación de campos, bloqueo si
Settings no está configurado, emisión con reintento ante colisión de número,
correlativos consecutivos, reinicio de numeración por año, series
independientes, no-op al reemitir, transiciones de estado válidas/rechazadas,
edición con/sin cambio de numeración según `BORRADOR`, y borrado en cascada.
Si tocas `invoice-service.ts`, estos son los que importan.

`tests/invoice-routes.test.ts` prueba las rutas de `app/api/invoices/**`
invocando directamente las funciones `GET`/`POST`/`DELETE` exportadas (mismo
patrón que antes con la Server Action: se construye la petición a mano, no
hace falta un servidor corriendo), y comprueba status codes y el payload
exacto de cada aviso (tono, mensaje, número de serie) vía el mismo mock de
`next/headers`.

Ambos aplican **todas** las migraciones en orden, no solo la inicial: si
añades una, no hay que tocar los tests.

## Skills

### Available skills

| Skill | Para qué sirve |
| --- | --- |
| `frontend-design` | Diseño visual de la interfaz: dirección estética, paleta, tipografía y maquetación con criterio propio, sin quedarse en los valores por defecto de una plantilla |
| `react-rules` | Mejores prácticas de React 19 con TypeScript: estructura del proyecto, Zustand, Zod, React Hook Form, reglas de hooks y `useEffect`, React Query / SWR |
| `greeting` | Saludo inicial al usuario, formal y profesional |
| `explain-code` | Explicación resumida de código: propósito, patrones, estructura y componentes |

### Skill trigger rules

- **`frontend-design`** — cuando se pida mejorar o cambiar el diseño de la app,
  la interfaz, la UI o la UX, el aspecto visual, la paleta, la tipografía o la
  maquetación; también cuando se pida "mejorar el diseño de React" o rehacer una
  pantalla existente.
- **`react-rules`** — cuando se pida crear una aplicación o componente React, o
  agregar/modificar componentes, hooks, estado, formularios o lógica de UI en
  React.
- **`greeting`** — al iniciar sesión y cuando el usuario salude.
- **`explain-code`** — cuando se pida explicar código.

`frontend-design` y `react-rules` se solapan y **pueden aplicarse a la vez**: la
primera decide cómo tiene que verse, la segunda cómo hay que escribirlo.

No tomar en cuenta el comando `saludar` como skill: para saludar, solo
`greeting`.