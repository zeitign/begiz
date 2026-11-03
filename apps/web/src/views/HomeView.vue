<script setup lang="ts">
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  defaultSortDirection,
  sortDirections,
  webSortModes,
  type SortDirection,
  type WebSortMode,
} from '@webs/shared'
import { computed, ref, watch } from 'vue'
import { VueDraggable, type DraggableEvent } from 'vue-draggable-plus'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import FilterDropdown from '../components/FilterDropdown.vue'
import SkeletonCards from '../components/SkeletonCards.vue'
import WebCard from '../components/WebCard.vue'
import { api, errorMessage, responseBody, type WebCard as WebCardData } from '../lib/api'
import { useTags } from '../lib/queries'
import { useTypewriter } from '../lib/typewriter'

// Filters live in the URL, so they survive reloads, can be shared and work with the back button.
const route = useRoute()
const router = useRouter()

const searchFilter = computed(() => (typeof route.query.search === 'string' ? route.query.search : ''))
const selectedTags = computed(() =>
  typeof route.query.tags === 'string' ? route.query.tags.split(',').filter(Boolean) : [],
)
const collectionFilter = computed(() =>
  typeof route.query.collection === 'string' ? route.query.collection : '',
)

const SORT_MODE_LABELS: Record<WebSortMode, string> = {
  custom: 'Custom order',
  date: 'Date added',
  title: 'Title',
}

const SORT_DIRECTION_LABELS: Record<SortDirection, string> = {
  asc: '↑ Asc',
  desc: '↓ Desc',
}

const isSortMode = (value: unknown): value is WebSortMode =>
  webSortModes.includes(value as WebSortMode)
const sortMode = computed<WebSortMode>(() => (isSortMode(route.query.sort) ? route.query.sort : 'custom'))
const sortDirection = computed<SortDirection>(() =>
  route.query.direction === 'asc' || route.query.direction === 'desc'
    ? route.query.direction
    : defaultSortDirection[sortMode.value],
)
const isCustomOrder = computed(() => sortMode.value === 'custom')

function changeSortMode(nextSortMode: WebSortMode) {
  updateFilters({ sort: nextSortMode === 'custom' ? '' : nextSortMode, direction: '' })
}

function updateFilters(changedFilters: LocationQueryRaw) {
  const nextQuery = { ...route.query, ...changedFilters }
  for (const key of Object.keys(nextQuery)) if (!nextQuery[key]) delete nextQuery[key]
  router.replace({ query: nextQuery })
}

const SEARCH_PLACEHOLDERS = [
  'THAT WEB?',
  'THE INSPIRATION?',
  'THAT PORTFOLIO?',
  'THAT TYPEFACE?',
  'THAT LANDING?',
  'THE GOOD ONE?',
]
const searchPlaceholder = useTypewriter(SEARCH_PLACEHOLDERS)

const searchInput = ref(searchFilter.value)
let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (typedSearch) => {
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => updateFilters({ search: typedSearch.trim() }), 250)
})

function toggleTag(name: string) {
  const nextTags = selectedTags.value.includes(name)
    ? selectedTags.value.filter((tag) => tag !== name)
    : [...selectedTags.value, name]
  updateFilters({ tags: nextTags.join(',') })
}

const { data: tags } = useTags()
const { data: webs, isPending, error } = useQuery({
  queryKey: ['webs', searchFilter, selectedTags, collectionFilter, sortMode, sortDirection],
  queryFn: () =>
    responseBody(
      api.webs.$get({
        query: {
          search: searchFilter.value || undefined,
          tags: selectedTags.value.join(',') || undefined,
          collection: collectionFilter.value || undefined,
          sort: sortMode.value,
          direction: isCustomOrder.value ? undefined : sortDirection.value,
        },
      }),
    ),
  placeholderData: keepPreviousData,
})

const tagsLabel = computed(() =>
  selectedTags.value.length > 0 ? `Tags · ${selectedTags.value.length}` : 'Tags',
)

const webCountLabel = computed(() => {
  if (!webs.value) return ''
  return webs.value.length === 1 ? '1 web' : `${webs.value.length} webs`
})

const hasFilters = computed(() =>
  Boolean(searchFilter.value || selectedTags.value.length || collectionFilter.value),
)

