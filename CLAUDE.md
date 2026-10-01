# Begiz — instrucciones para Claude

App personal para guardar webs de inspiración. Arquitectura y decisiones en `ARCHITECTURE.md`;
puesta en marcha en `README.md`.

## Forma de trabajar

- Responder siempre en **español**.
- **Backend y arquitectura**: la usuaria no es experta. **Decidir y explicar** (decisión + motivo
  + lo que implica), no presentar menús de opciones.
- **Front**: tiene más experiencia (Vue 3 + Vite + TS) pero no lo domina. Acompañar con
  explicaciones de lo que se hace y por qué, algo menos detalladas que en backend.
- El alcance de producto lo decide ella.
- Ir **en orden**: no saltar a una fase nueva sin cerrar y validar la anterior.
- **Diseño visual aparcado**: estilo mínimo (fondo blanco, bordes negros finos, tipografía del
  sistema en negro) hasta que la plataforma esté validada. Reutilizar las clases de
  `apps/web/src/style.css`; no decorar ni proponer diseño hasta que ella abra esa fase.

## Escritura de código

- Todo el código **en inglés**: nombres, comentarios, mensajes de error y textos de log. Nada de
  español en el código.
- Nombres de variables y funciones **descriptivos**, que se entiendan por sí solos y en
  **camelCase**. Nada de letras sueltas ni abreviaturas sin lógica (`collectionName`, no `cn`
  ni `x`).
- **Comentarios solo cuando algo necesita explicación**, y de forma concisa: el porqué de una
  decisión o qué hace una función cuya lógica no es evidente. No comentar lo que el código ya
  dice ni narrar lo que se hace o se va a hacer (nada de `// here the h1`).

## Git

- **Nunca hacer commit ni push por iniciativa propia.** Lo pide ella.
- Si hay un punto natural para hacer commit (algo terminado y verificado) y no lo ha pedido,
  **sugerirlo** y esperar respuesta.
- Push solo después del commit y cuando ella lo confirme.
- Mensajes de commit **en inglés, directos y concisos** (asunto corto en imperativo, p. ej.
  `Add collection rename endpoint`; cuerpo solo si aporta algo).
- Ella crea los repositorios en GitHub. Remoto: `git@github.com:zeitign/begiz.git` (SSH).

## Proyecto

- Monorepo pnpm: `apps/api` (Hono + Drizzle), `apps/web` (Vue 3 + Vite), `packages/shared` (Zod).
- Supabase solo para login y Postgres; el front nunca consulta la base de datos directamente.
- Secretos en `apps/api/.env` y `apps/web/.env` (ignorados por git). La contraseña de la base de
  datos la gestiona ella: no pedirla ni mostrarla.
- Cambios de esquema: editar `apps/api/src/db/schema.ts`, `pnpm db:generate` y `pnpm db:migrate`.
  Toda tabla nueva necesita `ENABLE ROW LEVEL SECURITY` en su migración.
- Antes de dar algo por terminado: `pnpm typecheck` (y `pnpm build` si toca el front).

## Entorno

- Se desarrolla en **WSL2** y se navega desde Windows: los servidores de desarrollo deben
  escuchar en todas las interfaces (Vite tiene `host: true`).
- `vue-tsc` no soporta TypeScript 7: el front usa TypeScript 6; la API y `shared`, TypeScript 7.
- No hay Docker ni CLI de Supabase: en desarrollo se usa el proyecto de Supabase en la nube y las
  imágenes se guardan en disco (`apps/api/.data/uploads`).
