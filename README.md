# App de facturación

Aplicación web **local** para emitir facturas siguiendo la práctica habitual en
España: líneas de detalle, desglose de IVA por tipo, retención de IRPF,
validación de NIF/CIF y numeración por serie y año. Sin servicios externos ni
integración con la AEAT.

Casos de uso: listar facturas, crear una nueva, verla en detalle, editarla,
borrarla y configurar los datos del emisor.

## Puesta en marcha

Monorepo con dos apps Next.js independientes (`apps/backend`, solo API;
`apps/frontend`, solo páginas) y un paquete compartido (`packages/shared`).
Ver `CLAUDE.md` para el mapa completo y el contrato de autenticación entre
las dos apps.

```bash
npm install                          # una sola vez, en la raíz

cd apps/backend
cp .env.example .env                 # AUTH_JWT_SECRET, FRONTEND_ORIGIN...
npx prisma generate                  # el cliente generado está gitignored
npx prisma migrate dev               # crea dev.db y aplica el esquema
npm run seed                         # ajustes del emisor + facturas de ejemplo
npm run create-user -- tu@correo.com "contraseña larga"   # el primer usuario

cd ../frontend
cp .env.example .env                 # misma AUTH_JWT_SECRET que el backend

# desde la raíz, cada una en su terminal:
npm run dev:backend                  # http://localhost:3001
npm run dev:frontend                 # http://localhost:3000
```

La base de datos es `apps/backend/dev.db`, no dentro de `prisma/`.

## Scripts

Desde la raíz, sobre los tres workspaces a la vez:

| Comando | Qué hace |
| --- | --- |
| `npm run dev:backend` / `dev:frontend` | Servidor de desarrollo de cada app |
| `npm run build` | Build de producción de las dos apps |
| `npm run lint` | ESLint en todos los workspaces |
| `npm test` | Vitest en todos los workspaces (backend + shared) |

Dentro de `apps/backend` hay además `npm run seed` y `npm run create-user`
(ver `apps/backend/CLAUDE.md`).

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) + React 19 |
| Lenguaje | TypeScript |
| Datos | Prisma 7 sobre SQLite con driver adapter `better-sqlite3` |
| Estilos | Tailwind CSS 4 |
| Validación | Zod 4 |
| Aritmética | decimal.js |
| Tests | Vitest |

---

## Cómo está montado

### El cálculo es el núcleo y vive aparte

`lib/invoice-math.ts` es un módulo **puro**: sin React, sin Prisma. Eso permite
que el mismo código corra en dos sitios.

```
components/invoice-form.tsx  ──┐
   (previsualizado en vivo)    ├──▶  lib/invoice-math.ts
app/invoices/actions.ts      ──┘        (módulo puro)
   (importes que se guardan)
```

`computeInvoiceTotals(lines, irpfRate)`:

1. Por línea: `base = redondea2(cantidad × precio × (1 − dto/100))`
2. **Agrupa las bases por tipo de IVA**
3. Por grupo: `cuota = redondea2(baseAgrupada × tipo / 100)`
4. `subtotal = Σ bases`, `taxTotal = Σ cuotas`,
   `irpfTotal = redondea2(subtotal × irpf/100)`
5. `total = subtotal + taxTotal − irpfTotal`

El punto crítico es el paso 2. Calcular el IVA línea a línea y sumar cuotas ya
redondeadas descuadra céntimos y no es como se desglosa una factura española.
Hay un test que fija el caso: dos líneas de 1,15 € al 10 % dan **0,23 €**
agrupadas frente a 0,24 € línea a línea.

Toda la aritmética intermedia va en `Decimal` con `ROUND_HALF_UP` (el redondeo
al alza en el 0,5 de la facturación española) y solo se redondea al cerrar cada
nivel: línea → base por tipo → total.

### El número se gasta al emitir, no al crear

Una factura nace como **borrador**, sin número. Lo recibe al emitirla, y desde
ahí pasa por **emitida → enviada → pagada**. Si se numerase al crear, borrar un
borrador dejaría un hueco en la serie.

`Invoice.number` es nullable y en SQLite los `NULL` no colisionan en un índice
único, así que puede haber tantos borradores como haga falta sin tocar la
restricción `@@unique([series, year, number])`.

