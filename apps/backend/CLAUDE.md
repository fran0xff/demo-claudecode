@AGENTS.md

Backend de la app de facturación: Next.js 16 (solo `app/api/**`, sin
páginas) · Prisma 7 sobre SQLite · Zod 4 · decimal.js. Ver `../../CLAUDE.md`
(raíz) para el mapa del monorepo y el contrato de autenticación entre esta
app y `apps/frontend`; este fichero es solo lo que pasa aquí dentro.

**El código y los comentarios están en español.**

## Comandos

```bash
npm run dev                  # servidor de desarrollo, puerto 3001
npm run build                # build de producción (también hace el type-check)
npm run lint                 # eslint
npm test                     # toda la suite (vitest)
npm run seed                 # datos de ejemplo, idempotente
npm run create-user -- correo@ejemplo.com "contraseña larga" [--force]
                              # alta/reseteo manual de un usuario (login)

npx vitest run tests/invoice-service.test.ts   # un solo fichero
npx vitest run -t "IRPF"                       # un solo test por nombre

npx prisma migrate dev --name <nombre>      # cambiar el esquema
npx prisma generate                         # tras clonar: el cliente está gitignored
npx prisma studio                           # inspeccionar la base de datos
```

La base de datos es `./dev.db` **en la raíz de este workspace**
(`apps/backend/dev.db`), no dentro de `prisma/`. `prisma.config.ts` (no
`package.json`) es donde se configura Prisma 7, y trae un fallback para que
el proyecto funcione recién clonado sin `.env`.

## Facturas: rutas REST → servicio → repositorio

Las mutaciones de facturas (crear, emitir, cambiar estado, editar, borrar) no
son Server Actions: viven en `app/api/invoices/**` (rutas delgadas) →
`lib/services/invoice-service.ts` (lógica de negocio) →
`lib/repositories/invoice-repository.ts` (el único fichero, junto a
`lib/repositories/settings-repository.ts` y `lib/repositories/user-repository.ts`,
que importa Prisma).

| Método | Ruta | Qué hace |
| --- | --- | --- |
| `GET`    | `/api/invoices?page=` | Página del listado (10 por página, paginado en la BBDD) |
| `POST`   | `/api/invoices` | Crear borrador |
| `GET`    | `/api/invoices/[id]` | Detalle |
| `POST`   | `/api/invoices/[id]` | Editar (recalcula totales; no hay PUT/PATCH a propósito) |
| `DELETE` | `/api/invoices/[id]` | Borrar |
| `POST`   | `/api/invoices/[id]/issue` | Emitir (asigna correlativo) |
| `POST`   | `/api/invoices/[id]/status` | Cambiar estado |
| `GET`    | `/api/invoices/next-number?series=&year=` | Correlativo que le tocaría a la siguiente (informativo) |
| `GET`    | `/api/settings` | Ajustes del emisor |
| `POST`   | `/api/settings` | Guardar ajustes |
| `GET`    | `/api/users` | Listado de usuarios |
| `POST`   | `/api/users` | Crear usuario |
| `POST`   | `/api/users/[id]/password` | Cambiar contraseña |
| `DELETE` | `/api/users/[id]` | Eliminar usuario |

El servicio no conoce `Request`/`Response`/cookies: devuelve datos o lanza los
errores tipados de `lib/services/errors.ts`; es la ruta quien los traduce a
código HTTP y quien llama a `setFlash` (ver "El aviso" más abajo). Por eso
`lib/services/invoice-service.ts` se puede testear sin HTTP
(`tests/invoice-service.test.ts`) y las rutas se testean aparte, invocando
directamente las funciones `GET`/`POST`/`DELETE` exportadas
(`tests/invoice-routes.test.ts`). `GET /api/settings` y
`GET /api/invoices/next-number` no existían cuando el frontend leía el
repositorio en el mismo proceso — se añadieron al separar las dos apps,
porque esas lecturas también tienen que cruzar la red ahora.

## El listado pagina en la base de datos, con SQL en crudo

`invoiceRepository.listInvoices(page, pageSize)` no usa `findMany` con
`skip`/`take`: el orden no es una sola columna. Los borradores (`number`
nulo) van siempre primero, por fecha de creación —son los que piden una
decisión—, y el resto por año/serie/correlativo descendente. Prisma no
puede expresar ese orden compuesto en `orderBy`, así que el `SELECT` con
`ORDER BY`/`LIMIT`/`OFFSET` va en `$queryRaw`; sin eso, paginar de verdad en
la BBDD cortaría las páginas por el orden equivocado (por ejemplo, un
borrador podría aparecer a mitad de la página 2 en vez de siempre arriba de
la 1). Si `page` cae fuera de rango, `listInvoices` se repite una sola vez
con la última página real en vez de devolver un hueco vacío.

`INVOICE_PAGE_SIZE` (10, en `invoice-service.ts`) es fijo, no una preferencia
configurable. `InvoicePage` (`@facturas/shared/dto`) lleva también
`draftsTotal` y `total` — recuentos de **todas** las facturas, no solo la
página actual — porque el resumen de arriba del listado (`N borradores · N
emitidas`) los necesita sin traerlas todas.

