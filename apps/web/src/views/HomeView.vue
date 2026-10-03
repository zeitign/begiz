<script setup lang="ts">
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  defaultSortDirection,
  webSortModes,
  type SortDirection,
  type WebSortMode,
} from '@webs/shared'
import { computed, ref, watch } from 'vue'
import { VueDraggable, type DraggableEvent } from 'vue-draggable-plus'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import WebCard from '../components/WebCard.vue'
import { api, errorMessage, responseBody, type WebCard as WebCardData } from '../lib/api'
import { useCollections, useTags } from '../lib/queries'

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
  title: 'Title',
  collection: 'Collection',
  date: 'Date added',
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

function reverseSortDirection() {
  updateFilters({ direction: sortDirection.value === 'asc' ? 'desc' : 'asc' })
}

function updateFilters(changedFilters: LocationQueryRaw) {
  const nextQuery = { ...route.query, ...changedFilters }
  for (const key of Object.keys(nextQuery)) if (!nextQuery[key]) delete nextQuery[key]
  router.replace({ query: nextQuery })
}

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
const { data: collections } = useCollections()
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
  <main class="page stack">
    <div class="row">
      <input v-model="searchInput" type="search" class="grow" placeholder="Search by title" />
      <select
        :value="collectionFilter"
        @change="updateFilters({ collection: ($event.target as HTMLSelectElement).value })"
      >
        <option value="">All collections</option>
        <option v-for="collection in collections" :key="collection.id" :value="collection.id">
          {{ collection.name }} ({{ collection.webCount }})
        </option>
      </select>
      <select
        :value="sortMode"
        aria-label="Sort by"
        @change="changeSortMode(($event.target as HTMLSelectElement).value as WebSortMode)"
      >
        <option v-for="mode in webSortModes" :key="mode" :value="mode">{{ SORT_MODE_LABELS[mode] }}</option>
      </select>
      <button
        v-if="!isCustomOrder"
        type="button"
        :title="sortDirection === 'asc' ? 'Ascending' : 'Descending'"
        :aria-label="sortDirection === 'asc' ? 'Ascending, click to reverse' : 'Descending, click to reverse'"
        @click="reverseSortDirection"
      >
        {{ sortDirection === 'asc' ? '↑' : '↓' }}
      </button>
    </div>

    <div v-if="tags?.length" class="row">
      <button
        v-for="tag in tags"
        :key="tag.name"
        type="button"
        class="chip"
        :class="{ active: selectedTags.includes(tag.name) }"
        @click="toggleTag(tag.name)"
      >
        {{ tag.name }} ({{ tag.webCount }})
      </button>
    </div>

    <p v-if="error" class="error">{{ error.message }}</p>
    <p v-else-if="moveError" class="error">{{ moveError }}</p>
    <p v-else-if="isPending">Loading…</p>
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
