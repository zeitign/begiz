import { z } from 'zod'

/** "  Paleta   de Color " → "paleta de color". Evita duplicados por mayúsculas o espacios. */
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
  /** Si es false, no se descarga la og:image (p. ej. porque se va a subir una imagen propia). */
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
  q: z.string().trim().max(200).optional(),
  /** Nombres de tags separados por comas. Se devuelven las webs que tienen TODOS. */
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
