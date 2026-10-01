import { and, count, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { collectionCreate, collectionUpdate, idParam } from '@webs/shared'
import type { AuthEnv } from '../auth.ts'
import { db } from '../db/client.ts'
import { collections, collectionWebs } from '../db/schema.ts'
import { validate } from '../lib/validate.ts'

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

function toCollectionResponse(collection: typeof collections.$inferSelect, webCount = 0) {
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    webCount,
  }
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
    return context.json(rows.map((row) => toCollectionResponse(row.collection, row.webCount)))
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
