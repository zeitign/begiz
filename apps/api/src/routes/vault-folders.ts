import { and, count, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { idParam, vaultFolderCreate, vaultFolderUpdate, vaultGridUpdate } from '@webs/shared'
import type { AuthEnv } from '../auth.ts'
import { db } from '../db/client.ts'
import { vaultFolders, vaultLinks } from '../db/schema.ts'
import { validate } from '../lib/validate.ts'
import { deleteUnusedVaultTags, findChosenFolder, isWithinFolder } from '../lib/vault.ts'

function toFolderResponse(folder: typeof vaultFolders.$inferSelect, linkCount = 0) {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    icon: folder.icon,
    gridCell: folder.gridCell,
    createdAt: folder.createdAt.toISOString(),
    linkCount,
  }
}

/** The cells placed by hand belong to one grid: every folder must be the user's and share its parent. */
async function assertSameGrid(userId: string, folderIds: string[]) {
  const folders = await db
    .select({ parentId: vaultFolders.parentId })
    .from(vaultFolders)
    .where(and(inArray(vaultFolders.id, folderIds), eq(vaultFolders.userId, userId)))
  if (folders.length !== folderIds.length) throw new HTTPException(404, { message: 'Folder not found' })
  if (new Set(folders.map((folder) => folder.parentId)).size > 1) {
    throw new HTTPException(400, {
      message: 'The folders must be in the same grid',
    })
  }
}

/** A folder can go inside any other, except itself or its own subfolders (it would leave the tree).
 * It only becomes a category without links of its own, since categories only hold folders. */
async function assertValidNewParent(userId: string, folderId: string, newParentId: string | null) {
  const [folder] = await db
    .select({ id: vaultFolders.id })
    .from(vaultFolders)
    .where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.userId, userId)))
  if (!folder) throw new HTTPException(404, { message: 'Folder not found' })

  if (newParentId === null) {
    if (await db.$count(vaultLinks, eq(vaultLinks.folderId, folderId))) {
      throw new HTTPException(400, {
        message: 'A folder with links cannot become a category',
      })
    }
    return
  }
  await findChosenFolder(userId, newParentId)
  if (await isWithinFolder(newParentId, folderId)) {
    throw new HTTPException(400, {
      message: 'A folder cannot be moved inside itself or its subfolders',
    })
  }
}

export const vaultFoldersRoutes = new Hono<AuthEnv>()
  // Every folder in a flat list: the front builds the tree from parentId.
  .get('/', async (context) => {
    const rows = await db
      .select({ folder: vaultFolders, linkCount: count(vaultLinks.id) })
      .from(vaultFolders)
      .leftJoin(vaultLinks, eq(vaultLinks.folderId, vaultFolders.id))
      .where(eq(vaultFolders.userId, context.get('userId')))
      .groupBy(vaultFolders.id)
      .orderBy(vaultFolders.name)
    return context.json(rows.map((row) => toFolderResponse(row.folder, row.linkCount)))
  })

  .post('/', validate('json', vaultFolderCreate), async (context) => {
    const userId = context.get('userId')
    const input = context.req.valid('json')
    if (input.parentId !== null) await findChosenFolder(userId, input.parentId)
    const [createdFolder] = await db
      .insert(vaultFolders)
      .values({
        userId,
        name: input.name,
        parentId: input.parentId,
        icon: input.icon,
      })
      .returning()
    return context.json(toFolderResponse(createdFolder!), 201)
  })

  .patch('/:id', validate('param', idParam), validate('json', vaultFolderUpdate), async (context) => {
    const userId = context.get('userId')
    const { id: folderId } = context.req.valid('param')
    const input = context.req.valid('json')
    if (input.parentId !== undefined) await assertValidNewParent(userId, folderId, input.parentId)
    const [updatedFolder] = await db
      .update(vaultFolders)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        // In another grid, its cell means nothing: it goes to the first free one.
        ...(input.parentId !== undefined && {
          parentId: input.parentId,
          gridCell: null,
        }),
        ...(input.icon !== undefined && { icon: input.icon }),
      })
      .where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.userId, userId)))
      .returning()
    if (!updatedFolder) throw new HTTPException(404, { message: 'Folder not found' })
    const linkCount = await db.$count(vaultLinks, eq(vaultLinks.folderId, folderId))
    return context.json(toFolderResponse(updatedFolder, linkCount))
  })

  // Places the tiles of one grid by hand. Folders of that grid left out keep their cell.
  .put('/grid', validate('json', vaultGridUpdate), async (context) => {
    const userId = context.get('userId')
    const { cells } = context.req.valid('json')
    await assertSameGrid(
      userId,
      cells.map((cell) => cell.folderId),
    )
    await db.transaction(async (transaction) => {
      for (const cell of cells) {
        await transaction
          .update(vaultFolders)
          .set({ gridCell: cell.gridCell })
          .where(and(eq(vaultFolders.id, cell.folderId), eq(vaultFolders.userId, userId)))
      }
    })
    return context.body(null, 204)
  })

  // Deletes the folders and links inside too (cascade). The front warns with the count first.
  .delete('/:id', validate('param', idParam), async (context) => {
    const userId = context.get('userId')
    const { id: folderId } = context.req.valid('param')
    await db.transaction(async (transaction) => {
      const deletedFolders = await transaction
        .delete(vaultFolders)
        .where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.userId, userId)))
        .returning({ id: vaultFolders.id })
      if (deletedFolders.length === 0) throw new HTTPException(404, { message: 'Folder not found' })
      await deleteUnusedVaultTags(transaction, userId)
    })
    return context.body(null, 204)
  })
