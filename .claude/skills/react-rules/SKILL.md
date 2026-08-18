---
name: react-rules
description: Genera un proyecto con la estructura de React con TypeScript y aplica las mejores prácticas de React 19. Úsala cuando el usuario pida crear una aplicación o componente React, o agregar/modificar componentes, hooks, estado, formularios o lógica de UI en React.
---

# Mejores prácticas de React con TypeScript

Aplica estas reglas al crear un proyecto React nuevo y al tocar cualquier
componente, hook, estado, formulario o lógica de UI en React.

## Stack obligatorio

| Necesidad | Librería |
| --- | --- |
| Librería base | **React 19.2.5 o superior** |
| Lenguaje | **TypeScript**, nunca JavaScript |
| Estado global | **Zustand** |
| Validación | **Zod** |
| Formularios | **React Hook Form** + Zod |
| Datos de API | **React Query** o **SWR** |

Antes de fijar la versión, comprueba la última estable publicada en
<https://www.npmjs.com/package/react> y usa esa si es superior a 19.2.5.

TypeScript no es opcional: mejora el tipado, la seguridad del código y la
mantenibilidad. Nada de `.jsx`.

## Estado global con Zustand

Crea un store con `create()` donde definas **estado y acciones juntos**:

```ts
import { create } from "zustand";

type CarritoState = {
  articulos: Articulo[];
  añadir: (articulo: Articulo) => void;
  vaciar: () => void;
};

export const useCarrito = create<CarritoState>((set) => ({
  articulos: [],
  // Nunca mutar: siempre una copia nueva.
  añadir: (articulo) => set((s) => ({ articulos: [...s.articulos, articulo] })),
  vaciar: () => set({ articulos: [] }),
}));
```

## Validación con Zod

Define esquemas con `z.object`, `z.string`, etc., y valida con `parse`
(lanza) o `safeParse` (devuelve un resultado):

```ts
const usuarioSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
});

const resultado = usuarioSchema.safeParse(datos);
if (!resultado.success) { /* ... */ }
```

En formularios, **integra Zod con React Hook Form** mediante su resolver, para
que el esquema sea la única fuente de verdad de las reglas:

```tsx
const { register, handleSubmit, formState: { errors } } = useForm<Usuario>({
  resolver: zodResolver(usuarioSchema),
});
```

## Componentes

- Mantenlos **pequeños, simples y con una sola responsabilidad**.
- **No mutes el estado directamente**: crea siempre copias nuevas de objetos o
  arrays (`[...arr]`, `{ ...obj }`).
- **Evita los side effects durante el render.** Los componentes y los hooks
  deben ser puros.
- Para comunicar cambios al padre, usa **callbacks por props** y ejecútalos
  desde el hijo cuando algo cambie.

## `useEffect`: cuándo sí y cuándo no

**Sí** — solo para sincronizar con sistemas externos: API, DOM, librerías de
terceros, suscripciones, temporizadores.

**No** para:

- Lógica derivada de props o estado → **calcúlala en el render** o en el
  handler.
- Lógica causada por una interacción del usuario → va en el **event handler**.
- Reiniciar o ajustar estado cuando cambian las props → usa **`key`**, deriva el
  estado desde las props, o actualízalo en el evento correspondiente.

Mantén los effects **simples y con dependencias claras**.

```tsx
// ❌ Mal: estado derivado en un effect
const [total, setTotal] = useState(0);
useEffect(() => { setTotal(precio * cantidad); }, [precio, cantidad]);

// ✅ Bien: calculado en el render
const total = precio * cantidad;
```

## Hooks

- **Nunca llames a un hook dentro de bucles, condicionales o funciones
  anidadas.** Siempre en el nivel superior del componente o del custom hook.
- **Extrae la lógica reutilizable a custom hooks** (`useAuth`, `useFetch`…) para
  que los componentes queden más claros.
- **Comparte lógica entre eventos** con funciones reutilizables o hooks, no
  duplicando código en cada handler.
- Usa **`useMemo`** para cachear cálculos costosos — solo los costosos, no todo.

## Datos de API

Cuando un componente necesite obtener datos de una API y **compartirlos o
reutilizarlos entre varios componentes**, usa **React Query** o **SWR**: te dan
caché y refetch automático sin escribir un `useEffect` de fetch a mano.

## Estructura del proyecto

```
src/
  components/      # componentes de presentación, pequeños
  hooks/           # custom hooks reutilizables
  stores/          # stores de Zustand
  schemas/         # esquemas de Zod
  services/        # llamadas a la API
  types/           # tipos compartidos
  pages/           # o routes/, según el enrutador
```

## Antes de terminar

Registra la skill en `CLAUDE.md`, en las secciones **Available skills** y
**Skill trigger rules**. Si el fichero no existe, créalo.
