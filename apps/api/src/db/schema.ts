import {
  type AnyPgColumn,
  doublePrecision,
  index,
  integer,
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

// Vault: bookmarks without images, in nested folders. Its own tables, so the mosaic is never at risk.

export const vaultFolders = pgTable(
  'vault_folders',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    /** Null for categories, which hold folders. Deleting a category deletes its folders. */
    parentId: uuid('parent_id').references((): AnyPgColumn => vaultFolders.id, {
      onDelete: 'cascade',
    }),
    name: text().notNull(),
    /** Name of the icon chosen in the front's icon library. Null shows the default icon. */
    icon: text(),
    /** Cell of its grid where the user placed it, in reading order. Null until placed by hand. */
    gridCell: integer('grid_cell'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('vault_folders_user_parent_idx').on(table.userId, table.parentId)],
)

/** How the Vault lays out its tiles. No row until the user changes it: the API answers with the default. */
export const vaultPreferences = pgTable('vault_preferences', {
  userId: uuid('user_id').primaryKey(),
  order: text().notNull(),
  direction: text().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const vaultLinks = pgTable(
  'vault_links',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    /** Always a folder inside a category (checked by the API). Deleting the folder deletes its links. */
    folderId: uuid('folder_id')
      .notNull()
      .references(() => vaultFolders.id, { onDelete: 'cascade' }),
    url: text().notNull(),
    title: text().notNull(),
    /** Read from the page when the link is saved by hand. Null when the page could not be read. */
    faviconUrl: text('favicon_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('vault_links_user_folder_idx').on(table.userId, table.folderId)],
)

export const vaultTags = pgTable(
  'vault_tags',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    name: text().notNull(),
  },
  (table) => [uniqueIndex('vault_tags_user_name_idx').on(table.userId, table.name)],
)

export const vaultLinkTags = pgTable(
  'vault_link_tags',
  {
    linkId: uuid('link_id')
      .notNull()
      .references(() => vaultLinks.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => vaultTags.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.linkId, table.tagId] }), index('vault_link_tags_tag_idx').on(table.tagId)],
)
