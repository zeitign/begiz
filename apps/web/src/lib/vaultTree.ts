import { vaultOrders, type VaultOrder, type VaultPreferences } from '@webs/shared'
import type { VaultFolder, VaultLink } from './api'

// Categories (folders at the root) hold folders, and folders hold links and subfolders at any depth.
// The tiles show the first two levels (buildVaultTree); the list shows every level (buildNestedVault).

export const DEFAULT_FOLDER_ICON = 'folder'

/** What both levels share: the tile they show and where it goes, and everything below it at any depth
 * (`nested`), which counts and searches read. */
type GridNode = {
  id: string
  name: string
  icon: string
  gridCell: number | null
  createdAt: string
  nested: NestedFolder
}

export type FolderNode = GridNode & {
  categoryId: string
  /** Its own links, without those of its subfolders. */
  links: VaultLink[]
}

export type CategoryNode = GridNode & {
  folders: FolderNode[]
}

export type VaultTree = {
  categories: CategoryNode[]
  categoriesById: Map<string, CategoryNode>
  foldersById: Map<string, FolderNode>
}

/** Turns the flat lists of the API into categories with their folders. Both keep the API order (by name). */
export function buildVaultTree(folders: VaultFolder[], links: VaultLink[]): VaultTree {
  const nestedVault = buildNestedVault(folders, links)
  const nestedOf = (folderId: string) => nestedVault.foldersById.get(folderId)!

  const categoriesById = new Map<string, CategoryNode>()
  for (const folder of folders) {
    if (folder.parentId !== null) continue
    categoriesById.set(folder.id, {
      id: folder.id,
      name: folder.name,
      icon: folder.icon ?? DEFAULT_FOLDER_ICON,
      gridCell: folder.gridCell,
      createdAt: folder.createdAt,
      nested: nestedOf(folder.id),
      folders: [],
    })
  }

  const foldersById = new Map<string, FolderNode>()
  for (const folder of folders) {
    const category = folder.parentId ? categoriesById.get(folder.parentId) : undefined
    if (!category) continue
    const folderNode: FolderNode = {
      id: folder.id,
      name: folder.name,
      icon: folder.icon ?? DEFAULT_FOLDER_ICON,
      gridCell: folder.gridCell,
      createdAt: folder.createdAt,
      nested: nestedOf(folder.id),
      categoryId: category.id,
      links: nestedOf(folder.id).links,
    }
    category.folders.push(folderNode)
    foldersById.set(folderNode.id, folderNode)
  }

  return { categories: [...categoriesById.values()], categoriesById, foldersById }
}

/** Orders the list offers: random only shuffles tiles, so the list has name, date and custom. */
export const listOrders = vaultOrders.filter((order) => order !== 'random')

/** The order the list follows: the saved one, or by name while the tiles are set to random. */
export const listOrder = (order: VaultOrder): VaultOrder => (order === 'random' ? 'name' : order)

type ListSortKeys = { name: string; createdAt: string; sortPosition: number }

/** Sorts what the list and the folder stack show: by name or date, or by the custom positions. */
export function sortByListOrder<Item>(
  items: Item[],
  preferences: VaultPreferences,
  sortKeys: (item: Item) => ListSortKeys,
): Item[] {
  const order = listOrder(preferences.order)
  const sortable = items.map((item) => ({ item, ...sortKeys(item) }))
  const sorted =
    order === 'custom'
      ? sortable.sort((first, second) => first.sortPosition - second.sortPosition)
      : sortForOrder(sortable, { ...preferences, order })
  return sorted.map((sortableItem) => sortableItem.item)
}

export const folderSortKeys = ({ name, createdAt, sortPosition }: NestedFolder) => ({ name, createdAt, sortPosition })
/** A link sorts by its title, as a folder does by its name. */
export const linkSortKeys = (link: VaultLink) => ({
  name: link.title,
  createdAt: link.createdAt,
  sortPosition: link.sortPosition,
})

/** By name or by date when the order asks for it; random and custom orders start from the name order. */
export function sortForOrder<Node extends { name: string; createdAt: string }>(
  nodes: Node[],
  { order, direction }: VaultPreferences,
): Node[] {
  if (order !== 'name' && order !== 'date') return nodes
  const sorted = [...nodes].sort((first, second) =>
    order === 'name' ? first.name.localeCompare(second.name) : first.createdAt.localeCompare(second.createdAt),
  )
  return direction === 'desc' ? sorted.reverse() : sorted
}


export const normalizeSearch = (search: string) => search.trim().toLowerCase()

export function linkMatches(link: VaultLink, query: string) {
  return link.title.toLowerCase().includes(query) || link.url.toLowerCase().includes(query)
}

/** A folder matches when its name, one of its links or anything below it matches, at any depth. */
export function nestedMatches(folder: NestedFolder, query: string): boolean {
  return (
    folder.name.toLowerCase().includes(query) ||
    folder.links.some((link) => linkMatches(link, query)) ||
    folder.subfolders.some((subfolder) => nestedMatches(subfolder, query))
  )
}

/** How many links match below a folder, at any depth. */
export function countMatchingLinks(folder: NestedFolder, query: string): number {
  return folder.subfolders.reduce(
    (total, subfolder) => total + countMatchingLinks(subfolder, query),
    folder.links.filter((link) => linkMatches(link, query)).length,
  )
}

/** A tile's count: its folders and links at any depth (only links when it has no folders), or how many
 * links match while searching. */
export function contentsCountLabel(folder: NestedFolder, query: string) {
  if (query) return `${countMatchingLinks(folder, query)} of ${pluralize(folder.linkTotal, 'link')}`
  const linkLabel = pluralize(folder.linkTotal, 'link')
  return folder.folderTotal ? `${pluralize(folder.folderTotal, 'folder')} · ${linkLabel}` : linkLabel
}

