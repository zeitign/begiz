import { computed, nextTick, ref } from 'vue'

// Opening a tile: it slides to the top-left corner of its board, narrowing to its column's width, and
// becomes the open panel there; its content then comes out of it (style.css). A tile that draws a frame
// first waits in the corner while the frame's lines come out of it (drawn by the view). Closing plays it
// backwards; a tile without a frame (a folder inside a category) closes instead by folding its column
// to the left, and then pops back in its grid. While it moves, the panel follows a box measured from the
// tile and the board.

type Box = { left: number; top: number; width: number; height: number }
type Phase = 'closed' | 'sliding' | 'drawing' | 'open' | 'shrinking' | 'returning' | 'collapsing'

const SLIDE_MS = 380
const GROW_MS = 450
/** As long as the vault-frame-draw animation in style.css. */
const DRAW_FRAME_MS = 600
const BOARD_GAP = 16
/** As long as the width transition of a floating panel in style.css. */
const COLLAPSE_MS = 450
/** As long as the vault-tile-pop animation in style.css. */
const POP_MS = 500

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const scrollBehavior = (): ScrollBehavior => (prefersReducedMotion() ? 'auto' : 'smooth')
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))
/** Waits until the current box is painted, so the next change animates from it. */
const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

const topLeftCorner = ({ width, height }: { width: number; height: number }): Box => ({
  left: 0,
  top: 0,
  width,
  height,
})
const wholeBoard = (board: HTMLElement): Box => ({
  left: 0,
  top: 0,
  width: board.offsetWidth,
  height: board.offsetHeight,
})

function boxOf(element: HTMLElement): Box {
  return { left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight }
}

/** The tile moves to the board's top-left corner, so the board's top has to be in view. */
function scrollBoardIntoView(board: HTMLElement) {
  const boardTop = board.getBoundingClientRect().top
  if (boardTop < 0) window.scrollTo({ top: window.scrollY + boardTop - BOARD_GAP, behavior: scrollBehavior() })
}

