import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { z } from 'zod'
import { requireAuth, type AuthEnv } from './auth.ts'
import { env } from './env.ts'
import { collectionsRoutes } from './routes/collections.ts'
import { tagsRoutes } from './routes/tags.ts'
import { websRoutes } from './routes/webs.ts'
import { localStorageRoot } from './storage/index.ts'

z.config(z.locales.es())

const api = new Hono<AuthEnv>()
  .use(requireAuth)
  .use(bodyLimit({ maxSize: 25 * 1024 * 1024 }))
  .route('/webs', websRoutes)
  .route('/collections', collectionsRoutes)
  .route('/tags', tagsRoutes)

/** Tipo que usa el front (cliente hc de Hono) para tener las rutas tipadas. */
export type AppType = typeof api

export const app = new Hono()

app.use(logger())
if (env.CORS_ORIGIN) {
  app.use('/api/*', cors({ origin: env.CORS_ORIGIN.split(','), maxAge: 86400 }))
}

app.get('/health', (c) => c.json({ ok: true }))
app.route('/api', api)

if (env.STORAGE_DRIVER === 'local') {
  app.use(
    '/files/*',
    serveStatic({ root: localStorageRoot, rewriteRequestPath: (path) => path.replace(/^\/files/, '') }),
  )
}

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ message: err.message }, err.status)
  console.error(err)
  return c.json({ message: 'Error interno del servidor' }, 500)
})
