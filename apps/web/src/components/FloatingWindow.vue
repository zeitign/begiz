<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  title: string
  x: number
  y: number
  /** null keeps the default width from the stylesheet. */
  width: number | null
  /** null lets the height follow the content. */
  height: number | null
  isMaximized: boolean
  /** The window in front of the others: its title bar shows a blinking recording dot. */
  isActive: boolean
  stackOrder: number
  /** Where the window shrinks to when minimized. Without it, the window just disappears. */
  getMinimizeTargetRect?: () => DOMRect | undefined
}>()

const emit = defineEmits<{
  move: [x: number, y: number]
  resize: [x: number, width: number]
  resizeHeight: [height: number]
  focus: []
  minimize: []
  toggleMaximize: []
  close: []
}>()

type ResizeHandle = 'left' | 'right' | 'bottom' | 'bottom-left' | 'bottom-right'
const RESIZE_HANDLES: ResizeHandle[] = ['left', 'right', 'bottom', 'bottom-left', 'bottom-right']
const MIN_WIDTH = 280
const MIN_HEIGHT = 200
const MINIMIZE_ANIMATION_MS = 320
/** Clockwise when the window sits right of its target, counterclockwise when it sits left. */
const MINIMIZE_ROTATION_DEG = 10
/** Lands a bit smaller than the card, so the window seems to drop into it. */
const MINIMIZE_EXTRA_SHRINK = 0.65

const windowElement = ref<HTMLElement | null>(null)
let dragStart: { pointerX: number; pointerY: number; windowX: number; windowY: number } | null = null
let resizeStart: {
  handle: ResizeHandle
  pointerX: number
  pointerY: number
  x: number
  width: number
  height: number
} | null = null

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/** Moves the window to (x, y), shifted as little as needed to keep it fully inside the browser. */
function moveInsideViewport(x: number, y: number) {
  const windowSize = windowElement.value?.getBoundingClientRect()
  if (!windowSize) return
  const maxX = Math.max(0, window.innerWidth - windowSize.width)
  const maxY = Math.max(0, window.innerHeight - windowSize.height)
  emit('move', clamp(x, 0, maxX), clamp(y, 0, maxY))
}

function startDrag(event: PointerEvent) {
  const pressedButton = (event.target as Element).closest('button')
  if (props.isMaximized || pressedButton || event.button !== 0) return
  const titleBar = event.currentTarget as HTMLElement
  titleBar.setPointerCapture(event.pointerId)
  dragStart = { pointerX: event.clientX, pointerY: event.clientY, windowX: props.x, windowY: props.y }
}

function drag(event: PointerEvent) {
  if (!dragStart) return
  moveInsideViewport(
    dragStart.windowX + event.clientX - dragStart.pointerX,
    dragStart.windowY + event.clientY - dragStart.pointerY,
  )
}

function endDrag() {
  dragStart = null
}

function startResize(handle: ResizeHandle, event: PointerEvent) {
  const windowSize = windowElement.value?.getBoundingClientRect()
  if (!windowSize || event.button !== 0) return
  const handleElement = event.currentTarget as HTMLElement
  handleElement.setPointerCapture(event.pointerId)
  resizeStart = {
    handle,
    pointerX: event.clientX,
    pointerY: event.clientY,
    x: props.x,
    width: windowSize.width,
    height: windowSize.height,
  }
}

/**
 * A bottom corner resizes like its side edge and the bottom edge at once. Dragging the left side also
 * moves the window, so the right edge stays in place.
 */
function resize(event: PointerEvent) {
  if (!resizeStart) return
  const { handle } = resizeStart
  const deltaX = event.clientX - resizeStart.pointerX
  if (handle === 'right' || handle === 'bottom-right') {
    const width = clamp(resizeStart.width + deltaX, MIN_WIDTH, window.innerWidth - resizeStart.x)
    emit('resize', resizeStart.x, width)
  }
  if (handle === 'left' || handle === 'bottom-left') {
    const rightEdge = resizeStart.x + resizeStart.width
    const width = clamp(resizeStart.width - deltaX, MIN_WIDTH, rightEdge)
    emit('resize', rightEdge - width, width)
  }
  if (handle.startsWith('bottom')) {
    const height = resizeStart.height + event.clientY - resizeStart.pointerY
    emit('resizeHeight', clamp(height, MIN_HEIGHT, window.innerHeight - props.y))
  }
}