## El cálculo es el núcleo y vive en `@facturas/shared`

`@facturas/shared/invoice-math` es un módulo **puro** — sin React, sin
Prisma. Lo importan tanto `apps/frontend/components/invoice-form.tsx`
(previsualizado en vivo mientras se teclea) como
`lib/services/invoice-service.ts` (los importes que realmente se guardan) —
por eso vive en el paquete compartido y no aquí. El cliente nunca envía
totales: **el servidor siempre recalcula** antes de persistir.

Reglas que no se deben "simplificar":

- **El IVA se aplica sobre la base agrupada por tipo, no línea a línea.** Sumar
  cuotas ya redondeadas de cada línea descuadra céntimos. Hay un test que fija
  el caso (`packages/shared/tests/invoice-math.test.ts`, dos líneas de 1,15 €
  al 10 % → 0,23 € agrupadas frente a 0,24 € línea a línea).
- Toda la aritmética intermedia va en `Decimal`, redondeando solo al cerrar cada
  nivel: línea → base por tipo → total.

## El número se gasta al emitir, no al crear

`Invoice.number` es **nullable**: una factura nace como `BORRADOR` sin número y
lo recibe en `invoiceService.issueInvoice`. Si se numerase al crear, borrar un
borrador dejaría un hueco en la serie, que es justo lo que la numeración no
puede tener.

La numeración es por serie y año, se asigna dentro de una transacción, está
respaldada por `@@unique([series, year, number])` (en SQLite los `NULL` no
colisionan entre sí, así que puede haber muchos borradores) y reintenta ante
colisión.

Los estados viven en `@facturas/shared/invoice-status`, no en un enum: SQLite
no los admite en Prisma, así que la columna es un `String` y las acciones
validan contra esa lista. **"Vencida" no es un estado guardado**, se deduce de
`dueDate` al leer (tanto aquí como en el frontend) para que no se quede
desfasado.

## Lo que queda congelado en una factura

Una factura emitida no puede cambiar retroactivamente, así que:

- Los **totales se persisten** en `Invoice` en vez de derivarse al leer.
- Los datos del **emisor se copian** desde `Settings` al crear la factura; no
  hay relación. Cambiar los ajustes no toca las facturas ya emitidas.
- Los datos del **cliente van embebidos** en `Invoice` (todavía no hay modelo
  `Client`).
- **Serie, año y correlativo son inmutables una vez emitida**:
  `invoiceService.updateInvoice` solo toca serie y año mientras es
  `BORRADOR`, y el formulario (en `apps/frontend`) muestra el número en solo
  lectura.
- De `EMITIDA`/`ENVIADA`/`PAGADA` **no se vuelve a `BORRADOR`**: el correlativo
  ya está gastado.

## Contrato de `FormData` con el formulario

Los inputs de línea que manda `apps/frontend/components/invoice-form.tsx` se
llaman `lines.0.description`, `lines.0.quantity`, etc. Ese nombre es un
contrato de tres puntas que cruza las dos apps:

1. El formulario lo emite como `name` del input.
2. `apps/frontend/lib/api/invoice-client.ts` manda ese mismo `FormData` tal
   cual como cuerpo de un `fetch` (`multipart/form-data`) — no lo toca.
3. `parseInvoiceForm`, aquí en `lib/services/invoice-service.ts`, lo reagrupa
   en un array a partir de `request.formData()` en la ruta.
4. `fieldErrors` en `lib/validation.ts` devuelve los errores de Zod con esa
   misma ruta, que es como el formulario los pinta junto a cada campo.

Si cambias el patrón en un sitio, cámbialo en los cuatro o los errores dejan de
aparecer **en silencio**.

## Usuarios: mismo patrón REST que facturas, sin roles

`lib/services/user-service.ts` → `lib/repositories/user-repository.ts` es la
única capa que toca Prisma para usuarios. El modelo `User` no tiene roles ni
el CRUD distingue "quién soy yo" del resto: cualquier sesión válida puede
listar, crear, cambiar la contraseña de cualquiera o eliminar cualquier
usuario, incluido a sí mismo — decisión explícita del usuario del proyecto,
no un descuido, así que no añadas guardas de autoprotección sin que te lo
pidan.

`POST /api/users` y `DELETE /api/users/[id]` llaman a `setFlash` porque esas
mutaciones navegan a otra pantalla en el frontend. `POST
/api/users/[id]/password` no navega, así que el mensaje viaja en el cuerpo
de la respuesta en vez de en la cookie de flash — mismo motivo por el que
`POST /api/settings` tampoco usa flash.

## El aviso: quien lo escribe

`lib/flash-cookie.ts` (`setFlash`) deja el aviso preparado, en cookie
(`httpOnly: false`, `domain: COOKIE_DOMAIN`), antes de responder a una
mutación que navega a otra pantalla en el frontend. Quien lo **lee** y lo
**pinta** es `apps/frontend` — ver `apps/frontend/CLAUDE.md`. La forma de la
cookie (`FLASH_COOKIE`, `Flash`, `parseFlash`) vive en
`@facturas/shared/flash` porque las dos apps tienen que coincidir en ella.

