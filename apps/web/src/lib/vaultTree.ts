import type { VaultPreferences } from '@webs/shared'
import type { VaultFolder, VaultLink } from './api'

// The Vault has two levels: categories (folders at the root) hold folders, and folders hold links.

export const DEFAULT_FOLDER_ICON = 'folder'

/** What both levels share: the tile they show and where it goes. */
type GridNode = {
  id: string
  name: string
  icon: string
  gridCell: number | null
  createdAt: string
}

export type FolderNode = GridNode & {
  categoryId: string
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
  const linksByFolderId = new Map<string, VaultLink[]>()
  for (const link of links) {
    linksByFolderId.set(link.folderId, [...(linksByFolderId.get(link.folderId) ?? []), link])
  }

  const categoriesById = new Map<string, CategoryNode>()
  for (const folder of folders) {
    if (folder.parentId !== null) continue
    categoriesById.set(folder.id, {
      id: folder.id,
      name: folder.name,
      icon: folder.icon ?? DEFAULT_FOLDER_ICON,
      gridCell: folder.gridCell,
      createdAt: folder.createdAt,
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
      categoryId: category.id,
      links: linksByFolderId.get(folder.id) ?? [],
    }
    category.folders.push(folderNode)
    foldersById.set(folderNode.id, folderNode)
  }

  return { categories: [...categoriesById.values()], categoriesById, foldersById }
}

/** By name or by date when the order asks for it; random and custom orders start from the name order. */
export function sortForOrder<Node extends GridNode>(nodes: Node[], { order, direction }: VaultPreferences): Node[] {
  if (order !== 'name' && order !== 'date') return nodes
  const sorted = [...nodes].sort((first, second) =>
    order === 'name' ? first.name.localeCompare(second.name) : first.createdAt.localeCompare(second.createdAt),
  )
  return direction === 'desc' ? sorted.reverse() : sorted
}

export const categoryLinkCount = (category: CategoryNode) =>
  category.folders.reduce((total, folder) => total + folder.links.length, 0)

export const normalizeSearch = (search: string) => search.trim().toLowerCase()

export function linkMatches(link: VaultLink, query: string) {
  return link.title.toLowerCase().includes(query) || link.url.toLowerCase().includes(query)
}

/** A folder matches when its name or one of its links matches. */
export function folderMatches(folder: FolderNode, query: string) {
  return folder.name.toLowerCase().includes(query) || folder.links.some((link) => linkMatches(link, query))
}

/** A category matches when its name or one of its folders matches. */
export function categoryMatches(category: CategoryNode, query: string) {
  return category.name.toLowerCase().includes(query) || category.folders.some((folder) => folderMatches(folder, query))
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
