import { randomUUID } from 'node:crypto'
import { and, eq, ilike, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { idParam, normalizeTag, webCreate, webListQuery, webPositionUpdate, webUpdate } from '@webs/shared'
import type { AuthEnv } from '../auth.ts'
import { db, type Transaction } from '../db/client.ts'
import { collections, collectionWebs, tags, webs, webTags } from '../db/schema.ts'
import {
  createThumbnail,
  detectUploadFormat,
  downloadImage,
  fetchPageMeta,
  type PageMeta,
} from '../lib/preview.ts'
import { validate } from '../lib/validate.ts'
import { moveWebAfter, positionBeforeAllWebs, webOrderBy } from '../lib/web-order.ts'
import { deleteQuietly, fileUrl, storage } from '../storage/index.ts'

type WebRow = typeof webs.$inferSelect

function toWebCard(web: WebRow, tagNames: string[]) {
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

const escapeLikePattern = (text: string) => text.replace(/[\\%_]/g, '\\$&')

async function findTagNamesByWebId(webIds: string[]) {
  const tagNamesByWebId = new Map<string, string[]>()
  if (webIds.length === 0) return tagNamesByWebId
  const rows = await db
    .select({ webId: webTags.webId, name: tags.name })
    .from(webTags)
    .innerJoin(tags, eq(tags.id, webTags.tagId))
    .where(inArray(webTags.webId, webIds))
    .orderBy(tags.name)
  for (const row of rows) {
    tagNamesByWebId.set(row.webId, [...(tagNamesByWebId.get(row.webId) ?? []), row.name])
  }
  return tagNamesByWebId
}

async function findOwnedWeb(userId: string, webId: string) {
  const [web] = await db
    .select()
    .from(webs)
    .where(and(eq(webs.id, webId), eq(webs.userId, userId)))
  if (!web) throw new HTTPException(404, { message: 'Web not found' })
  return web
}

async function getWebDetail(userId: string, webId: string) {
  const web = await findOwnedWeb(userId, webId)
  const [tagNamesByWebId, memberships] = await Promise.all([
    findTagNamesByWebId([webId]),
    db
      .select({ collectionId: collectionWebs.collectionId })
      .from(collectionWebs)
      .where(eq(collectionWebs.webId, webId)),
  ])
  return {
    ...toWebCard(web, tagNamesByWebId.get(webId) ?? []),
    notes: web.notes,
    previewSource: web.previewSource,
    fullUrl: fileUrl(web.fullKey),
    collectionIds: memberships.map((membership) => membership.collectionId),
  }
}

/** Replaces the tags of a web, creating the missing ones and deleting those left unused. */
async function replaceTags(transaction: Transaction, userId: string, webId: string, tagNames: string[]) {
  await transaction.delete(webTags).where(eq(webTags.webId, webId))
  if (tagNames.length > 0) {
    await transaction
      .insert(tags)
      .values(tagNames.map((name) => ({ userId, name })))
      .onConflictDoNothing()
    const userTags = await transaction
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.name, tagNames)))
    await transaction.insert(webTags).values(userTags.map((tag) => ({ webId, tagId: tag.id })))
  }
  await deleteUnusedTags(transaction, userId)
}

async function deleteUnusedTags(transaction: Transaction, userId: string) {
  await transaction
    .delete(tags)
    .where(
      and(
        eq(tags.userId, userId),
        sql`not exists (select 1 from ${webTags} where ${webTags.tagId} = ${tags.id})`,
      ),
    )
}

async function replaceCollections(transaction: Transaction, userId: string, webId: string, collectionIds: string[]) {
  if (collectionIds.length > 0) {
    const ownedCollections = await transaction
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.userId, userId), inArray(collections.id, collectionIds)))
    if (ownedCollections.length !== collectionIds.length) {
      throw new HTTPException(400, { message: 'Collection not found' })
    }
  }
  await transaction.delete(collectionWebs).where(eq(collectionWebs.webId, webId))
  if (collectionIds.length > 0) {
    await transaction.insert(collectionWebs).values(collectionIds.map((collectionId) => ({ collectionId, webId })))
  }
}

/** Downloads the og:image and stores it as the thumbnail. On failure the web just has no image. */
async function storePageImage(userId: string, webId: string, pageMeta: PageMeta | null) {
  if (!pageMeta?.imageUrl) return null
  try {
    const thumbnail = await createThumbnail(await downloadImage(pageMeta.imageUrl))
    const previewKey = `${userId}/${webId}/${randomUUID()}.webp`
    await storage.put(previewKey, thumbnail, 'image/webp')
    return previewKey
  } catch (error) {
    console.warn(`Could not store the og:image of ${pageMeta.imageUrl}: ${error}`)
    return null
  }
}

