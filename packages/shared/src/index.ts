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

export const webSortModes = ['custom', 'date', 'title'] as const
export type WebSortMode = (typeof webSortModes)[number]

export const sortDirections = ['asc', 'desc'] as const
export type SortDirection = (typeof sortDirections)[number]

/** Direction used when none is chosen: alphabetical A→Z, newest first. The custom order is never reversed. */
export const defaultSortDirection: Record<WebSortMode, SortDirection> = {
  custom: 'asc',
  title: 'asc',
  date: 'desc',
}

export const webListQuery = z.object({
  search: z.string().trim().max(200).optional(),
  /** Comma-separated tag names. Webs that have ANY of them are returned. */
  tags: z.string().max(2000).optional(),
  collection: z.uuid().optional(),
  sort: z.enum(webSortModes).default('custom'),
  direction: z.enum(sortDirections).optional(),
})

/** Moves a web in the custom order right after another one, or to the very start when null. */
export const webPositionUpdate = z.object({
  afterWebId: z.uuid().nullable(),
})

export const collectionCreate = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
})

export const collectionUpdate = collectionCreate.partial()

export const idParam = z.object({ id: z.uuid() })

// Two levels: categories are folders at the root and hold folders; the folders inside them hold the links.
const vaultFolderName = z.string().trim().min(1).max(200)
/** An icon name from the front's icon library, such as "book-open". Null shows the default icon. */
const vaultFolderIcon = z
  .string()
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Must be an icon name such as "book-open"')
  .nullable()
/** The folder a folder goes in (a category or any folder below it), or null to make it a category. */
const vaultParentId = z.uuid().nullable()

export const vaultFolderCreate = z.object({
  name: vaultFolderName,
  parentId: vaultParentId.default(null),
  icon: vaultFolderIcon.default(null),
})

export const vaultFolderUpdate = z.object({
  name: vaultFolderName.optional(),
  parentId: vaultParentId.optional(),
  icon: vaultFolderIcon.optional(),
})

/** Places the tiles of one grid by hand (categories, or the folders of one category): each in its cell. */
export const vaultGridUpdate = z.object({
  cells: z
    .array(z.object({ folderId: z.uuid(), gridCell: z.int().min(0).max(9999) }))
    .min(1)
    .max(1000)
    .refine((cells) => new Set(cells.map((cell) => cell.folderId)).size === cells.length, 'A folder appears twice')
    .refine((cells) => new Set(cells.map((cell) => cell.gridCell)).size === cells.length, 'Two folders share a cell'),
})

/** Random lays the tiles out anew on every visit; custom uses the cells placed by hand. */
export const vaultOrders = ['random', 'name', 'date', 'custom'] as const
export type VaultOrder = (typeof vaultOrders)[number]

export const vaultPreferencesUpdate = z.object({
  order: z.enum(vaultOrders),
  direction: z.enum(sortDirections),
})
export type VaultPreferences = z.infer<typeof vaultPreferencesUpdate>

export const defaultVaultPreferences: VaultPreferences = {
  order: 'name',
  direction: 'asc',
}

export const vaultLinkCreate = z.object({
  url: webUrl,
  title: webTitle,
  tags: tagList.default([]),
  folderId: z.uuid(),
})

export const vaultLinkUpdate = z.object({
  url: webUrl.optional(),
  title: webTitle.optional(),
  tags: tagList.optional(),
  folderId: z.uuid().optional(),
})

export const vaultLinkListQuery = z.object({
  /** Without it, links from the whole Vault. */
  folder: z.uuid().optional(),
  /** Matches the title or the URL. */
  search: z.string().trim().max(200).optional(),
})

/** Moves several links at once to another folder. */
export const vaultLinkMove = z.object({
  linkIds: z
    .array(z.uuid())
    .min(1)
    .max(1000)
    .transform((linkIds) => [...new Set(linkIds)]),
  folderId: z.uuid(),
})

export type WebCreate = z.input<typeof webCreate>
export type WebUpdate = z.input<typeof webUpdate>
