<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { VaultOrder } from '@webs/shared'
import { placeTiles, seededRandom, type TilePlacement } from '../lib/vaultLayout'
import VaultIcon from './VaultIcon.vue'

export type VaultTile = { id: string; name: string; icon: string; countLabel: string; gridCell: number | null }
export type PlacedCell = { folderId: string; gridCell: number }

const props = withDefaults(
  defineProps<{
    /** Already sorted for the order. */
    tiles: VaultTile[]
    order: VaultOrder
    /** While searching, only these tiles show, one after another; null shows them all. */
    matchingTileIds: Set<string> | null
    /** The tile standing in for a panel that is moving: it stays in place, invisible. */
    hiddenTileId: string | null
    /** The tile that just came back from its panel. */
    poppingTileId?: string | null
    /** While a tile opens or closes, the others fade out. */
    isHidingTiles: boolean
    /** False while a panel covers the board: the cells are not rendered. */
    showsTiles: boolean
    /** The home grid keeps its first cell for the intro. */
    hasIntro?: boolean
  }>(),
  { hasIntro: true, poppingTileId: null },
)
const emit = defineEmits<{ open: [tileId: string]; place: [cells: PlacedCell[]] }>()

/** A new random layout each time the grid is entered, which then stays put. */
const randomSeed = Math.floor(Math.random() * 2 ** 32)
/** While dragging, the empty cells after the last tile let it go further down. */
const EXTRA_CELLS_WHILE_DRAGGING = 10

const boardElement = ref<HTMLElement>()
/** The grid's columns change with the window (style.css); the random layout needs them to find the
 * cells around the intro. */
const columnCount = ref(1)
const readColumnCount = () => {
  if (boardElement.value) columnCount.value = getComputedStyle(boardElement.value).gridTemplateColumns.split(' ').length
}
const resizeObserver = new ResizeObserver(readColumnCount)
onMounted(() => {
  readColumnCount()
  if (boardElement.value) resizeObserver.observe(boardElement.value)
})
onBeforeUnmount(() => resizeObserver.disconnect())

const shownTiles = computed(() => {
  const { matchingTileIds } = props
  return matchingTileIds ? props.tiles.filter((tile) => matchingTileIds.has(tile.id)) : props.tiles
})
const placement = computed<TilePlacement>(() =>
  placeTiles(shownTiles.value, {
    order: props.order,
    isSearching: props.matchingTileIds !== null,
    hasIntro: props.hasIntro,
    columnCount: columnCount.value,
    random: seededRandom(randomSeed),
  }),
)

// Each time the search leaves a different set of tiles, they settle in their new places with a little
// wiggle, each its own way: which side it leans to first, how much, how fast and how late.
const isWiggling = ref(false)
const wiggleStyles = ref(new Map<string, Record<string, string>>())
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min)

function randomWiggle() {
  const side = Math.random() < 0.5 ? -1 : 1
  return {
    '--vault-wiggle-turn': `${side * randomBetween(1.5, 3.5)}deg`,
    '--vault-wiggle-duration': `${randomBetween(0.4, 0.65)}s`,
    '--vault-wiggle-delay': `${randomBetween(0, 0.12)}s`,
  }
}

watch(
  () => (props.matchingTileIds ? [...props.matchingTileIds].sort().join() : null),
  (matchKey, previousMatchKey) => {
    if (matchKey === null || matchKey === previousMatchKey) return
    wiggleStyles.value = new Map(shownTiles.value.map((tile) => [tile.id, randomWiggle()]))
    isWiggling.value = false
    requestAnimationFrame(() => (isWiggling.value = true))
  },
)

const canArrange = computed(() => props.order === 'custom' && props.matchingTileIds === null)
const draggedTileId = ref<string | null>(null)

type BoardCell = { kind: 'intro' } | { kind: 'gap'; cell: number } | { kind: 'tile'; cell: number; tile: VaultTile }

