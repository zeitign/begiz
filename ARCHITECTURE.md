# Arquitectura

App personal para guardar webs de inspiración: enlace, título propio, imagen, notas, tags y colecciones.
Requisitos, plan de arquitectura inicial, explicación de los procesos (instantánea del 1-oct-2026) y
plan de despliegue (14-oct-2026) en `begiz-proyecto.pdf`.

## Decisiones

| Tema | Decisión | Motivo |
|---|---|---|
| Front | Vue 3 + Vite + TypeScript, SPA | Herramienta privada tras login: no necesita SSR ni SEO. |
| Estilo | Mínimo y provisional (blanco, bordes negros, tipografía del sistema), con los colores en variables CSS y tema claro/oscuro. El login, la página de error y la pantalla de carga ya siguen un estilo brutalista: monoespaciada del sistema en títulos, línea fina y sombra dura | El diseño visual se hará cuando la plataforma funcione; con las variables, rediseñar solo cambia valores. Las fichas brutalistas son un primer paso, revisable en la fase de diseño. |
| Backend | Node + Hono + Drizzle | Mismo lenguaje que el front; el cliente `hc` de Hono tipa las llamadas del front sin duplicar tipos. |
| Base de datos | PostgreSQL en Supabase | Relacional (tags y colecciones son muchos a muchos); `pg_trgm` para buscar por título. |
| Login | Supabase Auth (email + contraseña, registro público desactivado) | Cuentas creadas a mano en Supabase (de momento, la usuaria y su compañera). Cada cuenta ve solo sus datos. La API valida el JWT de Supabase. |
| Imágenes | Disco local en desarrollo; Supabase Storage en la etapa gratuita y Cloudflare R2 cuando crezca | Mismo código (interfaz `Storage`, compatible con S3): cambiar de proveedor es cambiar la configuración. |
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
                                                             └─► Storage (disco / S3)
```

El front **nunca** lee la base de datos directamente: toda la lógica está en la API, que también usará la futura extensión.

## Modelo de datos

```
webs            id, user_id, url, title, notes, preview_key, preview_source ('manual'|'og'),
                full_key, site_title, favicon_url, sort_position, created_at, updated_at
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
- `sort_position` guarda el orden propio del mosaico (migración `0003`). Es un número decimal con
  huecos de 1024: mover una web solo cambia su posición, que pasa a estar entre la de sus vecinas. Si
  el hueco se agota, se reparten de nuevo todas las posiciones de la usuaria. Las webs nuevas van
  primero.

## API

Todas las rutas van bajo `/api` y exigen sesión.

| Método | Ruta | |
|---|---|---|
| GET | `/webs?search=&tags=a,b&collection=&sort=&direction=` | Mosaico con filtros. `sort`: `custom` (por defecto), `date`, `title` o `collection`; `direction`: `asc` o `desc` (el orden propio no se invierte) |
| POST | `/webs` | Crear. Lee título, favicon y `og:image` de la página (`usePageImage: false` para no descargar la imagen) |
| GET / PATCH / DELETE | `/webs/:id` | Detalle, edición (incluye tags y colecciones), borrado |
| PUT | `/webs/:id/preview` | Subir imagen propia (multipart, campo `image`) |
| PUT | `/webs/:id/position` | Mover en el orden propio: `{ afterWebId }` (o `null` para ponerla la primera) |
| GET / POST | `/collections` | Listar (con contador) y crear |
| PATCH / DELETE | `/collections/:id` | Renombrar y borrar (las webs no se borran) |
| GET | `/tags` | Tags en uso con contador, ordenados por uso |

## Front

- **Estado**: los filtros y el orden del mosaico viven en la URL; los datos, en la caché de TanStack
  Query. No hay Pinia.
- **Mosaico**: al arrastrar una tarjeta, una copia local cambia de orden al momento y la API guarda
  la posición después. Si la API falla, se vuelve al orden de la caché.
- **Ventanas de información** (`lib/infoWindows.ts`): ventanas flotantes de solo lectura, varias a
  la vez, que se pueden mover, ensanchar, minimizar y maximizar.
- **Tema** (`lib/theme.ts`): pone `data-theme` en `<html>`. Sigue el tema del sistema hasta que se
  elige uno con el botón de la cabecera, que se recuerda en `localStorage`.
- **Arranque** (`lib/supabase.ts`): la app se monta enseguida y el router espera a `authReady`, que
  se resuelve al saber si hay sesión. Si Supabase no responde en 10 segundos o da un error de
  conexión, se muestra la página de error en lugar de dejar la pantalla en blanco; cualquier otro
  error (p. ej. un token revocado) lleva al login.
- **Página de error** (`lib/appError.ts`, `ErrorPage.vue`): sustituye a toda la app cuando no se
  puede usar, con un botón para recargar. Tres tipos: `sign-in` (Supabase no responde al
  arrancar), `server` (la API no responde: `fetch` falla o el proxy devuelve 502, 503 o 504) y
  `unexpected` (un error en un componente, capturado por `app.config.errorHandler`). Se queda el
  primer error, porque los siguientes suelen ser consecuencia suya.
