import type { VaultOrder } from '@webs/shared'

// Where each tile of a Vault grid goes. Cells are numbered in reading order; on the home grid the first
// one holds the intro, so tiles start at the second.

/** Tile id → cell. */
export type TilePlacement = Map<string, number>
export type PlacedTile = { id: string; gridCell: number | null }

// Scattered pattern: tiles fill these cells of every block of 15 and the rest stay empty.
const CELLS_PER_BLOCK = 15
const TILE_CELLS_IN_BLOCK = [1, 2, 4, 5, 8, 11, 14]

const firstTileCell = (hasIntro: boolean) => (hasIntro ? 1 : 0)

/** The pattern always starts with a tile: on the home grid, right after the intro. */
function isPatternCell(cell: number, hasIntro: boolean) {
  const patternIndex = hasIntro ? cell : cell + 1
  return TILE_CELLS_IN_BLOCK.includes(patternIndex % CELLS_PER_BLOCK)
}

/** The next cells of the pattern that are still free, as many as asked. */
function freePatternCells(count: number, hasIntro: boolean, takenCells: Set<number>) {
  const cells: number[] = []
  for (let cell = firstTileCell(hasIntro); cells.length < count; cell++) {
    if (isPatternCell(cell, hasIntro) && !takenCells.has(cell)) cells.push(cell)
  }
  return cells
}

function scatteredPlacement(tileIds: string[], hasIntro: boolean): TilePlacement {
  const cells = freePatternCells(tileIds.length, hasIntro, new Set())
  return new Map(tileIds.map((tileId, index) => [tileId, cells[index]!]))
}

/** One after another, without gaps: the matches of a search. */
function packedPlacement(tileIds: string[], hasIntro: boolean): TilePlacement {
  return new Map(tileIds.map((tileId, index) => [tileId, firstTileCell(hasIntro) + index]))
}

/** Same space as the pattern, but the tiles go to cells picked at random. Next to the intro (right, below
 * or below right), there is always a tile, so the intro never stands alone. */
function randomPlacement(
  tileIds: string[],
  hasIntro: boolean,
  columnCount: number,
  random: () => number,
): TilePlacement {
  const patternCells = freePatternCells(tileIds.length, hasIntro, new Set())
  const lastCell = patternCells.at(-1) ?? 0
  const cells: number[] = []
  for (let cell = firstTileCell(hasIntro); cell <= lastCell; cell++) cells.push(cell)
  for (let index = cells.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[cells[index], cells[swapIndex]] = [cells[swapIndex]!, cells[index]!]
  }
  const placement: TilePlacement = new Map(tileIds.map((tileId, index) => [tileId, cells[index]!]))
  const [firstTileId] = tileIds
  if (!hasIntro || !firstTileId) return placement
  const cellsAroundIntro = [1, columnCount, columnCount + 1]
  const isIntroAlone = !tileIds.some((tileId) => cellsAroundIntro.includes(placement.get(tileId)!))
  if (isIntroAlone) placement.set(firstTileId, cellsAroundIntro[Math.floor(random() * cellsAroundIntro.length)]!)
  return placement
}

/** The cells placed by hand; the tiles never placed take the free cells of the pattern. */
function customPlacement(tiles: PlacedTile[], hasIntro: boolean): TilePlacement {
  const placement: TilePlacement = new Map()
  const takenCells = new Set<number>()
  for (const tile of tiles) {
    const cell = tile.gridCell
    if (cell === null || cell < firstTileCell(hasIntro) || takenCells.has(cell)) continue
    placement.set(tile.id, cell)
    takenCells.add(cell)
  }
  const unplacedTiles = tiles.filter((tile) => !placement.has(tile.id))
  const freeCells = freePatternCells(unplacedTiles.length, hasIntro, takenCells)
  unplacedTiles.forEach((tile, index) => placement.set(tile.id, freeCells[index]!))
  return placement
}

/** The tiles come already sorted for the order; a search packs its matches. */
export function placeTiles(
  tiles: PlacedTile[],
  {
    order,
    isSearching,
    hasIntro,
    columnCount,
    random,
  }: { order: VaultOrder; isSearching: boolean; hasIntro: boolean; columnCount: number; random: () => number },
): TilePlacement {
  const tileIds = tiles.map((tile) => tile.id)
  if (isSearching) return packedPlacement(tileIds, hasIntro)
  if (order === 'random') return randomPlacement(tileIds, hasIntro, columnCount, random)
  if (order === 'custom') return customPlacement(tiles, hasIntro)
  return scatteredPlacement(tileIds, hasIntro)
}

/** The same random sequence for the same seed, so the random layout stays put until the grid is entered again. */
export function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}
