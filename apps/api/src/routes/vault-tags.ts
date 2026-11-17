import { count, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AuthEnv } from '../auth.ts'
import { db } from '../db/client.ts'
import { vaultLinkTags, vaultTags } from '../db/schema.ts'

export const vaultTagsRoutes = new Hono<AuthEnv>().get('/', async (context) => {
  // Sorted by usage, like the mosaic tags: they feed the autocomplete.
  const rows = await db
    .select({ name: vaultTags.name, linkCount: count(vaultLinkTags.linkId) })
    .from(vaultTags)
    .innerJoin(vaultLinkTags, eq(vaultLinkTags.tagId, vaultTags.id))
    .where(eq(vaultTags.userId, context.get('userId')))
    .groupBy(vaultTags.id)
    .orderBy(desc(count(vaultLinkTags.linkId)), vaultTags.name)
  return context.json(rows)
})