export function useTileExpansion(
  board: {
    element: () => HTMLElement | undefined
    tileElement: (tileId: string) => HTMLElement | undefined
  },
  {
    drawsFrame = false,
    cornerWidth,
  }: {
    drawsFrame?: boolean
    /** The width the tile narrows to while it slides to the corner. Without it, it keeps its own. */
    cornerWidth?: (tileId: string) => number
  } = {},
) {
  const phase = ref<Phase>('closed')
  const openTileId = ref<string | null>(null)
  const movingBox = ref<Box | null>(null)
  const tileSize = ref(0)
  /** From the moment it heads for the corner until it heads back: its card takes the open panel's sizes. */
  const isInCorner = ref(false)
  /** The tile that just came back to its grid, popping into place. */
  const poppingTileId = ref<string | null>(null)
  /** The tile that is back in its grid but has not popped yet: it stays hidden. */
  const waitingTileId = ref<string | null>(null)

  /** Where the tile waits, in the corner: as tall as it was, as wide as its column. */
  const cornerBox = (tileId: string): Box => ({
    ...topLeftCorner({ width: tileSize.value, height: tileSize.value }),
    width: cornerWidth?.(tileId) ?? tileSize.value,
  })

  async function open(tileId: string) {
    const tile = board.tileElement(tileId)
    const boardElement = board.element()
    if (phase.value !== 'closed' || !tile || !boardElement) return
    openTileId.value = tileId
    tileSize.value = tile.offsetWidth
    scrollBoardIntoView(boardElement)
    if (prefersReducedMotion()) {
      phase.value = 'open'
      isInCorner.value = true
      return
    }

    const tileBox = boxOf(tile)
    movingBox.value = tileBox
    phase.value = 'sliding'
    await nextPaint()
    movingBox.value = cornerBox(tileId)
    isInCorner.value = true
    await wait(SLIDE_MS)
    if (drawsFrame) {
      phase.value = 'drawing'
      await wait(DRAW_FRAME_MS)
    }
    phase.value = 'open'
    movingBox.value = null
  }

  /** Shows a tile already open, without motion: after a reload or with the back button. */
  function showOpen(tileId: string) {
    openTileId.value = tileId
    phase.value = 'open'
    isInCorner.value = true
  }

  function reset() {
    phase.value = 'closed'
    openTileId.value = null
    movingBox.value = null
    isInCorner.value = false
  }

  /** popDelay: how long the tile waits, hidden, before popping back (a column folding to the left closes
   * first, then whatever is beside it moves, then the tile pops). */
  async function close({ popDelay = 0 } = {}) {
    const boardElement = board.element()
    const tileId = openTileId.value
    if (phase.value !== 'open' || !boardElement || !tileId) return
    if (prefersReducedMotion()) {
      reset()
      return
    }

    if (!drawsFrame) {
      await collapse(tileId, boardElement, popDelay)
      return
    }

    // The panel floats again over the board, which comes back with its tiles hidden, so the tile can be
    // measured. The frame shrinks back into the card, which then returns to its place.
    movingBox.value = wholeBoard(boardElement)
    phase.value = 'shrinking'
    await nextTick()
    const tile = board.tileElement(tileId)
    if (!tile) {
      reset()
      return
    }
    await nextPaint()
    const tileBox = boxOf(tile)
    movingBox.value = cornerBox(tileId)
    await wait(GROW_MS)
    phase.value = 'returning'
    isInCorner.value = false
    movingBox.value = tileBox
    tile.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() })
    await wait(SLIDE_MS)
    reset()
  }

  /** The open column folds to the left until it is gone; then its tile pops back in the grid. */
  async function collapse(tileId: string, boardElement: HTMLElement, popDelay: number) {
    const column = { ...cornerBox(tileId), height: boardElement.offsetHeight }
    movingBox.value = column
    phase.value = 'collapsing'
    await nextPaint()
    movingBox.value = { ...column, width: 0 }
    await wait(COLLAPSE_MS)
    reset()
    waitingTileId.value = tileId
    await wait(popDelay)
    waitingTileId.value = null
    poppingTileId.value = tileId
    await wait(POP_MS)
    if (poppingTileId.value === tileId) poppingTileId.value = null
  }

  const isMoving = computed(() => phase.value !== 'open')
  /** Open, and until it has shrunk back: it has the panel's shape, not the tile's. */
  const isGrown = computed(() => ['open', 'shrinking', 'collapsing'].includes(phase.value))
  /** The tile waits in the corner while the frame's lines come out of it. */
  const isDrawingFrame = computed(() => phase.value === 'drawing')
  const isPanelShown = computed(() => phase.value !== 'closed')
  /** While a tile opens or closes, the others fade out; they fade back in as it returns to its place. */
  const isHidingTiles = computed(() => ['sliding', 'drawing', 'shrinking', 'collapsing'].includes(phase.value))
  /** Hidden tile: the panel stands in for it while it moves. */
  const hiddenTileId = computed(() => (phase.value === 'open' ? null : (openTileId.value ?? waitingTileId.value)))
  const showsTiles = computed(() => phase.value !== 'open')
  const panelStyle = computed(() => {
    // Unknown when it was shown open without motion (after a reload): the styles fall back to their own size.
    const tileSizeVariable = tileSize.value ? { '--vault-tile-size': `${tileSize.value}px` } : {}
    if (phase.value === 'open' || !movingBox.value) return tileSizeVariable
    const { left, top, width, height } = movingBox.value
    return { ...tileSizeVariable, left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` }
  })

  return {
    phase,
    openTileId,
    open,
    showOpen,
    close,
    reset,
    isMoving,
    isGrown,
    isDrawingFrame,
    isInCorner,
    poppingTileId,
    tileSize,
    isPanelShown,
    isHidingTiles,
    hiddenTileId,
    showsTiles,
    panelStyle,
  }
}
