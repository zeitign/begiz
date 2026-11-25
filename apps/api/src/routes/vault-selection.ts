import { and, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { vaultDelete, vaultMove } from '@webs/shared'
import type { AuthEnv } from '../auth.ts'
import { db } from '../db/client.ts'
import { vaultFolders, vaultLinks } from '../db/schema.ts'
import { positionAfterAll } from '../lib/sort-positions.ts'
import { validate } from '../lib/validate.ts'
import { assertLinkFolder, assertValidNewParent, deleteUnusedVaultTags, folderLinks, placeLastIn } from '../lib/vault.ts'

/** The folder each link lives in, by link id. */
async function findLinkFolders(userId: string, linkIds: string[]) {
  const links = await db
    .select({ id: vaultLinks.id, folderId: vaultLinks.folderId })
    .from(vaultLinks)
    .where(and(eq(vaultLinks.userId, userId), inArray(vaultLinks.id, linkIds)))
  if (links.length !== linkIds.length) throw new HTTPException(404, { message: 'Link not found' })
  return new Map(links.map((link) => [link.id, link.folderId]))
}

// What is picked in the list's tray, folders and links together. Each action is all or nothing.
export const vaultSelectionRoutes = new Hono<AuthEnv>()
  // Whatever already lives in the destination keeps its place; the rest goes last there, in the order given.
  .post('/move', validate('json', vaultMove), async (context) => {
    const userId = context.get('userId')
    const { folderIds, linkIds, folderId: destinationId } = context.req.valid('json')

    const pickedFolders: { id: string; parentId: string | null }[] = []
    for (const pickedFolderId of folderIds) {
      pickedFolders.push(await assertValidNewParent(userId, pickedFolderId, destinationId))
    }
    if (linkIds.length > 0) {
      if (destinationId === null) {
        throw new HTTPException(400, { message: 'Links go in a folder, not among the categories' })
      }
      await assertLinkFolder(userId, destinationId)
    }
    const folderIdByLinkId = await findLinkFolders(userId, linkIds)

    await db.transaction(async (transaction) => {
      for (const folder of pickedFolders.filter((folder) => folder.parentId !== destinationId)) {
        await transaction
          .update(vaultFolders)
          .set(await placeLastIn(transaction, userId, destinationId))
          .where(eq(vaultFolders.id, folder.id))
      }
      // Links were refused above when the destination is the categories.
      if (destinationId === null) return
      for (const linkId of linkIds.filter((linkId) => folderIdByLinkId.get(linkId) !== destinationId)) {
        await transaction
          .update(vaultLinks)
          .set({
            folderId: destinationId,
            sortPosition: await positionAfterAll(transaction, folderLinks(destinationId)),
            updatedAt: new Date(),
          })
          .where(eq(vaultLinks.id, linkId))
      }
    })
    return context.body(null, 204)
  })

  // Folders go with everything inside them (cascade). The front warns with the count first.
  .post('/delete', validate('json', vaultDelete), async (context) => {
    const userId = context.get('userId')
    const { folderIds, linkIds } = context.req.valid('json')
    await db.transaction(async (transaction) => {
      // Links first: one inside a picked folder would otherwise go with it and look unknown here.
      const deletedLinks = await transaction
        .delete(vaultLinks)
        .where(and(eq(vaultLinks.userId, userId), inArray(vaultLinks.id, linkIds)))
        .returning({ id: vaultLinks.id })
      if (deletedLinks.length !== linkIds.length) throw new HTTPException(404, { message: 'Link not found' })
      const deletedFolders = await transaction
        .delete(vaultFolders)
        .where(and(eq(vaultFolders.userId, userId), inArray(vaultFolders.id, folderIds)))
        .returning({ id: vaultFolders.id })
      if (deletedFolders.length !== folderIds.length) throw new HTTPException(404, { message: 'Folder not found' })
      await deleteUnusedVaultTags(transaction, userId)
    })
    return context.body(null, 204)
  })
