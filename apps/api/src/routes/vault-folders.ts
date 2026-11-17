import { and, count, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { idParam, vaultFolderCreate, vaultFolderUpdate } from '@webs/shared'
import type { AuthEnv } from '../auth.ts'
import { db } from '../db/client.ts'
import { vaultFolders, vaultLinks } from '../db/schema.ts'
import { validate } from '../lib/validate.ts'
import { assertFolderExists, deleteUnusedVaultTags } from '../lib/vault.ts'

function toFolderResponse(folder: typeof vaultFolders.$inferSelect, linkCount = 0) {
  return { id: folder.id, name: folder.name, parentId: folder.parentId, icon: folder.icon, linkCount }
}

/** Checks that a folder can move under a new parent: the parent exists and is not the folder or inside it. */
async function assertValidNewParent(userId: string, folderId: string, newParentId: string | null) {
  const userFolders = await db
    .select({ id: vaultFolders.id, parentId: vaultFolders.parentId })
    .from(vaultFolders)
    .where(eq(vaultFolders.userId, userId))
  const parentIdByFolderId = new Map(userFolders.map((folder) => [folder.id, folder.parentId]))
  if (!parentIdByFolderId.has(folderId)) throw new HTTPException(404, { message: 'Folder not found' })
  if (newParentId !== null && !parentIdByFolderId.has(newParentId)) {
    throw new HTTPException(400, { message: 'Folder not found' })
  }
  for (let ancestorId = newParentId; ancestorId !== null; ancestorId = parentIdByFolderId.get(ancestorId) ?? null) {
    if (ancestorId === folderId) {
      throw new HTTPException(400, { message: 'A folder cannot be moved inside itself' })
    }
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
    await assertFolderExists(userId, input.parentId)
    const [createdFolder] = await db
      .insert(vaultFolders)
      .values({ userId, name: input.name, parentId: input.parentId, icon: input.icon })
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
        ...(input.parentId !== undefined && { parentId: input.parentId }),
        ...(input.icon !== undefined && { icon: input.icon }),
      })
      .where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.userId, userId)))
      .returning()
    if (!updatedFolder) throw new HTTPException(404, { message: 'Folder not found' })
    const linkCount = await db.$count(vaultLinks, eq(vaultLinks.folderId, folderId))
    return context.json(toFolderResponse(updatedFolder, linkCount))
  })

  // Deletes the subfolders and links inside too (cascade). The front warns with the count first.
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
