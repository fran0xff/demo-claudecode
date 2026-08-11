# App de facturación

Aplicación web local para emitir facturas con líneas de detalle, desglose de IVA
por tipo y retención de IRPF, siguiendo la práctica habitual en España.

## Puesta en marcha

```bash
npm install
cp .env.example .env         # DATABASE_URL apunta a un fichero SQLite local
npx prisma migrate dev       # crea dev.db y aplica el esquema
npm run seed                 # ajustes del emisor + 2 facturas de ejemplo
npm run dev                  # http://localhost:3000
```

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm test` | Tests unitarios y de integración (vitest) |
| `npm run seed` | Rellena la base de datos con datos de ejemplo |
| `npx prisma studio` | Explorador de la base de datos |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Prisma 7 sobre SQLite ·
Tailwind CSS 4 · Zod 4 · decimal.js

## Cómo está montado

**El cálculo vive en un módulo puro.** `lib/invoice-math.ts` no depende de React
ni de Prisma, así que lo usan igual el formulario (para el previsualizado en
vivo) y el servidor (que es quien decide los importes que se guardan).

**El IVA se aplica sobre la base agrupada por tipo**, no línea a línea. Sumar
cuotas ya redondeadas de cada línea produce descuadres de céntimos y no es como
se desglosa una factura española. Toda la aritmética intermedia va en `Decimal`
y solo se redondea al cerrar cada nivel: línea → base por tipo → total.

**Los totales se persisten, no se derivan en lectura.** Una factura ya emitida
no puede cambiar de importe porque mañana se toque la lógica de cálculo. Por el
mismo motivo, los datos del emisor se *copian* desde los ajustes al crear la
factura en vez de referenciarse, y la serie, el año y el correlativo quedan
fijos tras la creación.

**El tema tiene tres estados**: claro, oscuro y el de por defecto, que sigue al
sistema. La elección se marca con `data-theme` en `<html>` y se aplica desde un
script en el `<head>`, antes del primer pintado, para que la página no aparezca
un instante con el tema equivocado. El selector lee la preferencia con
`useSyncExternalStore`, así que también se sincroniza entre pestañas.

**El menú superior se puede plegar** con el botón de la derecha de la cabecera.
Al ocultarse queda un botón flotante que lo devuelve, y la preferencia se
recuerda igual que el tema. Quién se ve lo decide el CSS a partir de `data-nav`,
no el estado de React, así que en la primera pintura ya está el botón correcto.

**El identificador fiscal se valida de verdad** (`lib/tax-id.ts`): NIF, NIE y
CIF con su dígito o letra de control, no solo el formato.

**La numeración es por serie y año** (`A-2026-0001`), se asigna dentro de una
transacción y está respaldada por una restricción única en la base de datos; si
dos peticiones simultáneas piden el mismo número, se reintenta con el siguiente.

## Tests

- `tests/invoice-math.test.ts` — redondeos, agrupación por tipo de IVA, IRPF,
  descuentos y que el desglose cuadre siempre con el total.
- `tests/tax-id.test.ts` — validación de NIF / NIE / CIF.
- `tests/validation.test.ts` — esquemas Zod, coma decimal, campos opcionales.
- `tests/invoice-actions.test.ts` — integración de las Server Actions contra una
  base SQLite temporal: alta, numeración, edición y borrado.

## Fuera de alcance por ahora

Catálogo de clientes reutilizables, exportación a PDF, estados de cobro
(borrador / enviada / pagada / vencida) y dashboard. El esquema está pensado
para admitirlos: `Client` se extrae de los campos de cliente hoy embebidos en
`Invoice`, y `status` entra como una columna más.