## Autenticación (detalle de este lado)

Ver `../../CLAUDE.md` para el contrato con el frontend (dominio compartido,
`sameSite`, CORS). Aquí:

Login (`POST /api/auth/login` → `lib/services/auth-service.ts`) valida con
`bcrypt.compare` contra un hash "señuelo" precalculado cuando el email no
existe, para que un email inexistente tarde lo mismo que una contraseña
incorrecta (no se puede distinguir por tiempo de respuesta, evita enumeración
de usuarios). El JWT lo firma `lib/security/jwt.ts` con `jose` (HS256, 24h,
sin refresh token — un solo operador local no necesita renovación silenciosa)
reexportando la verificación desde `@facturas/shared/jwt-verify`. El login no
devuelve el token en el body: nada que un XSS pueda leer desde `localStorage`.

`lib/security/rate-limit.ts` tiene dos limitadores independientes, en
memoria y por proceso (sin Redis: app local de un solo operador, no hay
infraestructura compartida que justificar):

- `checkLoginRateLimit`: 5 intentos / 15 min por IP, aplicado a mano solo en
  `app/api/auth/login/route.ts` — frena fuerza bruta sobre una credencial.
- `checkApiRateLimit`: 120 peticiones / min por IP, aplicado **una sola vez
  en `proxy.ts`** antes de comprobar la cookie, cubriendo automáticamente
  cualquier ruta nueva que caiga bajo los prefijos protegidos.

`proxy.ts` es el único punto de protección de `/api/**`: comprueba
`OPTIONS` (CORS preflight) primero, luego rate limit, luego la cookie de
sesión — y añade las cabeceras CORS a toda respuesta, incluida `/api/auth/**`
(que no exige sesión, por definición, pero sigue necesitando CORS para que
el navegador acepte la respuesta).

No hay usuario de fábrica: `prisma/create-user.ts` (`npm run create-user --
correo "contraseña" [--force]`) es el único modo de dar de alta el primero
antes de poder usar la pantalla de Usuarios. Hashea con `bcryptjs`
directamente en vez de reutilizar `hashPassword` de `auth-service.ts`: ese
fichero lleva `import "server-only"`, que sí lanza al ejecutarse con `tsx`
desde terminal (ahí no hay bundler de Next que reconozca la condición de
servidor) — mismo paquete, comportamiento distinto según quién lo cargue.

## Fronteras que hay que respetar

- `lib/repositories/invoice-repository.ts`, `settings-repository.ts` y
  `user-repository.ts` son los **únicos** ficheros de todo el monorepo que
  importan Prisma, y convierten los `Decimal` a `number` planos ahí: los
  `Decimal` no cruzan la red hacia el frontend.
- Un fichero `"use server"` **solo puede exportar funciones async** — no hay
  ninguno en esta app ahora mismo (ajustes se movió a REST), pero si
  reaparece uno, el `FormState` que consume no puede vivir junto a él.

## Trampas del entorno

- **Prisma 7 exige driver adapter** para SQLite. El export se llama
  `PrismaBetterSqlite3` (q minúscula), no `PrismaBetterSQLite3`.
- El cliente generado va a `lib/generated/prisma` y **está gitignored**: tras
  clonar hay que ejecutar `npx prisma generate` (dentro de `apps/backend`).
- `better-sqlite3` es un módulo nativo y está en `serverExternalPackages`
  (`next.config.ts`). Sin eso el bundler falla al resolverlo.
- **`AUTH_JWT_SECRET` es obligatoria** (mínimo 32 bytes: `openssl rand -base64
  32`) y tiene que coincidir con la de `apps/frontend`. Sin ella la app falla
  al arrancar, a propósito.
- **`FRONTEND_ORIGIN`** tiene que ser el origen exacto (protocolo + host +
  puerto) desde el que corre `apps/frontend`, para el CORS de `proxy.ts`.

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
invocando directamente las funciones `GET`/`POST`/`DELETE` exportadas (se
construye la petición a mano, no hace falta un servidor corriendo), y
comprueba status codes y el payload exacto de cada aviso (tono, mensaje,
número de serie) vía el mismo mock de `next/headers`. Ambos aplican
**todas** las migraciones en orden, no solo la inicial: si añades una, no
hay que tocar los tests.

`tests/user-service.test.ts` y `tests/user-routes.test.ts` siguen el mismo
patrón aplicado a `lib/services/user-service.ts` y `app/api/users/**`. Ambos
fijan `AUTH_JWT_SECRET` en `beforeAll` **antes** de importar el servicio/las
rutas, porque `user-service.ts` arrastra `lib/security/jwt.ts` a través de
`hashPassword` (`auth-service.ts`), y `jwt.ts` calcula el secreto una sola
vez al cargar el módulo — mismo motivo que `tests/security-jwt.test.ts` (que
prueba `signAuthToken`/`verifyAuthToken` sueltos: firma válida, secreto
distinto, token expirado). `tests/rate-limit.test.ts` prueba
`checkLoginRateLimit`/`checkApiRateLimit` con `vi.useFakeTimers()` en vez de
esperar minutos de verdad a que expire la ventana.
