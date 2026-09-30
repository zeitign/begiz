import { and, count, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { collectionCreate, collectionUpdate, idParam } from '@webs/shared'
import type { AuthEnv } from '../auth.ts'
import { db } from '../db/client.ts'
import { collections, collectionWebs } from '../db/schema.ts'
import { validate } from '../lib/validate.ts'

async function assertNameFree(userId: string, name: string, exceptId?: string) {
  const conditions = [eq(collections.userId, userId), eq(collections.name, name)]
  if (exceptId) conditions.push(ne(collections.id, exceptId))
  const [existing] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(...conditions))
  if (existing) throw new HTTPException(409, { message: `Ya existe una colección llamada "${name}"` })
}

function toDto(row: typeof collections.$inferSelect, webCount = 0) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    webCount,
  }
}

export const collectionsRoutes = new Hono<AuthEnv>()
  .get('/', async (c) => {
    const rows = await db
      .select({ collection: collections, webCount: count(collectionWebs.webId) })
      .from(collections)
      .leftJoin(collectionWebs, eq(collectionWebs.collectionId, collections.id))
      .where(eq(collections.userId, c.get('userId')))
      .groupBy(collections.id)
      .orderBy(collections.name)
    return c.json(rows.map((row) => toDto(row.collection, row.webCount)))
  })

  .post('/', validate('json', collectionCreate), async (c) => {
    const userId = c.get('userId')
    const input = c.req.valid('json')
    await assertNameFree(userId, input.name)
    const [row] = await db
      .insert(collections)
      .values({ userId, name: input.name, description: input.description || null })
      .returning()
    return c.json(toDto(row!), 201)
  })

  .patch('/:id', validate('param', idParam), validate('json', collectionUpdate), async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const input = c.req.valid('json')
    if (input.name) await assertNameFree(userId, input.name, id)
    const [row] = await db
      .update(collections)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description || null }),
      })
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .returning()
    if (!row) throw new HTTPException(404, { message: 'Colección no encontrada' })
    return c.json(toDto(row))
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param')
    const deleted = await db
      .delete(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, c.get('userId'))))
      .returning({ id: collections.id })
    if (deleted.length === 0) throw new HTTPException(404, { message: 'Colección no encontrada' })
    return c.body(null, 204)
  })