export const websRoutes = new Hono<AuthEnv>()
  .get('/', validate('query', webListQuery), async (context) => {
    const userId = context.get('userId')
    const { search, tags: tagsParam, collection: collectionId, sort, direction } = context.req.valid('query')
    const tagNames = [...new Set((tagsParam ?? '').split(',').map(normalizeTag).filter(Boolean))]

    const conditions = [eq(webs.userId, userId)]
    if (search) conditions.push(ilike(webs.title, `%${escapeLikePattern(search)}%`))
    if (collectionId) {
      conditions.push(
        inArray(
          webs.id,
          db
            .select({ webId: collectionWebs.webId })
            .from(collectionWebs)
            .where(eq(collectionWebs.collectionId, collectionId)),
        ),
      )
    }
    if (tagNames.length > 0) {
      // Webs that have ALL the selected tags.
      conditions.push(
        inArray(
          webs.id,
          db
            .select({ webId: webTags.webId })
            .from(webTags)
            .innerJoin(tags, eq(tags.id, webTags.tagId))
            .where(and(eq(tags.userId, userId), inArray(tags.name, tagNames)))
            .groupBy(webTags.webId)
            .having(sql`count(*) = ${tagNames.length}`),
        ),
      )
    }

    const matchingWebs = await db
      .select()
      .from(webs)
      .where(and(...conditions))
      .orderBy(...webOrderBy(sort, direction))
    const tagNamesByWebId = await findTagNamesByWebId(matchingWebs.map((web) => web.id))
    return context.json(matchingWebs.map((web) => toWebCard(web, tagNamesByWebId.get(web.id) ?? [])))
  })

  .get('/:id', validate('param', idParam), async (context) => {
    return context.json(await getWebDetail(context.get('userId'), context.req.valid('param').id))
  })

  .post('/', validate('json', webCreate), async (context) => {
    const userId = context.get('userId')
    const input = context.req.valid('json')
    const webId = randomUUID()

    const pageMeta = await fetchPageMeta(input.url).catch((error) => {
      console.warn(`Could not read the metadata of ${input.url}: ${error}`)
      return null
    })
    const previewKey = input.usePageImage ? await storePageImage(userId, webId, pageMeta) : null

    try {
      await db.transaction(async (transaction) => {
        await transaction.insert(webs).values({
          id: webId,
          userId,
          url: input.url,
          title: input.title,
          notes: input.notes,
          siteTitle: pageMeta?.siteTitle ?? null,
          faviconUrl: pageMeta?.faviconUrl ?? null,
          previewKey,
          previewSource: previewKey ? 'og' : null,
          sortPosition: await positionBeforeAllWebs(transaction, userId),
        })
        await replaceTags(transaction, userId, webId, input.tags)
        await replaceCollections(transaction, userId, webId, input.collectionIds)
      })
    } catch (error) {
      await deleteQuietly(previewKey)
      throw error
    }
    return context.json(await getWebDetail(userId, webId), 201)
  })

  .patch('/:id', validate('param', idParam), validate('json', webUpdate), async (context) => {
    const userId = context.get('userId')
    const { id: webId } = context.req.valid('param')
    const { tags: tagNames, collectionIds, ...fields } = context.req.valid('json')
    await findOwnedWeb(userId, webId)

    await db.transaction(async (transaction) => {
      await transaction
        .update(webs)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(webs.id, webId))
      if (tagNames) await replaceTags(transaction, userId, webId, tagNames)
      if (collectionIds) await replaceCollections(transaction, userId, webId, collectionIds)
    })
    return context.json(await getWebDetail(userId, webId))
  })

  .put('/:id/position', validate('param', idParam), validate('json', webPositionUpdate), async (context) => {
    const userId = context.get('userId')
    const { id: webId } = context.req.valid('param')
    const { afterWebId } = context.req.valid('json')
    await findOwnedWeb(userId, webId)
    await db.transaction((transaction) => moveWebAfter(transaction, userId, webId, afterWebId))
    return context.body(null, 204)
  })

  .put(
    '/:id/preview',
    validate('param', idParam),
    validate('form', z.object({ image: z.instanceof(File) })),
    async (context) => {
      const userId = context.get('userId')
      const { id: webId } = context.req.valid('param')
      const web = await findOwnedWeb(userId, webId)

      const originalImage = Buffer.from(await context.req.valid('form').image.arrayBuffer())
      const uploadFormat = await detectUploadFormat(originalImage)
      const thumbnail = await createThumbnail(originalImage)

      const keyPrefix = `${userId}/${webId}/${randomUUID()}`
      const previewKey = `${keyPrefix}.webp`
      const fullKey = `${keyPrefix}-full.${uploadFormat.extension}`
      await storage.put(previewKey, thumbnail, 'image/webp')
      await storage.put(fullKey, originalImage, uploadFormat.mimeType)

      await db
        .update(webs)
        .set({ previewKey, fullKey, previewSource: 'manual', updatedAt: new Date() })
        .where(eq(webs.id, webId))
      await deleteQuietly(web.previewKey, web.fullKey)
      return context.json(await getWebDetail(userId, webId))
    },
  )

  .delete('/:id', validate('param', idParam), async (context) => {
    const userId = context.get('userId')
    const { id: webId } = context.req.valid('param')
    const web = await findOwnedWeb(userId, webId)
    await db.transaction(async (transaction) => {
      await transaction.delete(webs).where(eq(webs.id, webId))
      await deleteUnusedTags(transaction, userId)
    })
    await deleteQuietly(web.previewKey, web.fullKey)
    return context.body(null, 204)
  })
