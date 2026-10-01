import { z } from 'zod'

/** "  Colour   Palette " → "colour palette". Avoids duplicates that differ only in case or spacing. */
export function normalizeTag(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

const tagName = z.string().transform(normalizeTag).pipe(z.string().min(1).max(40))
const tagList = z
  .array(tagName)
  .max(30)
  .transform((names) => [...new Set(names)])

const webUrl = z.url({ protocol: /^https?$/ }).max(2000)
const webTitle = z.string().trim().min(1).max(200)
const webNotes = z.string().max(5000)
const collectionIds = z.array(z.uuid()).max(100)

export const webCreate = z.object({
  url: webUrl,
  title: webTitle,
  notes: webNotes.default(''),
  tags: tagList.default([]),
  collectionIds: collectionIds.default([]),
  /** false skips downloading the og:image, e.g. because the user is about to upload her own image. */
  usePageImage: z.boolean().default(true),
})

export const webUpdate = z.object({
  url: webUrl.optional(),
  title: webTitle.optional(),
  notes: webNotes.optional(),
  tags: tagList.optional(),
  collectionIds: collectionIds.optional(),
})

export const webListQuery = z.object({
  search: z.string().trim().max(200).optional(),
  /** Comma-separated tag names. Only webs that have ALL of them are returned. */
  tags: z.string().max(2000).optional(),
  collection: z.uuid().optional(),
})

export const collectionCreate = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
})

export const collectionUpdate = collectionCreate.partial()

export const idParam = z.object({ id: z.uuid() })

export type WebCreate = z.input<typeof webCreate>
export type WebUpdate = z.input<typeof webUpdate>
