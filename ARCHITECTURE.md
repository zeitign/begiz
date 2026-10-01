# Arquitectura

App personal para guardar webs de inspiración: enlace, título propio, imagen, notas, tags y colecciones.
Requisitos completos en `requisitos-app-guardado-webs.pdf`.

## Decisiones

| Tema | Decisión | Motivo |
|---|---|---|
| Front | Vue 3 + Vite + TypeScript, SPA | Herramienta privada tras login: no necesita SSR ni SEO. |
| Estilo | Mínimo y provisional (blanco, bordes negros, tipografía del sistema) | El diseño visual se hará cuando la plataforma funcione. |
| Backend | Node + Hono + Drizzle | Mismo lenguaje que el front; el cliente `hc` de Hono tipa las llamadas del front sin duplicar tipos. |
| Base de datos | PostgreSQL en Supabase | Relacional (tags y colecciones son muchos a muchos); `pg_trgm` para buscar por título. |
| Login | Supabase Auth (email + contraseña, registro público desactivado) | Una sola usuaria. La API valida el JWT de Supabase. |
| Imágenes | Disco local en desarrollo, Cloudflare R2 en producción | Mismo código (interfaz `Storage`); R2 no cobra por descarga. |
| Vista previa (v1) | Imagen subida a mano → `og:image` de la página → tarjeta con favicon y dominio | La captura automática se deja para la v2. |
| Validación | Zod, en `packages/shared` | Los mismos esquemas en el front, la API y la futura extensión. |

## Estructura

```
apps/
  api/        Hono + Drizzle. Rutas en src/routes, migraciones en drizzle/
  web/        Vue 3 + Vite. Vistas en src/views, componentes en src/components
packages/
  shared/     Esquemas Zod y utilidades comunes
```

## Flujo de datos

```
Vue ── supabase-js (solo login) ──► Supabase Auth ──► JWT
 │
 └── cliente hc de Hono + "Authorization: Bearer <JWT>" ──► API /api/*
                                                             │ valida el JWT (JWKS de Supabase)
                                                             ├─► Postgres (Supabase)
                                                             └─► Storage (disco / R2)
```

El front **nunca** lee la base de datos directamente: toda la lógica está en la API, que también usará la futura extensión.

## Modelo de datos

```
webs            id, user_id, url, title, notes, preview_key, preview_source ('manual'|'og'),
                full_key, site_title, favicon_url, created_at, updated_at
tags            id, user_id, name                  (único por usuaria, normalizado en minúsculas)
web_tags        web_id, tag_id
collections     id, user_id, name, description     (nombre único por usuaria)
collection_webs collection_id, web_id
```

- `user_id` es el id de `auth.users` de Supabase. No es clave foránea, para no atar el esquema a Supabase.
- `preview_key` es la miniatura WebP del mosaico (800 px de ancho, recortada por arriba a 1200 px).
  `full_key` es la imagen original subida a mano, que puede ser una captura de página completa.
- Los tags sin webs se borran solos.
- Filtrar por varios tags devuelve las webs que tienen **todos** (Y).

## API

Todas las rutas van bajo `/api` y exigen sesión.

| Método | Ruta | |
|---|---|---|
| GET | `/webs?q=&tags=a,b&collection=` | Mosaico con filtros |
| POST | `/webs` | Crear. Lee título, favicon y `og:image` de la página (`usePageImage: false` para no descargar la imagen) |
| GET / PATCH / DELETE | `/webs/:id` | Detalle, edición (incluye tags y colecciones), borrado |
| PUT | `/webs/:id/preview` | Subir imagen propia (multipart, campo `image`) |
| GET / POST | `/collections` | Listar (con contador) y crear |
| PATCH / DELETE | `/collections/:id` | Renombrar y borrar (las webs no se borran) |
| GET | `/tags` | Tags en uso con contador, ordenados por uso |

## Seguridad

- **SSRF**: la API abre las URLs que se guardan. `lib/safe-fetch.ts` bloquea IPs no públicas (localhost, redes
  privadas, 169.254.x…) comprobándolas **al conectar** y en cada redirección, con tiempo y tamaño máximos.
- **RLS activado en todas las tablas** (migración `0002`). Con la clave pública del front, la API REST de Supabase
  podría leer tablas de `public`; con RLS y sin políticas queda cerrado. La API se conecta como propietaria y no le afecta.
- **Aislamiento**: cada consulta filtra por `user_id`; no se pueden asignar colecciones de otra usuaria.
- Las imágenes son públicas pero con rutas imposibles de adivinar (uuids).
- Las imágenes subidas se validan por su contenido real con sharp, no por la extensión.

## Fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 · Base | Login, CRUD de webs, tags y colecciones, búsqueda, vista previa por `og:image` o imagen manual | Validada con el Supabase real (1-oct-2026) |
| 1b · Tests de la API | Vitest en el monorepo. Tests de la API y de `shared` | **En curso**: tests hechos; falta revisar el código de la fase 1 |
| Diseño | Diseño visual de la plataforma | Tras los tests |
| 2 · Captura | Captura automática con Playwright en un worker (rellena `preview_key` / `full_key` con `preview_source = 'screenshot'`); requiere un contenedor con Chromium | Planificada |
| 3 · Extensión | Extensión de navegador (WXT + Vue) usando la misma API | Planificada |
| 4 · Componentes | RF-F1: guardar componentes concretos (tabla `components` que apunta a `webs`) | Futuro |

### Tests

- **Herramienta**: Vitest en todos los paquetes, con un `pnpm test` en la raíz.
- **Fase 1b**: convertir en tests automáticos las 34 comprobaciones manuales de la fase 1 (tags,
  filtros, colecciones, imágenes, validaciones, SSRF, borrado y aislamiento entre usuarias).
  - Las rutas se prueban con `app.request()` de Hono, sin levantar el servidor.
  - La base de datos es **PGlite** (Postgres en memoria, sin Docker), con las mismas migraciones
    de Drizzle. Los tests nunca tocan el Supabase real.
  - Los tests firman tokens como los de Supabase, así que pasan por la validación real del JWT.
  - Las descargas de páginas externas se simulan (`test/fake-web.ts`). La protección SSRF se prueba
    aparte con el código real.
- **Front**: tests de componentes (`@vue/test-utils`) solo para la lógica que no cambie con el
  diseño (filtros en la URL, pegado de imágenes). Se añaden al cerrar la fase de diseño.
- **A partir de la fase 1b**, cada fase se cierra con sus tests y `pnpm test` en verde.

## Despliegue previsto

- API: contenedor Node (Railway, Fly.io o Render). `pnpm --filter @webs/api start`.
- Front: estático (`apps/web/dist`) en Cloudflare Pages, con `VITE_API_URL` apuntando a la API y
  `CORS_ORIGIN` en la API apuntando al front. Configurar la SPA para que todas las rutas sirvan `index.html`.
- Imágenes: bucket R2 con acceso público (dominio propio o `r2.dev`).
