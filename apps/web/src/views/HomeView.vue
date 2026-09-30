<script setup lang="ts">
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import WebCard from '../components/WebCard.vue'
import { api, call } from '../lib/api'
import { useCollections, useTags } from '../lib/queries'

// Los filtros viven en la URL: se pueden recargar, compartir y volver atrás.
const route = useRoute()
const router = useRouter()

const q = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))
const selectedTags = computed(() =>
  typeof route.query.tags === 'string' ? route.query.tags.split(',').filter(Boolean) : [],
)
const collection = computed(() =>
  typeof route.query.collection === 'string' ? route.query.collection : '',
)

function setFilters(patch: LocationQueryRaw) {
  const query = { ...route.query, ...patch }
  for (const key of Object.keys(query)) if (!query[key]) delete query[key]
  router.replace({ query })
}

const search = ref(q.value)
let debounce: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(debounce)
  debounce = setTimeout(() => setFilters({ q: value.trim() }), 250)
})

function toggleTag(name: string) {
  const tags = selectedTags.value.includes(name)
    ? selectedTags.value.filter((tag) => tag !== name)
    : [...selectedTags.value, name]
  setFilters({ tags: tags.join(',') })
}

const { data: tags } = useTags()
const { data: collections } = useCollections()
const { data: webs, isPending, error } = useQuery({
  queryKey: ['webs', q, selectedTags, collection],
  queryFn: () =>
    call(
      api.webs.$get({
        query: {
          q: q.value || undefined,
          tags: selectedTags.value.join(',') || undefined,
          collection: collection.value || undefined,
        },
      }),
    ),
  placeholderData: keepPreviousData,
})

const hasFilters = computed(() => Boolean(q.value || selectedTags.value.length || collection.value))
</script>

<template>
  <main class="page stack">
    <div class="row">
      <input v-model="search" type="search" class="grow" placeholder="Buscar por título" />
      <select :value="collection" @change="setFilters({ collection: ($event.target as HTMLSelectElement).value })">
        <option value="">Todas las colecciones</option>
        <option v-for="item in collections" :key="item.id" :value="item.id">
          {{ item.name }} ({{ item.webCount }})
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
    <p v-else-if="isPending">Cargando…</p>
    <p v-else-if="!webs?.length && hasFilters">Ninguna web coincide con los filtros.</p>
    <p v-else-if="!webs?.length">
      Aún no hay webs guardadas. <RouterLink :to="{ name: 'new' }">Guarda la primera</RouterLink>.
    </p>

    <div class="grid">
      <WebCard v-for="web in webs" :key="web.id" :web="web" />
    </div>
  </main>
</template>
