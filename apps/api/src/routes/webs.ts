import { randomUUID } from 'node:crypto'
import { and, desc, eq, ilike, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { idParam, normalizeTag, webCreate, webListQuery, webUpdate } from '@webs/shared'
import type { AuthEnv } from '../auth.ts'
import { db, type Tx } from '../db/client.ts'
import { collections, collectionWebs, tags, webs, webTags } from '../db/schema.ts'
import { downloadImage, fetchPageMeta, inspectUpload, makeThumb, type PageMeta } from '../lib/preview.ts'
import { validate } from '../lib/validate.ts'
import { deleteQuietly, fileUrl, storage } from '../storage/index.ts'

type WebRow = typeof webs.$inferSelect

function toCard(web: WebRow, tagNames: string[]) {
  return {
    id: web.id,
    url: web.url,
    title: web.title,
    siteTitle: web.siteTitle,
    faviconUrl: web.faviconUrl,
    previewUrl: fileUrl(web.previewKey),
    tags: tagNames,
    createdAt: web.createdAt.toISOString(),
  }
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&')

async function tagsByWeb(webIds: string[]) {
  const map = new Map<string, string[]>()
  if (webIds.length === 0) return map
  const rows = await db
    .select({ webId: webTags.webId, name: tags.name })
    .from(webTags)
    .innerJoin(tags, eq(tags.id, webTags.tagId))
    .where(inArray(webTags.webId, webIds))
    .orderBy(tags.name)
  for (const row of rows) map.set(row.webId, [...(map.get(row.webId) ?? []), row.name])
  return map
}

async function findOwnedWeb(userId: string, id: string) {
  const [web] = await db
    .select()
    .from(webs)
    .where(and(eq(webs.id, id), eq(webs.userId, userId)))
  if (!web) throw new HTTPException(404, { message: 'Web no encontrada' })
  return web
}

async function getDetail(userId: string, id: string) {
  const web = await findOwnedWeb(userId, id)
  const [tagMap, memberships] = await Promise.all([
    tagsByWeb([id]),
    db
      .select({ id: collectionWebs.collectionId })
      .from(collectionWebs)
      .where(eq(collectionWebs.webId, id)),
  ])
  return {
    ...toCard(web, tagMap.get(id) ?? []),
    notes: web.notes,
    previewSource: web.previewSource,
    fullUrl: fileUrl(web.fullKey),
    collectionIds: memberships.map((m) => m.id),
  }
}

/** Sustituye los tags de una web, creando los que no existan y borrando los que queden sin uso. */
async function setTags(tx: Tx, userId: string, webId: string, names: string[]) {
  await tx.delete(webTags).where(eq(webTags.webId, webId))
  if (names.length > 0) {
    await tx
      .insert(tags)
      .values(names.map((name) => ({ userId, name })))
      .onConflictDoNothing()
    const rows = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.name, names)))
    await tx.insert(webTags).values(rows.map((tag) => ({ webId, tagId: tag.id })))
  }
  await deleteUnusedTags(tx, userId)
}

async function deleteUnusedTags(tx: Tx, userId: string) {
  await tx
    .delete(tags)
    .where(
      and(
        eq(tags.userId, userId),
        sql`not exists (select 1 from ${webTags} where ${webTags.tagId} = ${tags.id})`,
      ),
    )
}

async function setCollections(tx: Tx, userId: string, webId: string, ids: string[]) {
  if (ids.length > 0) {
    const owned = await tx
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.userId, userId), inArray(collections.id, ids)))
    if (owned.length !== ids.length) throw new HTTPException(400, { message: 'Colección no encontrada' })
  }
  await tx.delete(collectionWebs).where(eq(collectionWebs.webId, webId))
  if (ids.length > 0) {
    await tx.insert(collectionWebs).values(ids.map((collectionId) => ({ collectionId, webId })))
  }
}

/** Descarga la og:image y la guarda como miniatura. Si algo falla, la web se queda sin imagen. */
async function storePageImage(userId: string, webId: string, meta: PageMeta | null) {
  if (!meta?.imageUrl) return null
  try {
    const thumb = await makeThumb(await downloadImage(meta.imageUrl))
    const key = `${userId}/${webId}/${randomUUID()}.webp`
    await storage.put(key, thumb, 'image/webp')
    return key
  } catch (err) {
    console.warn(`No se pudo guardar la og:image de ${meta.imageUrl}: ${err}`)
    return null
  }
}