**"Vencida" no es un estado guardado**: se deduce de la fecha de vencimiento al
leer, así que nunca se queda desfasada.

### El PDF sale del navegador

No hay librería de PDF ni una segunda maquetación. La factura se imprime desde
el mismo HTML que se ve en pantalla, con una hoja `@media print` que reescribe
los colores a tinta sobre blanco y esconde todo lo que es interfaz. El usuario
elige "Guardar como PDF" en el diálogo del navegador.

### El aviso dura una petición

Cada alta, cambio o baja deja un aviso arriba de la pantalla que se retira solo
a los seis segundos, o antes si se cierra. Viaja en una cookie que la Server
Action escribe y que el propio banner borra nada más enseñarlo, así que no
sobrevive a una recarga ni reaparece al volver atrás.

Se pinta en las páginas que son destino de esas acciones y no en el layout: al
redirigir, Next solo vuelve a renderizar los segmentos que cambian.

### Lo que queda congelado en una factura

Tres modelos: `Invoice` (cabecera y totales), `InvoiceLine` (`onDelete: Cascade`)
y `Settings` (fila única `id = 1` con los datos del emisor y los valores por
defecto). Los importes van en `Decimal`, nunca en `Float`.

Una factura emitida no puede cambiar retroactivamente, así que:

- Los **totales se persisten**, no se derivan al leer. Si mañana cambia la
  lógica de cálculo, una factura ya emitida no cambia de importe.
- Los datos del **emisor se copian** desde `Settings` al crear la factura; no
  hay relación. Editar los ajustes no toca lo ya emitido.
- Los datos del **cliente van embebidos** (todavía no hay modelo `Client`).
- **Serie, año y correlativo son inmutables** tras la creación: `updateInvoice`
  no los toca y el formulario los muestra en solo lectura al editar.

### Numeración correlativa

Tres defensas contra números duplicados:

1. Se busca `MAX(number)` y se crea la factura dentro de una `$transaction`.
2. Restricción de base de datos `@@unique([series, year, number])`.
3. Reintento optimista: si Prisma devuelve `P2002`, se reintenta hasta 3 veces
   con el siguiente número.

### Flujo de una factura

```
invoice-form.tsx  ──FormData──▶  createInvoice()   [Server Action]
 (Client Component)                    │
                                       ├─ parseInvoiceForm()  lines.N.campo → array
                                       ├─ invoiceSchema.safeParse()   Zod
                                       ├─ computeInvoiceTotals()   ← recalcula SIEMPRE
                                       ├─ $transaction  → asigna nº + inserta
                                       └─ revalidatePath + redirect
```

**El cliente nunca envía totales.** Lo que llegue del navegador se ignora: el
servidor recalcula y su resultado es el que se guarda.

### El contrato de tres puntas

Los inputs de línea se llaman `lines.0.description`, `lines.0.quantity`… Ese
nombre lo comparten tres sitios:

1. `components/invoice-form.tsx` lo emite como `name`.
2. `parseInvoiceForm` en `app/invoices/actions.ts` lo reagrupa en un array.
3. `fieldErrors` en `lib/validation.ts` devuelve los errores de Zod con esa
   misma ruta.

Así el formulario pinta cada error junto a su campo. Si cambias el patrón en un
sitio y no en los otros, los errores dejan de aparecer **en silencio**.

### Validación

Los esquemas Zod de `lib/validation.ts` los comparten el formulario y las Server
Actions. Tres normalizaciones con `z.preprocess`:

- `numeric()` — acepta la coma decimal española (`12,50` → `12.50`)
- `optionalText()` — `""` y espacios en blanco pasan a `null`
- `dateFromInput` — `"2026-03-05"` a medianoche **local**, no UTC, para que la
  fecha no se desplace un día

`lib/tax-id.ts` valida de verdad NIF, NIE y CIF, con su dígito o letra de
control, no solo el formato:

- **NIF**: `TRWAGMYFPDXBNJZSQVHLCKE[nº mod 23]`
- **NIE**: sustituye el prefijo X/Y/Z por 0/1/2 y aplica lo mismo
- **CIF**: duplica las posiciones impares y suma sus cifras; el control es
  dígito, letra o cualquiera de los dos según el tipo de entidad

