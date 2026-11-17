import { and, eq, inArray, sql } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { db, type Transaction } from '../db/client.ts'
import { vaultFolders, vaultLinkTags, vaultTags } from '../db/schema.ts'

/** Rejects a folder chosen as destination when it does not exist or belongs to someone else. Null is the root. */
export async function assertFolderExists(userId: string, folderId: string | null) {
  if (folderId === null) return
  const [folder] = await db
    .select({ id: vaultFolders.id })
    .from(vaultFolders)
    .where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.userId, userId)))
  if (!folder) throw new HTTPException(400, { message: 'Folder not found' })
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
