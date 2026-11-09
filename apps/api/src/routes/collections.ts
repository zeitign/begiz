import { and, count, eq, inArray, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { collectionCreate, collectionUpdate, idParam } from '@webs/shared'
import type { AuthEnv } from '../auth.ts'
import { db } from '../db/client.ts'
import { collections, collectionWebs, webs } from '../db/schema.ts'
import { validate } from '../lib/validate.ts'
import { webOrderBy } from '../lib/web-order.ts'
import { fileUrl } from '../storage/index.ts'

/** How many webs a collection shows on its cover, the first ones in the custom order. */
const COVER_WEB_LIMIT = 4

type CoverWeb = { id: string; url: string; previewUrl: string | null; faviconUrl: string | null }

async function assertNameFree(userId: string, name: string, exceptCollectionId?: string) {
  const conditions = [eq(collections.userId, userId), eq(collections.name, name)]
  if (exceptCollectionId) conditions.push(ne(collections.id, exceptCollectionId))
  const [existingCollection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(...conditions))
  if (existingCollection) {
    throw new HTTPException(409, { message: `A collection named "${name}" already exists` })
  }
}

function toCollectionResponse(
  collection: typeof collections.$inferSelect,
  webCount = 0,
  coverWebs: CoverWeb[] = [],
) {
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    webCount,
    coverWebs,
  }
}

async function findCoverWebsByCollectionId(collectionIds: string[]) {
  const coverWebsByCollectionId = new Map<string, CoverWeb[]>()
  if (collectionIds.length === 0) return coverWebsByCollectionId
  const rows = await db
    .select({ collectionId: collectionWebs.collectionId, web: webs })
    .from(collectionWebs)
    .innerJoin(webs, eq(webs.id, collectionWebs.webId))
    .where(inArray(collectionWebs.collectionId, collectionIds))
    .orderBy(...webOrderBy('custom'))
  for (const { collectionId, web } of rows) {
    const coverWebs = coverWebsByCollectionId.get(collectionId) ?? []
    if (coverWebs.length === COVER_WEB_LIMIT) continue
    coverWebs.push({ id: web.id, url: web.url, previewUrl: fileUrl(web.previewKey), faviconUrl: web.faviconUrl })
    coverWebsByCollectionId.set(collectionId, coverWebs)
  }
  return coverWebsByCollectionId
}

export const collectionsRoutes = new Hono<AuthEnv>()
  .get('/', async (context) => {
    const rows = await db
      .select({ collection: collections, webCount: count(collectionWebs.webId) })
      .from(collections)
      .leftJoin(collectionWebs, eq(collectionWebs.collectionId, collections.id))
      .where(eq(collections.userId, context.get('userId')))
      .groupBy(collections.id)
      .orderBy(collections.name)
    const coverWebsByCollectionId = await findCoverWebsByCollectionId(rows.map((row) => row.collection.id))
    return context.json(
      rows.map((row) =>
        toCollectionResponse(row.collection, row.webCount, coverWebsByCollectionId.get(row.collection.id)),
      ),
    )
  })

  .post('/', validate('json', collectionCreate), async (context) => {
    const userId = context.get('userId')
    const input = context.req.valid('json')
    await assertNameFree(userId, input.name)
    const [createdCollection] = await db
      .insert(collections)
      .values({ userId, name: input.name, description: input.description || null })
      .returning()
    return context.json(toCollectionResponse(createdCollection!), 201)
  })

  .patch('/:id', validate('param', idParam), validate('json', collectionUpdate), async (context) => {
    const userId = context.get('userId')
    const { id } = context.req.valid('param')
    const input = context.req.valid('json')
    if (input.name) await assertNameFree(userId, input.name, id)
    const [updatedCollection] = await db
      .update(collections)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description || null }),
      })
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .returning()
    if (!updatedCollection) throw new HTTPException(404, { message: 'Collection not found' })
    return context.json(toCollectionResponse(updatedCollection))
  })

  .delete('/:id', validate('param', idParam), async (context) => {
    const { id } = context.req.valid('param')
    const deletedCollections = await db
      .delete(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, context.get('userId'))))
      .returning({ id: collections.id })
    if (deletedCollections.length === 0) throw new HTTPException(404, { message: 'Collection not found' })
    return context.body(null, 204)
  })
