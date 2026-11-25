import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { db, type Transaction } from '../db/client.ts'
import { vaultFolders, vaultLinks, vaultLinkTags, vaultTags } from '../db/schema.ts'
import { positionAfterAll, type SortedList } from './sort-positions.ts'

// Categories (folders at the root) hold only folders. Below them, folders nest at any depth and
// each one can hold links and subfolders at once, as in a browser.

/** The folders inside one folder (or the categories, with null), in the list's custom order. */
export const siblingFolders = (userId: string, parentId: string | null): SortedList => ({
  table: vaultFolders,
  id: vaultFolders.id,
  sortPosition: vaultFolders.sortPosition,
  members: and(
    eq(vaultFolders.userId, userId),
    parentId === null ? isNull(vaultFolders.parentId) : eq(vaultFolders.parentId, parentId),
  ),
  tieBreaker: sql`lower(${vaultFolders.name})`,
  rowName: 'Folder',
})

/** The links of one folder, in the list's custom order. The folder is already known to be the user's. */
export const folderLinks = (folderId: string): SortedList => ({
  table: vaultLinks,
  id: vaultLinks.id,
  sortPosition: vaultLinks.sortPosition,
  members: eq(vaultLinks.folderId, folderId),
  tieBreaker: sql`lower(${vaultLinks.title})`,
  rowName: 'Link',
})

/** The folder chosen as parent or destination. Unknown is a bad request, not a missing resource. */
export async function findChosenFolder(userId: string, folderId: string) {
  const [folder] = await db
    .select({ id: vaultFolders.id, parentId: vaultFolders.parentId })
    .from(vaultFolders)
    .where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.userId, userId)))
  if (!folder) throw new HTTPException(400, { message: 'Folder not found' })
  return folder
}

/** True when the folder is the other one or one of its subfolders, at any depth. */
export async function isWithinFolder(folderId: string, ancestorId: string) {
  const folderAndItsAncestorIds = sql`(
    with recursive ancestors as (
      select id, parent_id from ${vaultFolders} where id = ${folderId}
      union all
      select parent.id, parent.parent_id from ${vaultFolders} parent join ancestors on parent.id = ancestors.parent_id
    )
    select id from ancestors
  )`
  const matchCount = await db.$count(
    vaultFolders,
    and(eq(vaultFolders.id, ancestorId), sql`${vaultFolders.id} in ${folderAndItsAncestorIds}`),
  )
  return matchCount > 0
}

/** A folder can go inside any other, except itself or its own subfolders (it would leave the tree).
 * It only becomes a category without links of its own, since categories only hold folders.
 * Returns the folder, with the parent it has now. */
export async function assertValidNewParent(userId: string, folderId: string, newParentId: string | null) {
  const [folder] = await db
    .select({ id: vaultFolders.id, parentId: vaultFolders.parentId })
    .from(vaultFolders)
    .where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.userId, userId)))
  if (!folder) throw new HTTPException(404, { message: 'Folder not found' })

  if (newParentId === null) {
    if (await db.$count(vaultLinks, eq(vaultLinks.folderId, folderId))) {
      throw new HTTPException(400, {
        message: 'A folder with links cannot become a category',
      })
    }
    return folder
  }
  await findChosenFolder(userId, newParentId)
  if (await isWithinFolder(newParentId, folderId)) {
    throw new HTTPException(400, {
      message: 'A folder cannot be moved inside itself or its subfolders',
    })
  }
  return folder
}

/** Where a folder lands in another parent: last in the list, and without its grid cell, which means
 * nothing in another grid (it takes the first free one). */
export async function placeLastIn(transaction: Transaction, userId: string, parentId: string | null) {
  return {
    parentId,
    gridCell: null,
    sortPosition: await positionAfterAll(transaction, siblingFolders(userId, parentId)),
  }
}

/** Rejects a destination for links that is a category: categories only hold folders. */
export async function assertLinkFolder(userId: string, folderId: string) {
  const folder = await findChosenFolder(userId, folderId)
  if (folder.parentId === null) {
    throw new HTTPException(400, { message: 'Links go in a folder inside a category, not in the category itself' })
  }
}

export async function findVaultTagNamesByLinkId(linkIds: string[]) {
  const tagNamesByLinkId = new Map<string, string[]>()
  if (linkIds.length === 0) return tagNamesByLinkId
  const rows = await db
    .select({ linkId: vaultLinkTags.linkId, name: vaultTags.name })
    .from(vaultLinkTags)
    .innerJoin(vaultTags, eq(vaultTags.id, vaultLinkTags.tagId))
    .where(inArray(vaultLinkTags.linkId, linkIds))
    .orderBy(vaultTags.name)
  for (const row of rows) {
    tagNamesByLinkId.set(row.linkId, [...(tagNamesByLinkId.get(row.linkId) ?? []), row.name])
  }
  return tagNamesByLinkId
}

/** Replaces the tags of a link, creating the missing ones and deleting those left unused. */
export async function replaceVaultTags(transaction: Transaction, userId: string, linkId: string, tagNames: string[]) {
  await transaction.delete(vaultLinkTags).where(eq(vaultLinkTags.linkId, linkId))
  if (tagNames.length > 0) {
    await transaction
      .insert(vaultTags)
      .values(tagNames.map((name) => ({ userId, name })))
      .onConflictDoNothing()
    const userTags = await transaction
      .select({ id: vaultTags.id })
      .from(vaultTags)
      .where(and(eq(vaultTags.userId, userId), inArray(vaultTags.name, tagNames)))
    await transaction.insert(vaultLinkTags).values(userTags.map((tag) => ({ linkId, tagId: tag.id })))
  }
  await deleteUnusedVaultTags(transaction, userId)
}

export async function deleteUnusedVaultTags(transaction: Transaction, userId: string) {
  await transaction
    .delete(vaultTags)
    .where(
      and(
        eq(vaultTags.userId, userId),
        sql`not exists (select 1 from ${vaultLinkTags} where ${vaultLinkTags.tagId} = ${vaultTags.id})`,
      ),
    )
}
