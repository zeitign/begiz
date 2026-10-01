<script setup lang="ts">
import { ref } from 'vue'
import { api, errorMessage, responseBody, type Collection } from '../lib/api'
import { useCollections, useInvalidateAll } from '../lib/queries'

const { data: collections, isPending } = useCollections()
const invalidateAll = useInvalidateAll()
const actionError = ref('')

async function runAndRefresh(action: () => Promise<unknown>) {
  actionError.value = ''
  try {
    await action()
    await invalidateAll()
  } catch (error) {
    actionError.value = errorMessage(error)
  }
}

function renameCollection(collection: Collection) {
  const newName = prompt('New name', collection.name)?.trim()
  if (!newName || newName === collection.name) return
  runAndRefresh(() =>
    responseBody(api.collections[':id'].$patch({ param: { id: collection.id }, json: { name: newName } })),
  )
}

function deleteCollection(collection: Collection) {
  if (!confirm(`Delete the collection "${collection.name}"? Its webs are kept.`)) return
  runAndRefresh(() => responseBody(api.collections[':id'].$delete({ param: { id: collection.id } })))
}
</script>

<template>
  <main class="page narrow stack">
    <h1>Collections</h1>
    <p class="muted">Collections are created when saving or editing a web.</p>
    <p v-if="isPending">Loading…</p>
    <p v-else-if="!collections?.length">No collections yet.</p>
    <div v-for="collection in collections" :key="collection.id" class="row">
      <RouterLink class="grow" :to="{ name: 'home', query: { collection: collection.id } }">
        {{ collection.name }}
      </RouterLink>
      <span class="muted">{{ collection.webCount }} webs</span>
      <button type="button" @click="renameCollection(collection)">Rename</button>
      <button type="button" @click="deleteCollection(collection)">Delete</button>
    </div>
    <p v-if="actionError" class="error">{{ actionError }}</p>
  </main>
</template>
