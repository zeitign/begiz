<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { api, responseBody } from '../lib/api'
import {
  activeInfoWindowId,
  bringInfoWindowToFront,
  closeInfoWindow,
  minimizeInfoWindow,
  moveInfoWindow,
  resizeInfoWindow,
  resizeInfoWindowDetails,
  resizeInfoWindowHeight,
  toggleMaximizeInfoWindow,
  type InfoWindow,
} from '../lib/infoWindows'
import FloatingWindow from './FloatingWindow.vue'
import WebThumb from './WebThumb.vue'

const props = defineProps<{ infoWindow: InfoWindow }>()

const webId = computed(() => props.infoWindow.webId)
const { data: web, error: loadError } = useQuery({
  queryKey: computed(() => ['web', webId.value]),
  queryFn: () => responseBody(api.webs[':id'].$get({ param: { id: webId.value } })),
})

const getCardRect = () =>
  document.querySelector(`[data-web-id="${webId.value}"]`)?.getBoundingClientRect()

const fullImageUrl = computed(() => web.value?.fullUrl ?? web.value?.previewUrl ?? null)

const MIN_DETAILS_COLUMN_WIDTH = 300
const MIN_IMAGE_COLUMN_WIDTH = 280
const MIN_SIDE_BY_SIDE_WIDTH = 700
/** Height divided by width, as in the .thumb placeholder shown when the web has no image. */
const PLACEHOLDER_ASPECT_RATIO = 3 / 4
/** A full-page capture would open a window as tall as the screen; it opens at 4:3 and scrolls. */
const MAX_OPENING_ASPECT_RATIO = 3 / 4
/** Scrolling this far hides the hint arrow. */
const SCROLL_HINT_HIDE_OFFSET = 8

const imageAspectRatio = ref<number | null>(null)
function readImageAspectRatio(event: Event) {
  const image = event.target as HTMLImageElement
  imageAspectRatio.value = image.naturalHeight / image.naturalWidth
}

const layoutElement = ref<HTMLElement | null>(null)
const mediaElement = ref<HTMLElement | null>(null)
const detailsElement = ref<HTMLElement | null>(null)
const layoutSize = reactive({ width: 0, height: 0 })
const detailsHeight = ref(0)
const layoutScroll = reactive({ top: 0, maxTop: 0 })

function readLayoutScroll() {
  const layout = layoutElement.value
  if (!layout) return
  layoutScroll.top = layout.scrollTop
  layoutScroll.maxTop = layout.scrollHeight - layout.clientHeight
}

// The children are watched too: the image loading or the layout switching changes how far it scrolls.
const layoutObserver = new ResizeObserver(() => {
  layoutSize.width = layoutElement.value?.clientWidth ?? 0
  layoutSize.height = layoutElement.value?.clientHeight ?? 0
  detailsHeight.value = detailsElement.value?.offsetHeight ?? 0
  readLayoutScroll()
})
watch(layoutElement, (element) => {
  layoutObserver.disconnect()
  if (!element) return
  for (const observedElement of [element, ...element.children]) layoutObserver.observe(observedElement)
})
onBeforeUnmount(() => layoutObserver.disconnect())

const shownAspectRatio = computed(() =>
  fullImageUrl.value ? imageAspectRatio.value : PLACEHOLDER_ASPECT_RATIO,
)

/** The user can widen the details column by dragging its left edge; the image gives up the space. */
function fitDetailsColumnWidth(width: number) {
  const maxWidth = Math.max(MIN_DETAILS_COLUMN_WIDTH, layoutSize.width - MIN_IMAGE_COLUMN_WIDTH)
  return Math.min(Math.max(width, MIN_DETAILS_COLUMN_WIDTH), maxWidth)
}

const detailsColumnWidth = computed(() =>
  fitDetailsColumnWidth(props.infoWindow.detailsWidth ?? MIN_DETAILS_COLUMN_WIDTH),
)

let detailsResizeStart: { pointerX: number; width: number } | null = null

function startDetailsResize(event: PointerEvent) {
  if (event.button !== 0) return
  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
  detailsResizeStart = { pointerX: event.clientX, width: detailsColumnWidth.value }
}

/** Dragging to the left widens the column. */
function resizeDetails(event: PointerEvent) {
  if (!detailsResizeStart) return
  const width = detailsResizeStart.width - (event.clientX - detailsResizeStart.pointerX)
  resizeInfoWindowDetails(webId.value, fitDetailsColumnWidth(width))
}

function endDetailsResize() {
  detailsResizeStart = null
}