const boardCells = computed<BoardCell[]>(() => {
  const tileInCell = new Map(shownTiles.value.map((tile) => [placement.value.get(tile.id)!, tile]))
  const usedCellCount = Math.max(props.hasIntro ? 1 : 0, ...[...tileInCell.keys()].map((cell) => cell + 1))
  const cellCount = usedCellCount + (draggedTileId.value ? EXTRA_CELLS_WHILE_DRAGGING : 0)
  return Array.from({ length: cellCount }, (_, cell): BoardCell => {
    if (props.hasIntro && cell === 0) return { kind: 'intro' }
    const tile = tileInCell.get(cell)
    return tile ? { kind: 'tile', cell, tile } : { kind: 'gap', cell }
  })
})

const cellKey = (boardCell: BoardCell) =>
  boardCell.kind === 'tile' ? boardCell.tile.id : boardCell.kind === 'gap' ? `gap-${boardCell.cell}` : 'intro'

function startDragging(tileId: string, event: DragEvent) {
  draggedTileId.value = tileId
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', tileId)
}

/** Dropping on another tile swaps them. Every tile of the grid is saved, so none moves on its own afterwards. */
function dropOn(targetCell: number) {
  const tileId = draggedTileId.value
  draggedTileId.value = null
  const fromCell = tileId ? placement.value.get(tileId) : undefined
  if (!tileId || fromCell === undefined || fromCell === targetCell) return
  const cells = new Map(placement.value)
  for (const [otherTileId, cell] of cells) {
    if (cell === targetCell) cells.set(otherTileId, fromCell)
  }
  cells.set(tileId, targetCell)
  emit(
    'place',
    [...cells].map(([folderId, gridCell]) => ({ folderId, gridCell })),
  )
}

const tileElements = new Map<string, HTMLElement>()

function rememberTile(tileId: string, element: unknown) {
  if (element instanceof HTMLElement) tileElements.set(tileId, element)
  else tileElements.delete(tileId)
}

defineExpose({ boardElement, tileElement: (tileId: string) => tileElements.get(tileId) })
</script>

<template>
  <div
    ref="boardElement"
    class="vault-board"
    :class="{
      'hiding-tiles': isHidingTiles,
      'shows-panel': !showsTiles,
      'is-dragging': draggedTileId,
      'is-wiggling': isWiggling,
    }"
  >
    <template v-if="showsTiles">
      <template v-for="boardCell in boardCells" :key="cellKey(boardCell)">
        <div v-if="boardCell.kind === 'intro'" class="vault-intro">
          <slot name="intro" />
        </div>
        <div
          v-else-if="boardCell.kind === 'gap'"
          class="vault-gap"
          :class="{ crossed: draggedTileId }"
          aria-hidden="true"
          @dragover.prevent
          @drop.prevent="dropOn(boardCell.cell)"
        ></div>
        <article
          v-else
          :ref="(element) => rememberTile(boardCell.tile.id, element)"
          class="vault-tile"
          :class="{
            'is-hidden': boardCell.tile.id === hiddenTileId,
            'is-popping': boardCell.tile.id === poppingTileId,
            'is-dragged': boardCell.tile.id === draggedTileId,
          }"
          :style="isWiggling ? wiggleStyles.get(boardCell.tile.id) : undefined"
          @dragover.prevent
          @drop.prevent="dropOn(boardCell.cell)"
        >
          <div class="vault-identity">
            <h2 class="vault-identity-name">{{ boardCell.tile.name }}</h2>
            <span class="vault-identity-count">{{ boardCell.tile.countLabel }}</span>
            <VaultIcon :name="boardCell.tile.icon" />
          </div>
          <button
            type="button"
            class="vault-tile-open"
            :aria-label="`Open ${boardCell.tile.name}`"
            :draggable="canArrange"
            @dragstart="startDragging(boardCell.tile.id, $event)"
            @dragend="draggedTileId = null"
            @click="emit('open', boardCell.tile.id)"
          ></button>
        </article>
      </template>
    </template>
    <slot />
  </div>
</template>