export const websRoutes = new Hono<AuthEnv>()
  .get('/', validate('query', webListQuery), async (c) => {
    const userId = c.get('userId')
    const { q, tags: tagParam, collection } = c.req.valid('query')
    const tagNames = [...new Set((tagParam ?? '').split(',').map(normalizeTag).filter(Boolean))]

    const conditions = [eq(webs.userId, userId)]
    if (q) conditions.push(ilike(webs.title, `%${escapeLike(q)}%`))
    if (collection) {
      conditions.push(
        inArray(
          webs.id,
          db
            .select({ id: collectionWebs.webId })
            .from(collectionWebs)
            .where(eq(collectionWebs.collectionId, collection)),
        ),
      )
    }
    if (tagNames.length > 0) {
      // Webs que tienen TODOS los tags seleccionados.
      conditions.push(
        inArray(
          webs.id,
          db
            .select({ id: webTags.webId })
            .from(webTags)
            .innerJoin(tags, eq(tags.id, webTags.tagId))
            .where(and(eq(tags.userId, userId), inArray(tags.name, tagNames)))
            .groupBy(webTags.webId)
            .having(sql`count(*) = ${tagNames.length}`),
        ),
      )
    }

    const rows = await db
      .select()
      .from(webs)
      .where(and(...conditions))
      .orderBy(desc(webs.createdAt))
    const tagMap = await tagsByWeb(rows.map((web) => web.id))
    return c.json(rows.map((web) => toCard(web, tagMap.get(web.id) ?? [])))
  })

  .get('/:id', validate('param', idParam), async (c) => {
    return c.json(await getDetail(c.get('userId'), c.req.valid('param').id))
  })

  .post('/', validate('json', webCreate), async (c) => {
    const userId = c.get('userId')
    const input = c.req.valid('json')
    const id = randomUUID()

    const meta = await fetchPageMeta(input.url).catch((err) => {
      console.warn(`No se pudieron leer los metadatos de ${input.url}: ${err}`)
      return null
    })
    const previewKey = input.usePageImage ? await storePageImage(userId, id, meta) : null

    try {
      await db.transaction(async (tx) => {
        await tx.insert(webs).values({
          id,
          userId,
          url: input.url,
          title: input.title,
          notes: input.notes,
          siteTitle: meta?.siteTitle ?? null,
          faviconUrl: meta?.faviconUrl ?? null,
          previewKey,
          previewSource: previewKey ? 'og' : null,
        })
        await setTags(tx, userId, id, input.tags)
        await setCollections(tx, userId, id, input.collectionIds)
      })
    } catch (err) {
      await deleteQuietly(previewKey)
      throw err
    }
    return c.json(await getDetail(userId, id), 201)
  })

  .patch('/:id', validate('param', idParam), validate('json', webUpdate), async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const { tags: tagNames, collectionIds, ...fields } = c.req.valid('json')
    await findOwnedWeb(userId, id)

    await db.transaction(async (tx) => {
      await tx
        .update(webs)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(webs.id, id))
      if (tagNames) await setTags(tx, userId, id, tagNames)
      if (collectionIds) await setCollections(tx, userId, id, collectionIds)
    })
    return c.json(await getDetail(userId, id))
  })

  .put(
    '/:id/preview',
    validate('param', idParam),
    validate('form', z.object({ image: z.instanceof(File) })),
    async (c) => {
      const userId = c.get('userId')
      const { id } = c.req.valid('param')
      const web = await findOwnedWeb(userId, id)

      const original = Buffer.from(await c.req.valid('form').image.arrayBuffer())
      const format = await inspectUpload(original)
      const thumb = await makeThumb(original)

      const base = `${userId}/${id}/${randomUUID()}`
      const previewKey = `${base}.webp`
      const fullKey = `${base}-full.${format.ext}`
      await storage.put(previewKey, thumb, 'image/webp')
      await storage.put(fullKey, original, format.type)

      await db
        .update(webs)
        .set({ previewKey, fullKey, previewSource: 'manual', updatedAt: new Date() })
        .where(eq(webs.id, id))
      await deleteQuietly(web.previewKey, web.fullKey)
      return c.json(await getDetail(userId, id))
    },
  )

  .delete('/:id', validate('param', idParam), async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const web = await findOwnedWeb(userId, id)
    await db.transaction(async (tx) => {
      await tx.delete(webs).where(eq(webs.id, id))
      await deleteUnusedTags(tx, userId)
    })
    await deleteQuietly(web.previewKey, web.fullKey)
    return c.body(null, 204)
  })
