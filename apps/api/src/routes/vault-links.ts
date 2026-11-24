import { and, eq, ilike, inArray, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import {
  idParam,
  vaultLinkCreate,
  vaultLinkListQuery,
  vaultLinkMove,
  vaultLinkPositionUpdate,
  vaultLinkUpdate,
} from '@webs/shared'
import type { AuthEnv } from '../auth.ts'
import { db } from '../db/client.ts'
import { vaultLinks } from '../db/schema.ts'
import { escapeLikePattern } from '../lib/escape-like-pattern.ts'
import { fetchPageMeta } from '../lib/preview.ts'
import { validate } from '../lib/validate.ts'
import { moveAfter, positionAfterAll } from '../lib/sort-positions.ts'
import {
  assertLinkFolder,
  deleteUnusedVaultTags,
  findVaultTagNamesByLinkId,
  folderLinks,
  replaceVaultTags,
} from '../lib/vault.ts'

function toLinkResponse(link: typeof vaultLinks.$inferSelect, tagNames: string[]) {
  return {
    id: link.id,
    url: link.url,
    title: link.title,
    folderId: link.folderId,
    faviconUrl: link.faviconUrl,
    sortPosition: link.sortPosition,
    tags: tagNames,
    createdAt: link.createdAt.toISOString(),
  }
}

/** The favicon of the page, or null when it cannot be read: the link is saved anyway. */
async function readFaviconUrl(pageUrl: string) {
  try {
    return (await fetchPageMeta(pageUrl)).faviconUrl
  } catch (error) {
    console.warn(`Could not read the favicon of ${pageUrl}: ${error}`)
    return null
  }
}

async function getLinkDetail(userId: string, linkId: string) {
  const [link] = await db
    .select()
    .from(vaultLinks)
    .where(and(eq(vaultLinks.id, linkId), eq(vaultLinks.userId, userId)))
  if (!link) throw new HTTPException(404, { message: 'Link not found' })
  const tagNamesByLinkId = await findVaultTagNamesByLinkId([linkId])
  return toLinkResponse(link, tagNamesByLinkId.get(linkId) ?? [])
}

export const vaultLinksRoutes = new Hono<AuthEnv>()
  .get('/', validate('query', vaultLinkListQuery), async (context) => {
    const { folder, search } = context.req.valid('query')
    const conditions = [eq(vaultLinks.userId, context.get('userId'))]
    if (folder) conditions.push(eq(vaultLinks.folderId, folder))
    if (search) {
      const pattern = `%${escapeLikePattern(search)}%`
      conditions.push(or(ilike(vaultLinks.title, pattern), ilike(vaultLinks.url, pattern))!)
    }

    const matchingLinks = await db
      .select()
      .from(vaultLinks)
      .where(and(...conditions))
      .orderBy(vaultLinks.title, vaultLinks.createdAt)
    const tagNamesByLinkId = await findVaultTagNamesByLinkId(matchingLinks.map((link) => link.id))
    return context.json(matchingLinks.map((link) => toLinkResponse(link, tagNamesByLinkId.get(link.id) ?? [])))
  })

  .get('/:id', validate('param', idParam), async (context) => {
    return context.json(await getLinkDetail(context.get('userId'), context.req.valid('param').id))
  })

  .post('/', validate('json', vaultLinkCreate), async (context) => {
    const userId = context.get('userId')
    const { tags: tagNames, ...fields } = context.req.valid('json')
    await assertLinkFolder(userId, fields.folderId)
    const faviconUrl = await readFaviconUrl(fields.url)
    const linkId = await db.transaction(async (transaction) => {
      const [createdLink] = await transaction
        .insert(vaultLinks)
        // A new link goes last in its folder, as in a browser's bookmarks.
        .values({ userId, ...fields, faviconUrl, sortPosition: await positionAfterAll(transaction, folderLinks(fields.folderId)) })
        .returning({ id: vaultLinks.id })
      await replaceVaultTags(transaction, userId, createdLink!.id, tagNames)
      return createdLink!.id
    })
    return context.json(await getLinkDetail(userId, linkId), 201)
  })

  .patch('/:id', validate('param', idParam), validate('json', vaultLinkUpdate), async (context) => {
    const userId = context.get('userId')
    const { id: linkId } = context.req.valid('param')
    const { tags: tagNames, ...fields } = context.req.valid('json')
    const currentLink = await getLinkDetail(userId, linkId)
    if (fields.folderId !== undefined) await assertLinkFolder(userId, fields.folderId)
    const changedUrl = fields.url !== undefined && fields.url !== currentLink.url ? fields.url : null
    const faviconChange = changedUrl ? { faviconUrl: await readFaviconUrl(changedUrl) } : {}

    const movesFolder = fields.folderId !== undefined && fields.folderId !== currentLink.folderId
    await db.transaction(async (transaction) => {
      const lastInNewFolder = movesFolder
        ? { sortPosition: await positionAfterAll(transaction, folderLinks(fields.folderId!)) }
        : {}
      await transaction
        .update(vaultLinks)
        .set({ ...fields, ...faviconChange, ...lastInNewFolder, updatedAt: new Date() })
        .where(eq(vaultLinks.id, linkId))
      if (tagNames) await replaceVaultTags(transaction, userId, linkId, tagNames)
    })
    return context.json(await getLinkDetail(userId, linkId))
  })

  // Moves the selected links together. If any of them is not found, none is moved.
  .post('/move', validate('json', vaultLinkMove), async (context) => {
    const userId = context.get('userId')
    const { linkIds, folderId } = context.req.valid('json')
    await assertLinkFolder(userId, folderId)
    await db.transaction(async (transaction) => {
      const movedLinks = await transaction
        .update(vaultLinks)
        .set({ folderId, updatedAt: new Date() })
        .where(and(eq(vaultLinks.userId, userId), inArray(vaultLinks.id, linkIds)))
        .returning({ id: vaultLinks.id })
      if (movedLinks.length !== linkIds.length) throw new HTTPException(404, { message: 'Link not found' })
      // They go last in the folder, in the order they were given.
      for (const linkId of linkIds) {
        await transaction
          .update(vaultLinks)
          .set({ sortPosition: await positionAfterAll(transaction, folderLinks(folderId)) })
          .where(eq(vaultLinks.id, linkId))
      }
    })
    return context.body(null, 204)
  })

  // Moves a link among the links of its folder in the list's custom order.
  .put('/:id/position', validate('param', idParam), validate('json', vaultLinkPositionUpdate), async (context) => {
    const userId = context.get('userId')
    const { id: linkId } = context.req.valid('param')
    const { afterLinkId } = context.req.valid('json')
    const link = await getLinkDetail(userId, linkId)
    await db.transaction((transaction) => moveAfter(transaction, folderLinks(link.folderId), linkId, afterLinkId))
    return context.body(null, 204)
  })

  .delete('/:id', validate('param', idParam), async (context) => {
    const userId = context.get('userId')
    const { id: linkId } = context.req.valid('param')
    await db.transaction(async (transaction) => {
      const deletedLinks = await transaction
        .delete(vaultLinks)
        .where(and(eq(vaultLinks.id, linkId), eq(vaultLinks.userId, userId)))
        .returning({ id: vaultLinks.id })
      if (deletedLinks.length === 0) throw new HTTPException(404, { message: 'Link not found' })
      await deleteUnusedVaultTags(transaction, userId)
    })
    return context.body(null, 204)
  })
