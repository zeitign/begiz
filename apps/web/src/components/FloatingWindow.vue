<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  title: string
  x: number
  y: number
  /** null keeps the default width from the stylesheet. The height always follows the content. */
  width: number | null
  isMaximized: boolean
  stackOrder: number
  /** Where the window shrinks to when minimized. Without it, the window just disappears. */
  getMinimizeTargetRect?: () => DOMRect | undefined
}>()

const emit = defineEmits<{
  move: [x: number, y: number]
  resize: [x: number, width: number]
  focus: []
  minimize: []
  toggleMaximize: []
  close: []
}>()

type ResizeEdge = 'left' | 'right'
const RESIZE_EDGES: ResizeEdge[] = ['left', 'right']
const MIN_WIDTH = 280
const MINIMIZE_ANIMATION_MS = 320
/** Clockwise when the window sits right of its target, counterclockwise when it sits left. */
const MINIMIZE_ROTATION_DEG = 10
/** Lands a bit smaller than the card, so the window seems to drop into it. */
const MINIMIZE_EXTRA_SHRINK = 0.65

const windowElement = ref<HTMLElement | null>(null)
let dragStart: { pointerX: number; pointerY: number; windowX: number; windowY: number } | null = null
let resizeStart: { edge: ResizeEdge; pointerX: number; x: number; width: number } | null = null

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

function startResize(edge: ResizeEdge, event: PointerEvent) {
  const windowSize = windowElement.value?.getBoundingClientRect()
  if (!windowSize || event.button !== 0) return
  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
  resizeStart = { edge, pointerX: event.clientX, x: props.x, width: windowSize.width }
}

/** Dragging the left edge also moves the window, so the right edge stays in place. */
function resize(event: PointerEvent) {
  if (!resizeStart) return
  const deltaX = event.clientX - resizeStart.pointerX
  if (resizeStart.edge === 'right') {
    const width = clamp(resizeStart.width + deltaX, MIN_WIDTH, window.innerWidth - resizeStart.x)
    emit('resize', resizeStart.x, width)
  } else {
    const rightEdge = resizeStart.x + resizeStart.width
    const width = clamp(resizeStart.width - deltaX, MIN_WIDTH, rightEdge)
    emit('resize', rightEdge - width, width)
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
  return { left: `${props.x}px`, top: `${props.y}px`, zIndex, ...customWidth }
})
</script>

<template>
  <section
    ref="windowElement"
    class="window"
    :class="{ maximized: isMaximized }"
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
      <span class="window-title">{{ title }}</span>
      <div class="window-controls">
        <button type="button" title="Minimize" aria-label="Minimize" @click="minimize">_</button>
        <button
          type="button"
          :title="isMaximized ? 'Restore' : 'Maximize'"
          :aria-label="isMaximized ? 'Restore' : 'Maximize'"
          @click="emit('toggleMaximize')"
        >
          {{ isMaximized ? '❐' : '□' }}
        </button>
        <button type="button" title="Close" aria-label="Close" @click="emit('close')">×</button>
      </div>
    </header>
    <div class="window-body">
      <slot />
    </div>
    <template v-if="!isMaximized">
      <div
        v-for="edge in RESIZE_EDGES"
        :key="edge"
        class="window-resize-handle"
        :class="edge"
        @pointerdown="startResize(edge, $event)"
        @pointermove="resize"
        @pointerup="endResize"
        @pointercancel="endResize"
      />
    </template>
  </section>
</template>