/** Full screen shows the image at full width; a narrow window has no room for two columns. */
const showsDetailsBelowImage = computed(
  () =>
    props.infoWindow.isMaximized ||
    (layoutSize.width > 0 && layoutSize.width < MIN_SIDE_BY_SIDE_WIDTH),
)

/** Until the user sets a height, a tall image does not stretch the window beyond 4:3. */
const openingMaxHeight = computed(() => {
  if (props.infoWindow.height || showsDetailsBelowImage.value || layoutSize.width === 0) return null
  return (layoutSize.width - detailsColumnWidth.value) * MAX_OPENING_ASPECT_RATIO
})

/** Read by the stylesheet to keep the title in view while the image scrolls (see .details-below). */
const imageHeight = computed(() => layoutSize.width * (shownAspectRatio.value ?? 0))

/** Details below and still unscrolled: an arrow next to the title tells there is more underneath. */
const showsScrollHint = computed(
  () =>
    showsDetailsBelowImage.value &&
    layoutScroll.maxTop > 0 &&
    layoutScroll.top < SCROLL_HINT_HIDE_OFFSET,
)

/** Scrolls until the details reach the top, right where the image ends. */
function scrollToDetails() {
  const layout = layoutElement.value
  const media = mediaElement.value
  if (!layout || !media) return
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  layout.scrollTo({
    top: media.offsetHeight,
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  })
}
</script>

<template>
  <FloatingWindow
    :title="web?.title ?? 'Loading…'"
    :x="infoWindow.x"
    :y="infoWindow.y"
    :width="infoWindow.width"
    :height="infoWindow.height"
    :is-maximized="infoWindow.isMaximized"
    :is-active="activeInfoWindowId === webId"
    :stack-order="infoWindow.stackOrder"
    :get-minimize-target-rect="getCardRect"
    @move="(x, y) => moveInfoWindow(webId, x, y)"
    @resize="(x, width) => resizeInfoWindow(webId, x, width)"
    @resize-height="(height) => resizeInfoWindowHeight(webId, height)"
    @focus="bringInfoWindowToFront(webId)"
    @minimize="minimizeInfoWindow(webId)"
    @toggle-maximize="toggleMaximizeInfoWindow(webId)"
    @close="closeInfoWindow(webId)"
  >
    <p v-if="loadError" class="error window-message">{{ loadError.message }}</p>
    <p v-else-if="!web" class="window-message">Loading…</p>

    <article
      v-else
      ref="layoutElement"
      class="web-info"
      :class="{ 'details-below': showsDetailsBelowImage }"
      :style="{
        '--details-column-width': `${detailsColumnWidth}px`,
        '--image-height': `${imageHeight}px`,
        '--details-height': `${detailsHeight}px`,
        maxHeight: openingMaxHeight ? `${openingMaxHeight}px` : undefined,
      }"
      @scroll="readLayoutScroll"
    >
      <div ref="mediaElement" class="web-info-media">
        <img v-if="fullImageUrl" :src="fullImageUrl" alt="" @load="readImageAspectRatio" />
        <WebThumb v-else :web="web" />
      </div>

      <div
        v-if="!showsDetailsBelowImage"
        class="web-info-details-resizer"
        title="Drag to widen"
        @pointerdown="startDetailsResize"
        @pointermove="resizeDetails"
        @pointerup="endDetailsResize"
        @pointercancel="endDetailsResize"
      />
      <div ref="detailsElement" class="web-info-details">
        <button
          v-if="showsScrollHint"
          type="button"
          class="web-info-scroll-hint"
          title="Scroll to the details"
          aria-label="Scroll to the details"
          @click="scrollToDetails"
        >
          <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
            <path d="M4 8l8 8 8-8" />
          </svg>
        </button>
        <div class="web-info-text">
          <h2 class="web-info-title">{{ web.title }}</h2>
          <p class="web-info-url">{{ web.url }}</p>
          <p v-if="web.notes" class="web-info-notes">{{ web.notes }}</p>
        </div>
        <div class="web-info-footer">
          <div class="web-info-tags">
            <span v-for="tag in web.tags" :key="tag" class="chip">{{ tag }}</span>
          </div>
          <a :href="web.url" target="_blank" rel="noopener noreferrer" class="web-info-open">
            Open web
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path d="M14 4h6v6" />
              <path d="M20 4L10 14" />
              <path d="M18 14v6H4V6h6" />
            </svg>
          </a>
        </div>
      </div>
    </article>
  </FloatingWindow>
</template>