/** Past this, a word of a name breaks into lines instead of widening its column. */
const MAX_NAME_CHARS_PER_LINE = 15
const MIN_COLUMN_WIDTH = 148
/** Width of one letter of the open column's title: Geist Mono letters are 0.6em, the title is 26px with
 * -0.02em of letter spacing. */
const TITLE_LETTER_WIDTH = 26 * 0.58
/** The card's padding on both sides plus its line, and a little room. */
const COLUMN_PADDING = 36

/** Width of an open column: at least 148px, and enough for its name's longest word up to the limit. */
export function sideColumnWidth(name: string) {
  const longestWord = Math.max(...name.split(/\s+/).map((word) => word.length))
  const letters = Math.min(longestWord, MAX_NAME_CHARS_PER_LINE)
  return Math.max(MIN_COLUMN_WIDTH, Math.ceil(letters * TITLE_LETTER_WIDTH + COLUMN_PADDING))
}

export const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`

/** A folder at any depth, with its own subfolders and links and how many of each there are below it. */
export type NestedFolder = {
  id: string
  name: string
  icon: string
  parentId: string | null
  createdAt: string
  sortPosition: number
  subfolders: NestedFolder[]
  links: VaultLink[]
  folderTotal: number
  linkTotal: number
}

export type NestedVault = {
  categories: NestedFolder[]
  foldersById: Map<string, NestedFolder>
}

/** Turns the flat lists of the API into the whole tree. Folders and links keep the API order (by name). */
export function buildNestedVault(folders: VaultFolder[], links: VaultLink[]): NestedVault {
  const foldersById = new Map<string, NestedFolder>(
    folders.map((folder) => [
      folder.id,
      {
        id: folder.id,
        name: folder.name,
        icon: folder.icon ?? DEFAULT_FOLDER_ICON,
        parentId: folder.parentId,
        createdAt: folder.createdAt,
        sortPosition: folder.sortPosition,
        subfolders: [],
        links: [],
        folderTotal: 0,
        linkTotal: 0,
      },
    ]),
  )
  for (const link of links) foldersById.get(link.folderId)?.links.push(link)

  const categories: NestedFolder[] = []
  for (const folder of foldersById.values()) {
    if (folder.parentId === null) categories.push(folder)
    else foldersById.get(folder.parentId)?.subfolders.push(folder)
  }
  categories.forEach(countContents)
  return { categories, foldersById }
}

function countContents(folder: NestedFolder) {
  folder.subfolders.forEach(countContents)
  folder.folderTotal = folder.subfolders.reduce((total, subfolder) => total + 1 + subfolder.folderTotal, 0)
  folder.linkTotal = folder.subfolders.reduce((total, subfolder) => total + subfolder.linkTotal, folder.links.length)
}

/** The folder and the ones above it, from its category down. */
export function folderTrail(folderId: string, vault: NestedVault): NestedFolder[] {
  const trail: NestedFolder[] = []
  for (let folder = vault.foldersById.get(folderId); folder; folder = vault.foldersById.get(folder.parentId ?? '')) {
    trail.unshift(folder)
  }
  return trail
}

export const trailLabel = (trail: NestedFolder[]) => trail.map((folder) => folder.name).join(' › ')

export type SearchResults = {
  folders: { folder: NestedFolder; location: string }[]
  links: { link: VaultLink; location: string }[]
}

/** Folders by name and links by title or URL, anywhere in the Vault, each with the trail of where it lives. */
export function searchNestedVault(vault: NestedVault, query: string): SearchResults {
  const results: SearchResults = { folders: [], links: [] }
  const visit = (folder: NestedFolder, trail: NestedFolder[]) => {
    if (folder.name.toLowerCase().includes(query)) results.folders.push({ folder, location: trailLabel(trail) })
    const trailWithFolder = [...trail, folder]
    for (const link of folder.links) {
      if (linkMatches(link, query)) results.links.push({ link, location: trailLabel(trailWithFolder) })
    }
    for (const subfolder of folder.subfolders) visit(subfolder, trailWithFolder)
  }
  for (const category of vault.categories) visit(category, [])
  return results
}

/** What is picked in the list's tray, in the order it was picked. */
export type VaultPicks = { folderIds: string[]; linkIds: string[] }

/** Why the picks cannot go into a folder (null = among the categories), following the API's rules:
 * `here` when they all live there already, `itself` for a picked folder or one inside it, `noLinks` for
 * links among the categories or in a category, `hasLinks` for a folder with links becoming a category. */
export type MoveRefusal = 'here' | 'itself' | 'noLinks' | 'hasLinks'

export function moveRefusal(
  vault: NestedVault,
  links: VaultLink[],
  picks: VaultPicks,
  destinationId: string | null,
): MoveRefusal | null {
  const pickedLinks = links.filter((link) => picks.linkIds.includes(link.id))
  const currentParentIds = [
    ...picks.folderIds.map((folderId) => vault.foldersById.get(folderId)?.parentId ?? null),
    ...pickedLinks.map((link) => link.folderId),
  ]
  if (currentParentIds.every((parentId) => parentId === destinationId)) return 'here'
  if (destinationId === null) {
    if (pickedLinks.length) return 'noLinks'
    const hasOwnLinks = picks.folderIds.some((folderId) => vault.foldersById.get(folderId)?.links.length)
    return hasOwnLinks ? 'hasLinks' : null
  }
  const destinationTrail = folderTrail(destinationId, vault)
  if (destinationTrail.some((folder) => picks.folderIds.includes(folder.id))) return 'itself'
  if (pickedLinks.length && destinationTrail.length === 1) return 'noLinks'
  return null
}
