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

### El cálculo es el núcleo y vive aparte

`lib/invoice-math.ts` es un módulo **puro** — sin React, sin Prisma. Lo importan
tanto `components/invoice-form.tsx` (previsualizado en vivo mientras se teclea)
como `app/invoices/actions.ts` (los importes que realmente se guardan). El
cliente nunca envía totales: **el servidor siempre recalcula** antes de
persistir.

Reglas que no se deben "simplificar":

- **El IVA se aplica sobre la base agrupada por tipo, no línea a línea.** Sumar
  cuotas ya redondeadas de cada línea descuadra céntimos. Hay un test que fija
  el caso (`tests/invoice-math.test.ts`, dos líneas de 1,15 € al 10 % → 0,23 €
  agrupadas frente a 0,24 € línea a línea).
- Toda la aritmética intermedia va en `Decimal`, redondeando solo al cerrar cada
  nivel: línea → base por tipo → total.

### Lo que queda congelado en una factura

Una factura emitida no puede cambiar retroactivamente, así que:

- Los **totales se persisten** en `Invoice` en vez de derivarse al leer.
- Los datos del **emisor se copian** desde `Settings` al crear la factura; no
  hay relación. Cambiar los ajustes no toca las facturas ya emitidas.
- Los datos del **cliente van embebidos** en `Invoice` (todavía no hay modelo
  `Client`).
- **Serie, año y correlativo son inmutables** tras la creación: `updateInvoice`
  no los toca y el formulario los muestra en solo lectura al editar.

La numeración es por serie y año, se asigna dentro de una transacción, está
respaldada por `@@unique([series, year, number])` y reintenta ante colisión.

### Contrato entre formulario y Server Action

Los inputs de línea se llaman `lines.0.description`, `lines.0.quantity`, etc.
Ese nombre es un contrato de tres puntas:

1. `components/invoice-form.tsx` lo emite como `name`.
2. `parseInvoiceForm` en `app/invoices/actions.ts` lo reagrupa en un array.
3. `fieldErrors` en `lib/validation.ts` devuelve los errores de Zod con esa
   misma ruta, que es como el formulario los pinta junto a cada campo.

Si cambias el patrón en un sitio, cámbialo en los tres o los errores dejan de
aparecer **en silencio**.

### Fronteras que hay que respetar

- Un fichero `"use server"` **solo puede exportar funciones async**. Por eso
  `FormState` y `EMPTY_FORM_STATE` viven en `lib/form-state.ts` y no junto a las
  acciones.
- `lib/invoices.ts` es la capa de lectura (`server-only`) y convierte los
  `Decimal` de Prisma a `number` planos: los `Decimal` no cruzan la frontera
  hacia los Client Components.
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
fuera del entorno de servidor de Next).

`tests/invoice-actions.test.ts` son tests de integración de las Server Actions
reales: levanta una SQLite temporal aplicando el SQL de la migración, y mockea
`next/cache` y `next/navigation` (`redirect` lanza un error del que se extrae el
destino). Cubren alta, correlativos, reinicio por año, series independientes,
edición y borrado en cascada. Si tocas `actions.ts`, estos son los que importan.
