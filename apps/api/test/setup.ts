import { sql } from 'drizzle-orm'
import { beforeEach, vi } from 'vitest'
import { db } from '../src/db/client.ts'
import { fakeInternet } from './fake-web.ts'

// The API runs against PGlite: a real Postgres in memory, built from the same migrations.
vi.mock('../src/db/client.ts', async () => {
  const { PGlite } = await import('@electric-sql/pglite')
  const { pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm')
  const { drizzle } = await import('drizzle-orm/pglite')
  const { migrate } = await import('drizzle-orm/pglite/migrator')
  const schema = await import('../src/db/schema.ts')

  const client = new PGlite({ extensions: { pg_trgm } })
  const testDb = drizzle(client, { schema })
  await migrate(testDb, { migrationsFolder: new URL('../drizzle', import.meta.url).pathname })
  return { db: testDb }
})

// Tests never reach real websites. safe-fetch.test.ts loads the real module to test the SSRF guard.
vi.mock('../src/lib/safe-fetch.ts', async () => ({
  safeFetch: (await import('./fake-web.ts')).fakeSafeFetch,
}))

beforeEach(async () => {
  fakeInternet.clear()
  await db.execute(sql`truncate webs, tags, collections cascade`)
})