// Local copy that the drag and drop reorders right away, before the API answers.
const orderedWebs = ref<WebCardData[]>([])
watch(webs, (loadedWebs) => (orderedWebs.value = [...(loadedWebs ?? [])]), { immediate: true })

const queryClient = useQueryClient()
const moveError = ref('')
const isDraggingCard = ref(false)

/** By the time the drop ends, orderedWebs is already in its new order. */
async function saveDroppedPosition(event: DraggableEvent) {
  isDraggingCard.value = false
  if (event.oldIndex === event.newIndex || event.newIndex === undefined) return
  const movedWeb = orderedWebs.value[event.newIndex]
  if (!movedWeb) return
  const previousWeb = orderedWebs.value[event.newIndex - 1]
  moveError.value = ''
  try {
    await responseBody(
      api.webs[':id'].position.$put({
        param: { id: movedWeb.id },
        json: { afterWebId: previousWeb?.id ?? null },
      }),
    )
  } catch (error) {
    moveError.value = errorMessage(error)
    orderedWebs.value = [...(webs.value ?? [])]
  }
  await queryClient.invalidateQueries({ queryKey: ['webs'] })
}
</script>

<template>
  <main class="page wide stack">
    <div class="filter-bar">
      <div class="search-sentence">
        <label for="mosaic-search" class="search-sentence-text">I'm gonna search</label>
        <div class="search-box">
          <input
            id="mosaic-search"
            v-model="searchInput"
            type="search"
            :placeholder="searchPlaceholder.displayedText.value"
            @focus="searchPlaceholder.pause"
            @blur="searchPlaceholder.resume"
          />
          <span class="filter-stripes" aria-hidden="true"></span>
        </div>
        <span class="search-sentence-text">in this mosaic</span>
      </div>
      <div class="filter-frame">
        <div class="filter-cells">
          <FilterDropdown :label="tagsLabel">
            <label v-for="tag in tags" :key="tag.name" class="filter-option">
              <input type="checkbox" :checked="selectedTags.includes(tag.name)" @change="toggleTag(tag.name)" />
              <span>{{ tag.name }}</span>
              <span class="filter-option-count">{{ tag.webCount }}</span>
            </label>
            <p v-if="!tags?.length" class="filter-option muted">No tags yet.</p>
          </FilterDropdown>
          <FilterDropdown label="Order">
            <label v-for="mode in webSortModes" :key="mode" class="filter-option">
              <input type="radio" name="web-order" :checked="sortMode === mode" @change="changeSortMode(mode)" />
              <span>{{ SORT_MODE_LABELS[mode] }}</span>
            </label>
            <div v-if="!isCustomOrder" class="order-direction" role="group" aria-label="Direction">
              <button
                v-for="direction in sortDirections"
                :key="direction"
                type="button"
                :aria-pressed="sortDirection === direction"
                @click="updateFilters({ direction })"
              >
                {{ SORT_DIRECTION_LABELS[direction] }}
              </button>
            </div>
          </FilterDropdown>
          <p class="filter-count">{{ webCountLabel }}</p>
        </div>
        <span class="filter-stripes" aria-hidden="true"></span>
      </div>
    </div>

    <p v-if="error" class="error">{{ error.message }}</p>
    <p v-else-if="moveError" class="error">{{ moveError }}</p>
    <SkeletonCards v-else-if="isPending" />
    <p v-else-if="!webs?.length && hasFilters">No webs match the filters.</p>
    <p v-else-if="!webs?.length">
      No webs saved yet. <RouterLink :to="{ name: 'new' }">Save the first one</RouterLink>.
    </p>

    <VueDraggable
      v-model="orderedWebs"
      class="grid"
      :class="{ 'custom-order': isCustomOrder, 'dragging-card': isDraggingCard }"
      :disabled="!isCustomOrder"
      handle=".card-body"
      :animation="150"
      :delay="200"
      :delay-on-touch-only="true"
      :force-fallback="true"
      :fallback-on-body="true"
      @start="isDraggingCard = true"
      @end="saveDroppedPosition"
    >
      <WebCard v-for="web in orderedWebs" :key="web.id" :web="web" />
    </VueDraggable>
  </main>
</template>
