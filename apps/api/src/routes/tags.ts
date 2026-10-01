import { count, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AuthEnv } from '../auth.ts'
import { db } from '../db/client.ts'
import { tags, webTags } from '../db/schema.ts'

export const tagsRoutes = new Hono<AuthEnv>().get('/', async (context) => {
  // Sorted by usage: they feed the mosaic filter and the autocomplete.
  const rows = await db
    .select({ name: tags.name, webCount: count(webTags.webId) })
    .from(tags)
    .innerJoin(webTags, eq(webTags.tagId, tags.id))
    .where(eq(tags.userId, context.get('userId')))
    .groupBy(tags.id)
    .orderBy(desc(count(webTags.webId)), tags.name)
  return context.json(rows)
})
