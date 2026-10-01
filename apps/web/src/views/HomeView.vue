<script setup lang="ts">
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import WebCard from '../components/WebCard.vue'
import { api, responseBody } from '../lib/api'
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
  queryKey: ['webs', searchFilter, selectedTags, collectionFilter],
  queryFn: () =>
    responseBody(
      api.webs.$get({
        query: {
          search: searchFilter.value || undefined,
          tags: selectedTags.value.join(',') || undefined,
          collection: collectionFilter.value || undefined,
        },
      }),
    ),
  placeholderData: keepPreviousData,
})

const hasFilters = computed(() =>
  Boolean(searchFilter.value || selectedTags.value.length || collectionFilter.value),
)
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
    <p v-else-if="isPending">Loading…</p>
    <p v-else-if="!webs?.length && hasFilters">No webs match the filters.</p>
    <p v-else-if="!webs?.length">
      No webs saved yet. <RouterLink :to="{ name: 'new' }">Save the first one</RouterLink>.
    </p>

    <div class="grid">
      <WebCard v-for="web in webs" :key="web.id" :web="web" />
    </div>
  </main>
</template>
