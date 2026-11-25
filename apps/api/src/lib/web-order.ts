import { asc, desc, eq, sql, type SQL } from 'drizzle-orm'
import { defaultSortDirection, type SortDirection, type WebSortMode } from '@webs/shared'
import { webs } from '../db/schema.ts'
import type { SortedList } from './sort-positions.ts'

const lowercaseTitle = sql`lower(${webs.title})`

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
  }
}

/** The mosaic of a user, in its custom order. New webs go first. */
export const userWebs = (userId: string): SortedList => ({
  table: webs,
  id: webs.id,
  sortPosition: webs.sortPosition,
  members: eq(webs.userId, userId),
  tieBreaker: sql`${webs.createdAt} desc`,
  rowName: 'Web',
})
