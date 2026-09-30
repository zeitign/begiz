import { count, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AuthEnv } from '../auth.ts'
import { db } from '../db/client.ts'
import { tags, webTags } from '../db/schema.ts'

export const tagsRoutes = new Hono<AuthEnv>().get('/', async (c) => {
  // Ordenados por uso: sirven para el filtro del mosaico y para autocompletar.
  const rows = await db
    .select({ name: tags.name, webCount: count(webTags.webId) })
    .from(tags)
    .innerJoin(webTags, eq(webTags.tagId, tags.id))
    .where(eq(tags.userId, c.get('userId')))
    .groupBy(tags.id)
    .orderBy(desc(count(webTags.webId)), tags.name)
  return c.json(rows)
})
