<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import SkeletonCards from '../components/SkeletonCards.vue'
import WebCard from '../components/WebCard.vue'
import { api, errorMessage, responseBody } from '../lib/api'
import { useCollections, useInvalidateAll } from '../lib/queries'

const props = defineProps<{ id: string }>()

const router = useRouter()
const { data: collections, isPending: isCollectionPending, error: collectionError } = useCollections()
const collection = computed(() => collections.value?.find((candidate) => candidate.id === props.id))

const { data: webs, isPending: areWebsPending, error: websError } = useQuery({
  queryKey: ['webs', { collection: computed(() => props.id) }],
  queryFn: () => responseBody(api.webs.$get({ query: { collection: props.id } })),
})

const webCountLabel = computed(() => {
  const webCount = webs.value?.length ?? collection.value?.webCount ?? 0
  return webCount === 1 ? '1 web' : `${webCount} webs`
})

const invalidateAll = useInvalidateAll()
const actionError = ref('')

async function renameCollection() {
  if (!collection.value) return
  const newName = prompt('New name', collection.value.name)?.trim()
  if (!newName || newName === collection.value.name) return
  actionError.value = ''
  try {
    await responseBody(api.collections[':id'].$patch({ param: { id: props.id }, json: { name: newName } }))
    await invalidateAll()
  } catch (error) {
    actionError.value = errorMessage(error)
  }
}

async function deleteCollection() {
  if (!collection.value) return
  if (!confirm(`Delete the collection "${collection.value.name}"? Its webs are kept.`)) return
  actionError.value = ''
  try {
    await responseBody(api.collections[':id'].$delete({ param: { id: props.id } }))
    await router.push({ name: 'collections' })
    await invalidateAll()
  } catch (error) {
    actionError.value = errorMessage(error)
  }
}
</script>

<template>
  <main class="page wide stack">
    <p v-if="collectionError" class="error">{{ collectionError.message }}</p>
    <p v-else-if="isCollectionPending">Loading…</p>
    <p v-else-if="!collection">
      This collection does not exist. <RouterLink :to="{ name: 'collections' }">See all collections</RouterLink>.
    </p>
    <template v-else>
      <div class="collection-header">
        <div class="collection-heading">
          <RouterLink :to="{ name: 'collections' }" class="collection-back">Collections</RouterLink>
          <h1 class="collection-name">{{ collection.name }}</h1>
        </div>
        <p class="collection-count">{{ webCountLabel }}</p>
        <div class="collection-actions">
          <button type="button" @click="renameCollection">Rename</button>
          <button type="button" @click="deleteCollection">Delete</button>
        </div>
      </div>
      <p v-if="actionError" class="error">{{ actionError }}</p>

      <p v-if="websError" class="error">{{ websError.message }}</p>
      <SkeletonCards v-else-if="areWebsPending" />
      <p v-else-if="!webs?.length">
        No webs in this collection yet. Add them from the edit page of each web.
      </p>
      <div v-else class="grid">
        <WebCard v-for="web in webs" :key="web.id" :web="web" />
      </div>
    </template>
  </main>
</template>
