import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { requireAuth, type AuthEnv } from './auth.ts'
import { env } from './env.ts'
import { collectionsRoutes } from './routes/collections.ts'
import { tagsRoutes } from './routes/tags.ts'
import { websRoutes } from './routes/webs.ts'
import { localStorageRoot } from './storage/index.ts'

const api = new Hono<AuthEnv>()
  .use(requireAuth)
  .use(bodyLimit({ maxSize: 25 * 1024 * 1024 }))
  .route('/webs', websRoutes)
  .route('/collections', collectionsRoutes)
  .route('/tags', tagsRoutes)

/** Used by the front (Hono's hc client) to get typed routes. */
export type AppType = typeof api

export const app = new Hono()

app.use(logger())
if (env.CORS_ORIGIN) {
  app.use('/api/*', cors({ origin: env.CORS_ORIGIN.split(','), maxAge: 86400 }))
}

app.get('/health', (context) => context.json({ ok: true }))
app.route('/api', api)

if (env.STORAGE_DRIVER === 'local') {
  app.use(
    '/files/*',
    serveStatic({ root: localStorageRoot, rewriteRequestPath: (path) => path.replace(/^\/files/, '') }),
  )
}

app.onError((error, context) => {
  if (error instanceof HTTPException) return context.json({ message: error.message }, error.status)
  console.error(error)
  return context.json({ message: 'Internal server error' }, 500)
})
