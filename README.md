# Begiz

Guarda webs de inspiración con su imagen, notas, tags y colecciones. Arquitectura en [ARCHITECTURE.md](ARCHITECTURE.md).

## Puesta en marcha (local)

Requisitos: Node 24 y pnpm. No hace falta Docker.

### 1. Proyecto de Supabase (una sola vez)

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratuito).
2. **Authentication → Sign In / Providers**: desactiva *Allow new users to sign up*.
3. **Authentication → Users → Add user**: crea tu usuaria con email y contraseña (marca *Auto Confirm User*).

### 2. Variables de entorno

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Rellena ambos archivos con los datos de **Project Settings** de Supabase (cada variable indica de dónde sale).

### 3. Instalar, crear tablas y arrancar

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

Abre http://localhost:5173. La API corre en http://localhost:8787.

## Comandos

| Comando | |
|---|---|
| `pnpm dev` | Front y API en modo desarrollo |
| `pnpm typecheck` | Comprobación de tipos de todo el monorepo |
| `pnpm build` | Build del front |
| `pnpm db:generate` | Genera una migración tras cambiar `apps/api/src/db/schema.ts` |
| `pnpm db:migrate` | Aplica las migraciones pendientes |
