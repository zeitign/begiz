import {
  doublePrecision,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

// user_id is the id from Supabase's auth.users. It is not a foreign key, so the schema
// does not depend on Supabase and can move to any Postgres.

export const webs = pgTable(
  'webs',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    url: text().notNull(),
    title: text().notNull(),
    notes: text().notNull().default(''),
    /** Mosaic thumbnail (WebP). When null, the front draws a card with the favicon and domain. */
    previewKey: text('preview_key'),
    previewSource: text('preview_source', { enum: ['manual', 'og'] }),
    /** Original image uploaded by hand (it can be a full-page screenshot). */
    fullKey: text('full_key'),
    siteTitle: text('site_title'),
    faviconUrl: text('favicon_url'),
    /** Position in the custom mosaic order (ascending). Fractional, so a move only rewrites one web. */
    sortPosition: doublePrecision('sort_position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('webs_user_created_idx').on(table.userId, table.createdAt),
    index('webs_user_sort_position_idx').on(table.userId, table.sortPosition),
    index('webs_title_trgm_idx').using('gin', table.title.op('gin_trgm_ops')),
  ],
)

export const tags = pgTable(
  'tags',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    name: text().notNull(),
  },
  (table) => [uniqueIndex('tags_user_name_idx').on(table.userId, table.name)],
)

export const webTags = pgTable(
  'web_tags',
  {
    webId: uuid('web_id')
      .notNull()
      .references(() => webs.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.webId, table.tagId] }), index('web_tags_tag_idx').on(table.tagId)],
)

export const collections = pgTable(
  'collections',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    name: text().notNull(),
    description: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('collections_user_name_idx').on(table.userId, table.name)],
)

export const collectionWebs = pgTable(
  'collection_webs',
  {
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    webId: uuid('web_id')
      .notNull()
      .references(() => webs.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.webId] }),
    index('collection_webs_web_idx').on(table.webId),
  ],
)
