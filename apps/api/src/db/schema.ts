import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

// user_id es el id de auth.users de Supabase. No se declara como clave foránea
// para que el esquema no dependa de Supabase y se pueda llevar a cualquier Postgres.

export const webs = pgTable(
  'webs',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    url: text().notNull(),
    title: text().notNull(),
    notes: text().notNull().default(''),
    /** Miniatura del mosaico (WebP). null → el front pinta una tarjeta con favicon y dominio. */
    previewKey: text('preview_key'),
    previewSource: text('preview_source', { enum: ['manual', 'og'] }),
    /** Imagen original subida a mano (puede ser una captura de página completa). */
    fullKey: text('full_key'),
    siteTitle: text('site_title'),
    faviconUrl: text('favicon_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('webs_user_created_idx').on(t.userId, t.createdAt),
    index('webs_title_trgm_idx').using('gin', t.title.op('gin_trgm_ops')),
  ],
)

export const tags = pgTable(
  'tags',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    name: text().notNull(),
  },
  (t) => [uniqueIndex('tags_user_name_idx').on(t.userId, t.name)],
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
  (t) => [primaryKey({ columns: [t.webId, t.tagId] }), index('web_tags_tag_idx').on(t.tagId)],
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
  (t) => [uniqueIndex('collections_user_name_idx').on(t.userId, t.name)],
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
  (t) => [
    primaryKey({ columns: [t.collectionId, t.webId] }),
    index('collection_webs_web_idx').on(t.webId),
  ],
)