function endResize() {
  resizeStart = null
}

async function minimize() {
  const windowRect = windowElement.value?.getBoundingClientRect()
  const targetRect = props.getMinimizeTargetRect?.()
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (windowElement.value && windowRect && targetRect && !prefersReducedMotion) {
    const centerOffsetX = targetRect.left + targetRect.width / 2 - (windowRect.left + windowRect.width / 2)
    const centerOffsetY = targetRect.top + targetRect.height / 2 - (windowRect.top + windowRect.height / 2)
    const scaleX = (targetRect.width / windowRect.width) * MINIMIZE_EXTRA_SHRINK
    const scaleY = (targetRect.height / windowRect.height) * MINIMIZE_EXTRA_SHRINK
    const isWindowRightOfTarget = centerOffsetX <= 0
    const rotationDeg = isWindowRightOfTarget ? MINIMIZE_ROTATION_DEG : -MINIMIZE_ROTATION_DEG
    // Same transform functions in both keyframes, so each one is interpolated on its own.
    await windowElement.value.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg) scale(1, 1)', opacity: 1 },
        {
          transform: `translate(${centerOffsetX}px, ${centerOffsetY}px) rotate(${rotationDeg}deg) scale(${scaleX}, ${scaleY})`,
          opacity: 0.2,
        },
      ],
      { duration: MINIMIZE_ANIMATION_MS, easing: 'ease-in' },
    ).finished
  }
  emit('minimize')
}

// The window grows when its image loads or it gets wider, which could push it off screen.
const sizeObserver = new ResizeObserver(() => {
  if (!props.isMaximized) moveInsideViewport(props.x, props.y)
})
onMounted(() => sizeObserver.observe(windowElement.value!))
onBeforeUnmount(() => sizeObserver.disconnect())

const windowStyle = computed(() => {
  const zIndex = 100 + props.stackOrder
  if (props.isMaximized) return { zIndex }
  const customWidth = props.width ? { width: `${props.width}px` } : {}
  const customHeight = props.height ? { height: `${props.height}px` } : {}
  return { left: `${props.x}px`, top: `${props.y}px`, zIndex, ...customWidth, ...customHeight }
})
</script>

<template>
  <section
    ref="windowElement"
    class="window"
    :class="{ maximized: isMaximized, active: isActive }"
    :style="windowStyle"
    role="dialog"
    :aria-label="title"
    @pointerdown="emit('focus')"
  >
    <header
      class="window-titlebar"
      @pointerdown="startDrag"
      @pointermove="drag"
      @pointerup="endDrag"
      @pointercancel="endDrag"
    >
      <span class="window-recording-dot" aria-hidden="true"></span>
      <span class="window-title">{{ title }}</span>
      <div class="window-controls">
        <button type="button" title="Minimize" aria-label="Minimize" @click="minimize">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M3 12h10" />
          </svg>
        </button>
        <button
          type="button"
          :title="isMaximized ? 'Restore' : 'Maximize'"
          :aria-label="isMaximized ? 'Restore' : 'Maximize'"
          @click="emit('toggleMaximize')"
        >
          <svg v-if="isMaximized" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M3 6h7v7H3z" />
            <path d="M6 6V3h7v7h-3" />
          </svg>
          <svg v-else viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M3 3h10v10H3z" />
          </svg>
        </button>
        <button type="button" title="Close" aria-label="Close" @click="emit('close')">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </button>
      </div>
    </header>
    <div class="window-body">
      <slot />
    </div>
    <template v-if="!isMaximized">
      <div
        v-for="handle in RESIZE_HANDLES"
        :key="handle"
        class="window-resize-handle"
        :class="handle"
        @pointerdown="startResize(handle, $event)"
        @pointermove="resize"
        @pointerup="endResize"
        @pointercancel="endResize"
      />
    </template>
  </section>
</template>
