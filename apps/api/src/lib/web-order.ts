import { and, asc, desc, eq, gt, min, ne, sql, type SQL } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { defaultSortDirection, type SortDirection, type WebSortMode } from '@webs/shared'
import type { Transaction } from '../db/client.ts'
import { collections, collectionWebs, webs } from '../db/schema.ts'

const SORT_POSITION_SPACING = 1024
/** Below this gap, halving it again would lose precision, so positions are spread out first. */
const MIN_POSITION_GAP = 1e-6

const lowercaseTitle = sql`lower(${webs.title})`

/** Name of the alphabetically first collection of each web. null when it has none. */
const firstCollectionName = sql`(
  select min(lower(${collections.name}))
  from ${collectionWebs}
  join ${collections} on ${collections.id} = ${collectionWebs.collectionId}
  where ${collectionWebs.webId} = ${webs.id}
)`

export function webOrderBy(sortMode: WebSortMode, requestedDirection?: SortDirection): SQL[] {
  const direction = sortMode === 'custom' ? 'asc' : (requestedDirection ?? defaultSortDirection[sortMode])
  const inDirection = direction === 'asc' ? asc : desc
  const newestFirst = desc(webs.createdAt)

  switch (sortMode) {
    case 'custom':
      return [asc(webs.sortPosition), newestFirst]
    case 'title':
      return [inDirection(lowercaseTitle), newestFirst]
    case 'date':
      return [inDirection(webs.createdAt)]
    case 'collection':
      // Webs without a collection go last in both directions.
      return [sql`${firstCollectionName} ${sql.raw(direction)} nulls last`, asc(lowercaseTitle), newestFirst]
  }
}

async function findLowestPosition(transaction: Transaction, userId: string, exceptWebId?: string) {
  const conditions = [eq(webs.userId, userId)]
  if (exceptWebId) conditions.push(ne(webs.id, exceptWebId))
  const [aggregate] = await transaction
    .select({ lowestPosition: min(webs.sortPosition) })
    .from(webs)
    .where(and(...conditions))
  return aggregate?.lowestPosition ?? null
}

/** New webs go first in the custom order. */
export async function positionBeforeAllWebs(transaction: Transaction, userId: string) {
  const lowestPosition = await findLowestPosition(transaction, userId)
  return lowestPosition === null ? 0 : lowestPosition - SORT_POSITION_SPACING
}

/** Position right after `afterWebId` (or before every web when null). null when there is no room left. */
async function findPositionAfter(
  transaction: Transaction,
  userId: string,
  movedWebId: string,
  afterWebId: string | null,
) {
  if (afterWebId === null) {
    const lowestPosition = await findLowestPosition(transaction, userId, movedWebId)
    return lowestPosition === null ? 0 : lowestPosition - SORT_POSITION_SPACING
  }

  const otherWebsOfUser = and(eq(webs.userId, userId), ne(webs.id, movedWebId))
  const [previousWeb] = await transaction
    .select({ sortPosition: webs.sortPosition })
    .from(webs)
    .where(and(otherWebsOfUser, eq(webs.id, afterWebId)))
  if (!previousWeb) throw new HTTPException(400, { message: 'Web not found' })

  const [aggregate] = await transaction
    .select({ nextPosition: min(webs.sortPosition) })
    .from(webs)
    .where(and(otherWebsOfUser, gt(webs.sortPosition, previousWeb.sortPosition)))
  const nextPosition = aggregate?.nextPosition ?? null
  if (nextPosition === null) return previousWeb.sortPosition + SORT_POSITION_SPACING
  if (nextPosition - previousWeb.sortPosition < MIN_POSITION_GAP) return null
  return (previousWeb.sortPosition + nextPosition) / 2
}

/** Rewrites every position of a user with even spacing, keeping the current order. */
async function spreadSortPositions(transaction: Transaction, userId: string) {
  await transaction.execute(sql`
    update ${webs} set sort_position = ranked.row_number * ${SORT_POSITION_SPACING}
    from (
      select id, row_number() over (order by sort_position, created_at desc) as row_number
      from ${webs}
      where user_id = ${userId}
    ) as ranked
    where ${webs.id} = ranked.id
  `)
}

/**
 * Places a web right after another one in the custom order. Only the moved web changes position,
 * unless the gap is exhausted and the positions need to be spread out again.
 */
export async function moveWebAfter(
  transaction: Transaction,
  userId: string,
  movedWebId: string,
  afterWebId: string | null,
) {
  let newPosition = await findPositionAfter(transaction, userId, movedWebId, afterWebId)
  if (newPosition === null) {
    await spreadSortPositions(transaction, userId)
    newPosition = await findPositionAfter(transaction, userId, movedWebId, afterWebId)
  }
  if (newPosition === null) throw new Error('Could not find a sort position after spreading them out')
  await transaction.update(webs).set({ sortPosition: newPosition }).where(eq(webs.id, movedWebId))
}