- **Fichas a pantalla completa** (`ScreenCard.vue`): el login y la página de error comparten la
  misma ficha de línea fina con sombra sobre el mosaico tenue. El login distingue entre
  contraseña incorrecta y no poder contactar con Supabase.
- **Pantalla de carga**: la misma maqueta al 30 % de opacidad, palpitando (sin animación si el
  sistema pide reducir el movimiento). Lo ya conocido sale como texto; lo que depende de los datos,
  como cajas vacías, y las imágenes, como su recuadro cruzado en aspa. `AppSkeleton` cubre el
  arranque y `SkeletonCards` las tarjetas del mosaico mientras llegan las webs.

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
| 1b · Tests de la API | Vitest en el monorepo. Tests de la API y de `shared` | Hecha: tests y código de la fase 1 revisado (inglés, nombres, comentarios) |
| Mejoras del mosaico | Ventanas de información, usuaria en la cabecera, ordenación y orden propio arrastrando (PR #1) | Hecha (3-oct-2026) |
| Tema | Cambio entre tema claro y oscuro, colores en variables CSS (PR #2) | Hecha (12-oct-2026) |
| Arranque y errores | Arranque sin pantalla en blanco, pantalla de carga y página de error única (PR #3) | Hecha (14-oct-2026) |
| Login | Login con el mismo estilo que la página de error y errores claros (PR #4) | Hecha (14-oct-2026) |
| Despliegue gratuito | Publicar la app sin coste para usarla la usuaria y su compañera (ver «Despliegue») | **Siguiente** |
| Diseño | Diseño visual de la plataforma | Planificada |
| 2 · Captura | Captura automática con Playwright en un worker (rellena `preview_key` / `full_key` con `preview_source = 'screenshot'`); requiere un contenedor con Chromium | Planificada |
| 3 · Extensión | Extensión de navegador (WXT + Vue) usando la misma API | Planificada |
| 4 · Componentes | RF-F1: guardar componentes concretos (tabla `components` que apunta a `webs`) | Futuro |
| Idiomas | Selector de idioma en la interfaz: inglés (por defecto) y español | Futuro |
| Vista pública | Que otras personas puedan ver tu mosaico y tus colecciones con un enlace, sin cuenta | Futuro |

### Pendiente conocido

- **Colecciones**: si falla la carga de la lista, la página la muestra vacía en lugar del error.
- **Sesión caducada**: si la API responde 401 a mitad de uso, se ve su mensaje de error en lugar de
  volver al login.
- **Antes de arrancar**: si el JavaScript no llega a cargarse, la pantalla queda en blanco; la
  página de error forma parte de la app. Se puede cubrir con un mensaje de respaldo en
  `index.html` al publicar.

### Vista pública (futuro)

Idea aprobada para más adelante: que cualquiera con un enlace pueda ver el mosaico de la usuaria
y sus colecciones, en solo lectura y sin iniciar sesión. El alcance exacto está por decidir.

- **Qué se vería**: el mosaico y las colecciones con sus páginas. Por decidir si se muestran los
  enlaces a las webs originales, las notas y los tags.
- **Qué se comparte**: por decidir si es todo el mosaico o solo las colecciones que se marquen
  como públicas.
- **Requisito previo**: la app tiene que estar desplegada (ver «Despliegue»).
- **Cómo encajaría**: rutas públicas de solo lectura en la API, sin sesión, que solo devuelven lo
  marcado como público. El front nunca leería la base de datos directamente, igual que ahora.

### Idiomas (futuro)

- **Front**: `vue-i18n`, con un archivo de textos por idioma (`en`, `es`). El idioma elegido se
  recuerda en el navegador.
- **API**: los errores devolverían también un código (p. ej. `collection_name_taken`) además del
  mensaje, para que el front muestre el texto en el idioma elegido. Los mensajes de validación de
  Zod se traducirían igual en el front.
- El código sigue siempre en inglés; solo cambian los textos de pantalla.
- Mejor hacerlo **después de la fase de diseño**, cuando los textos de la interfaz sean estables.

### Tema claro / oscuro

- Los colores están en variables CSS al principio de `apps/web/src/style.css`
  (`--color-background`, `--color-text`, `--color-border`, `--color-muted`, `--color-error`), con
  un juego para cada tema. Cambiar de tema solo cambia qué juego se usa. `--font-mono` es la
  monoespaciada del sistema que usan los títulos de las fichas.
- Por defecto se sigue la preferencia del sistema; si la usuaria elige uno a mano, se recuerda en el
  navegador.
- En la **fase de diseño**, la paleta se define en las dos variantes sobre esas mismas variables.

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

## Despliegue

El despliegue se hace en dos etapas. El código es el mismo en las dos: solo cambian los proveedores
y las variables de entorno.

### Etapa 1 · Gratuita (ahora)

Para usarla la usuaria y su compañera y ver qué tal funciona. Coste: 0 €.

| Pieza | Dónde | Por qué |
|---|---|---|
| Front | Cloudflare Pages | Gratis para webs estáticas; sirve `apps/web/dist`. |
| API | Render, plan gratuito (servicio web Node) | Ejecuta Node tal cual, con `sharp`, y no pide tarjeta. |
| Login y base de datos | Un **segundo proyecto de Supabase**, solo para producción | El plan gratuito permite dos proyectos. Así los datos reales no se mezclan con los de desarrollo y las migraciones se prueban antes en desarrollo. |
| Imágenes | Supabase Storage del proyecto de producción, bucket público | Compatible con S3, así que la API usa el modo `STORAGE_DRIVER=s3` que ya existe. No hace falta otra cuenta ni tarjeta. |

Se descartó Cloudflare Workers para la API, aunque es gratis y Hono funciona ahí: `sharp` y la
descarga segura de páginas (`safe-fetch`) dependen de Node, y habría que reescribir esa parte.

**Peajes del plan gratuito**

- **Render duerme la API** tras unos 15 minutos sin peticiones. La primera petición después tarda
  unos 30–60 s en despertarla; mientras, se ve la pantalla de carga.
- **Supabase pausa el proyecto** tras unos 7 días sin uso. Con uso habitual no pasa.
- **Límites aproximados** (se comprueban al desplegar, porque cambian): Supabase da 500 MB de base
  de datos, 1 GB de archivos y 5 GB de descarga al mes; Render, 512 MB de memoria.
- **Sin copias de seguridad automáticas** de la base de datos.
- **La fase 2 (captura) no cabe**: Chromium necesita más memoria de la que da Render gratis.

**Pasos**

1. Arreglar antes los pendientes que afectan a otra persona: la sesión caducada (401) y el error de
   carga de colecciones. Añadir el mensaje de respaldo en `index.html`.
2. Crear el proyecto de Supabase de producción, aplicar las migraciones (`pnpm db:migrate` con su
   `DATABASE_URL`) y crear a mano las dos cuentas.
3. Crear el bucket público de Supabase Storage y sus claves S3. El cliente S3 de la API necesita
   `forcePathStyle: true`, que Supabase exige y R2 también acepta.
4. Crear el servicio en Render: instala con `pnpm install --frozen-lockfile` y arranca con
   `pnpm --filter @webs/api start`. La `DATABASE_URL` es la del pooler de Supabase (en modo
   transacción; el cliente ya usa `prepare: false`), porque la conexión directa solo es IPv6.
5. Publicar el front en Cloudflare Pages con `VITE_API_URL` apuntando a la API y `CORS_ORIGIN` en
   la API apuntando al front. La SPA tiene que servir `index.html` en todas las rutas.
6. Probarlo de punta a punta con las dos cuentas.

### Etapa 2 · Profesional (futuro)

Cuando haya que abrirla a más gente. Se da el salto con cualquiera de estas señales:

- entra gente de fuera, o se activa la vista pública;
- el arranque lento de Render molesta;
- se empieza la fase 2 (captura), que necesita un contenedor con Chromium;
- los datos ya importan lo suficiente como para necesitar copias de seguridad.

| Pieza | Dónde | Coste aproximado |
|---|---|---|
| Front | Cloudflare Pages, con dominio propio | Gratis |
| API | Render de pago (no se duerme) o Railway | ~7 $/mes |
| Worker de captura (fase 2) | Servicio aparte con Chromium y ~1–2 GB de memoria | ~7–25 $/mes |
| Login y base de datos | Supabase Pro: sin pausas, copias de seguridad diarias y más espacio | 25 $/mes |
| Imágenes | Cloudflare R2: 10 GB gratis y sin coste por descarga, que es lo que más crece con más gente | Gratis al principio |
| Dominio | Uno propio, p. ej. `begiz.app` (`api.` para la API, `files.` para las imágenes) | ~10–15 €/año |

En total, unos 32 $/mes sin la captura. Se puede subir por partes: lo primero suele ser la API de
pago (~7 $/mes) para quitar el arranque lento, manteniendo Supabase gratuito.

**Qué cambia al pasar**

- **Imágenes a R2**: copiar los archivos del bucket (por ejemplo con `rclone`) y cambiar las
  variables `S3_*` y `FILES_PUBLIC_URL`. La base de datos guarda la clave de cada imagen, no su URL,
  así que no hay que tocarla.
- **Supabase Pro**: se sube de plan el mismo proyecto, sin migrar nada.
- **Altas de cuentas**: con más gente, crearlas a mano no escala. Decisión de producto pendiente:
  invitaciones desde Supabase o registro abierto.
- **Vigilancia**: aviso si la API cae (un comprobador de disponibilidad gratuito) y registro de
  errores del front y la API (p. ej. Sentry, que tiene plan gratuito).
