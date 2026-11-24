import { and, eq, gt, max, min, ne, sql, type SQL } from 'drizzle-orm'
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core'
import { HTTPException } from 'hono/http-exception'
import type { Transaction } from '../db/client.ts'

// A custom order keeps a fractional position per row, with gaps of SORT_POSITION_SPACING. Moving a row
// only rewrites its own position, which goes halfway between its new neighbours. When the gap runs out,
// the positions of that list are spread out again.

const SORT_POSITION_SPACING = 1024
/** Below this gap, halving it again would lose precision, so positions are spread out first. */
const MIN_POSITION_GAP = 1e-6

/** One list in a custom order, such as the webs of a user or the links of one folder. */
export type SortedList = {
  table: PgTable
  id: AnyPgColumn
  sortPosition: AnyPgColumn
  /** Which rows form the list. */
  members: SQL | undefined
  /** Order kept among equal positions when spreading them out. */
  tieBreaker: SQL
  /** Used in errors when the row to place it after is not in the list. */
  rowName: string
}

async function findEdgePosition(
  transaction: Transaction,
  list: SortedList,
  edge: 'lowest' | 'highest',
  exceptId?: string,
) {
  const [aggregate] = await transaction
    .select({ position: edge === 'lowest' ? min(list.sortPosition) : max(list.sortPosition) })
    .from(list.table)
    .where(and(list.members, exceptId ? ne(list.id, exceptId) : undefined))
  return aggregate?.position == null ? null : Number(aggregate.position)
}

/** Position for a new row at the start of the list. */
export async function positionBeforeAll(transaction: Transaction, list: SortedList) {
  const lowestPosition = await findEdgePosition(transaction, list, 'lowest')
  return lowestPosition === null ? 0 : lowestPosition - SORT_POSITION_SPACING
}

/** Position for a new row at the end of the list. */
export async function positionAfterAll(transaction: Transaction, list: SortedList) {
  const highestPosition = await findEdgePosition(transaction, list, 'highest')
  return highestPosition === null ? 0 : highestPosition + SORT_POSITION_SPACING
}

/** Position right after `afterId` (or before every row when null). null when there is no room left. */
async function findPositionAfter(transaction: Transaction, list: SortedList, movedId: string, afterId: string | null) {
  if (afterId === null) {
    const lowestPosition = await findEdgePosition(transaction, list, 'lowest', movedId)
    return lowestPosition === null ? 0 : lowestPosition - SORT_POSITION_SPACING
  }

  const otherMembers = and(list.members, ne(list.id, movedId))
  const [previousRow] = await transaction
    .select({ position: list.sortPosition })
    .from(list.table)
    .where(and(otherMembers, eq(list.id, afterId)))
  if (!previousRow) throw new HTTPException(400, { message: `${list.rowName} not found` })
  const previousPosition = Number(previousRow.position)

  const [aggregate] = await transaction
    .select({ nextPosition: min(list.sortPosition) })
    .from(list.table)
    .where(and(otherMembers, gt(list.sortPosition, previousPosition)))
  if (aggregate?.nextPosition == null) return previousPosition + SORT_POSITION_SPACING
  const nextPosition = Number(aggregate.nextPosition)
  if (nextPosition - previousPosition < MIN_POSITION_GAP) return null
  return (previousPosition + nextPosition) / 2
}

/** Rewrites every position of the list with even spacing, keeping the current order. */
async function spreadSortPositions(transaction: Transaction, list: SortedList) {
  await transaction.execute(sql`
    update ${list.table} set ${sql.identifier(list.sortPosition.name)} = ranked.row_number * ${SORT_POSITION_SPACING}
    from (
      select ${list.id} as ranked_id, row_number() over (order by ${list.sortPosition}, ${list.tieBreaker}) as row_number
      from ${list.table}
      where ${list.members ?? sql`true`}
    ) as ranked
    where ${list.id} = ranked.ranked_id
  `)
}

/** Places a row right after another one of its list (or first when `afterId` is null). */
export async function moveAfter(transaction: Transaction, list: SortedList, movedId: string, afterId: string | null) {
  let newPosition = await findPositionAfter(transaction, list, movedId, afterId)
  if (newPosition === null) {
    await spreadSortPositions(transaction, list)
    newPosition = await findPositionAfter(transaction, list, movedId, afterId)
  }
  if (newPosition === null) throw new Error('Could not find a sort position after spreading them out')
  await transaction.execute(
    sql`update ${list.table} set ${sql.identifier(list.sortPosition.name)} = ${newPosition} where ${list.id} = ${movedId}`,
  )
}