### Fronteras que hay que respetar

| Fichero | Por qué existe |
| --- | --- |
| `lib/form-state.ts` | Un fichero `"use server"` **solo puede exportar funciones async**, así que `FormState` y `EMPTY_FORM_STATE` no pueden vivir junto a las acciones |
| `lib/invoices.ts` | Capa de lectura `server-only`; convierte los `Decimal` de Prisma a `number` planos, porque los `Decimal` no cruzan la frontera hacia los Client Components |
| `lib/db.ts` | Singleton de `PrismaClient` en `globalThis`, para que el hot reload no abra una conexión nueva en cada recarga |

Y una regla operativa: **las páginas que leen la base de datos necesitan
`export const dynamic = "force-dynamic"`**. Sin eso Next las prerenderiza
estáticas en el build y se quedan congeladas.

### Interfaz

**`InvoiceForm`** es un Client Component con líneas añadibles y eliminables,
`useActionState` para el envío y `useMemo` para recalcular el desglose en cada
tecleo. Las claves de React se generan con un `useRef` que solo se incrementa en
el manejador, nunca durante el render.

**`InvoiceTotals`** se comparte: el formulario le pasa los totales calculados en
vivo y la vista de detalle los ya guardados, con el mismo aspecto en ambos.

**El tema (claro / oscuro / sistema) y el menú superior plegable** usan la misma
técnica: la preferencia vive en `localStorage`, se lee con
`useSyncExternalStore` (que además la sincroniza entre pestañas) y un script del
`<head>` escribe `data-theme` / `data-nav` en `<html>` **antes del primer
pintado**. Quién se ve lo decide el CSS a partir de esos atributos, no el estado
de React: así no hay parpadeo ni hay que esperar a la hidratación.

---

## Tests

| Fichero | Qué cubre |
| --- | --- |
| `tests/invoice-math.test.ts` | Redondeos, agrupación por tipo de IVA, IRPF, descuentos, y que el desglose cuadre siempre con el total |
| `tests/tax-id.test.ts` | Validación de NIF / NIE / CIF |
| `tests/validation.test.ts` | Esquemas Zod, coma decimal, campos opcionales |
| `tests/invoice-actions.test.ts` | Integración real de las Server Actions |

```bash
npm test                                    # toda la suite
npx vitest run tests/invoice-math.test.ts   # un solo fichero
npx vitest run -t "IRPF"                    # un solo test por nombre
```

`tests/invoice-actions.test.ts` es el más importante si tocas `actions.ts`:
levanta una SQLite temporal aplicando el SQL de la migración y mockea
`next/cache` y `next/navigation` (`redirect` lanza un error del que se extrae el
destino). Cubre alta, correlativos, reinicio por año, series independientes,
edición y borrado en cascada.

`vitest.config.mts` alias `server-only` a un stub vacío, porque el paquete real
lanza fuera del entorno de servidor de Next.

## Trampas del entorno

- **Prisma 7 exige driver adapter** para SQLite. El export se llama
  `PrismaBetterSqlite3` (q minúscula), no `PrismaBetterSQLite3`.
- El cliente generado va a `lib/generated/prisma` y **está gitignored**: tras
  clonar hay que ejecutar `npx prisma generate`.
- `prisma.config.ts` (no `package.json`) es donde se configura Prisma 7.
- `better-sqlite3` es un módulo nativo y está en `serverExternalPackages`
  (`next.config.ts`). Sin eso el bundler falla al resolverlo.
- **Tailwind v4 no permite que una clase propia haga `@apply` de otra clase
  propia**, por eso `.btn-primary` repite la base de `.btn` en vez de componerla.
- Los colores se definen en `:root` **a secas** y los bloques de tema solo
  redefinen tokens; un color cuya única definición viviera dentro del media
  query desaparecería al forzar el tema claro.

## Formato es-ES

`2400,00 €` **sin punto de miles es correcto**: el CLDR español no agrupa hasta
los 5 dígitos (`1.234.567,50 €` sí los lleva). No lo "arregles".

## Fuera de alcance por ahora

Catálogo de clientes reutilizables y dashboard de facturación. `Client` se
extrae de los campos de cliente hoy embebidos en `Invoice` cuando haga falta.
