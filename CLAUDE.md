# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

App de facturación local: facturas con líneas de detalle, desglose de IVA por
tipo y retención de IRPF, siguiendo la práctica española.

**El código, los comentarios, la interfaz y los mensajes de commit están en
español.** Mantén ese idioma al añadir código.

## Monorepo

Backend y frontend son **dos apps Next.js independientes**, cada una con su
propio `package.json`, pensadas para desplegarse por separado (npm
workspaces, sin Turborepo ni pnpm):

```
apps/backend/    # Next.js 16, solo app/api/** — la única que toca Prisma/SQLite
apps/frontend/   # Next.js 16, solo páginas — nunca toca la base de datos
packages/shared/ # @facturas/shared: TS sin compilar, lo consumen las dos apps
```

Cada app tiene su propio `CLAUDE.md` con el detalle de su arquitectura:
`apps/backend/CLAUDE.md` (rutas REST, reglas de negocio de facturas/usuarios,
Prisma) y `apps/frontend/CLAUDE.md` (páginas, componentes, impresión, tema).
Este fichero es el mapa y lo que las dos apps tienen que acordar entre sí.

**No siempre fue un monorepo**: hasta hace poco todo — páginas y API — vivía
en un único proceso Next.js, y las páginas (Server Component) leían el
repositorio **directamente, sin HTTP**. Al separar en dos apps desplegables,
eso ya no es posible: `apps/frontend/lib/backend.ts` sustituye esas lecturas
directas por `fetch` al backend, reenviando la cookie de sesión de la
petición entrante (ver "Autenticación" más abajo). Si algo en el código o en
comentarios asume que ambas partes comparten proceso, está desactualizado.

`@facturas/shared` (`packages/shared/`) existe porque algunas piezas tienen
que ser **exactamente iguales** en las dos apps, no solo parecidas: el
cálculo de importes (`lib/invoice-math.ts`, lo usa el preview en vivo del
frontend y el guardado real del backend), los estados de factura
(`lib/invoice-status.ts`), la forma de la cookie de aviso (`lib/flash.ts`),
el nombre de la cookie de sesión (`lib/auth-cookie-name.ts`), la verificación
de JWT (`lib/jwt-verify.ts`, ver más abajo) y las formas de los datos que
cruzan la red (`lib/dto.ts`: `InvoiceDTO`, `SettingsDTO`, `UserDTO`...). Se
consume como TypeScript sin compilar — cada app lo declara en
`transpilePackages` de su `next.config.ts`, no hay paso de build aparte.

## Comandos

```bash
npm install                  # una sola vez, en la raíz: resuelve los tres workspaces

npm run dev:backend          # apps/backend en :3001
npm run dev:frontend         # apps/frontend en :3000
npm run build                # build de producción de las dos apps
npm run lint                 # eslint en todos los workspaces
npm test                     # vitest en todos los workspaces (backend + shared)
```

Para trabajar solo en una app, `cd apps/backend` o `cd apps/frontend` y usar
sus propios `npm run dev|build|lint|test` — ahí están además `npm run seed` y
`npm run create-user` (ver `apps/backend/CLAUDE.md`).

## Autenticación: JWT en una cookie httpOnly compartida entre subdominios

Esto es lo que las dos apps tienen que acordar sí o sí; el detalle de login
en sí (bcrypt, hash señuelo, `signAuthToken`) está en
`apps/backend/CLAUDE.md`.

**Decisión de despliegue de la que depende todo lo demás: backend y frontend
son subdominios del mismo dominio raíz en producción**
(`app.tudominio.com` / `api.tudominio.com`), no dominios de verdad ajenos.
Eso es lo que permite que seguir siendo tan simple como cuando todo era un
proceso:

- La cookie de sesión (`factura-sesion`, httpOnly) la pone el backend con
  `domain: COOKIE_DOMAIN` (`.tudominio.com` en producción, vacía en local) —
  así la ve también el frontend, en vez de quedarse atada solo al backend.
- `sameSite: "lax"` sigue bastando para CSRF aunque ahora sean dos orígenes
  distintos: `SameSite` se define por **sitio** (dominio raíz registrable),
  no por origen, y dos subdominios del mismo sitio siguen siendo "same-site"
  entre sí. Con dominios de verdad ajenos esto no valdría — se descartó esa
  opción a propósito al diseñar el monorepo, precisamente para no reabrir la
  protección CSRF ni tener que mover el renderizado de páginas protegidas al
  cliente (ver el razonamiento completo en `proxy.ts` del backend).
- Verificar un JWT es pura criptografía (no toca la base de datos), así que
  `apps/frontend/proxy.ts` verifica la cookie **localmente**, sin llamar al
  backend, usando `@facturas/shared/jwt-verify` — exactamente igual que
  cuando todo era un proceso. Firmar sí es exclusivo del backend
  (`apps/backend/lib/security/jwt.ts`), que es quien emite sesiones.
- Requisito operativo, no de código: **`AUTH_JWT_SECRET` tiene que ser
  idéntica en las dos apps desplegadas**. Si no coincide, el frontend
  rechazará como inválida una cookie que el backend firmó de verdad. Cada
  app trae su `.env.example` con esto anotado.
- `apps/frontend/lib/backend.ts` reenvía la cookie de la petición entrante
  como header `Cookie` en sus propios `fetch` de servidor a servidor hacia
  el backend — un `fetch` del servidor de Node no lleva "las cookies del
  navegador" por su cuenta.
- Los `lib/api/*.ts` del frontend (los que llaman los Client Components)
  usan `credentials: "include"` en cada `fetch`: una petición cross-origin
  no manda cookies por defecto aunque sea al mismo sitio.
- El backend responde con CORS explícito (`Access-Control-Allow-Origin` al
  origen exacto del frontend — no puede ser `"*"` porque hay credenciales —
  y gestiona el preflight `OPTIONS`), porque ahora el navegador sí hace
  peticiones cross-origin de verdad.

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
