<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import { api, errorMessage, responseBody } from '../lib/api'
import { useCollections } from '../lib/queries'

const selectedCollectionIds = defineModel<string[]>({ required: true })

const queryClient = useQueryClient()
const { data: collections } = useCollections()

const newCollectionName = ref('')
const creating = ref(false)
const createError = ref('')

function toggleCollection(collectionId: string, isChecked: boolean) {
  selectedCollectionIds.value = isChecked
    ? [...selectedCollectionIds.value, collectionId]
    : selectedCollectionIds.value.filter((selectedId) => selectedId !== collectionId)
}

async function createCollection() {
  creating.value = true
  createError.value = ''
  try {
    const collection = await responseBody(api.collections.$post({ json: { name: newCollectionName.value } }))
    await queryClient.invalidateQueries({ queryKey: ['collections'] })
    selectedCollectionIds.value = [...selectedCollectionIds.value, collection.id]
    newCollectionName.value = ''
  } catch (error) {
    createError.value = errorMessage(error)
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <fieldset class="stack">
    <legend>Collections</legend>
    <p v-if="!collections?.length" class="muted">No collections yet.</p>
    <label v-for="collection in collections" :key="collection.id" class="check">
      <input
        type="checkbox"
        :checked="selectedCollectionIds.includes(collection.id)"
        @change="toggleCollection(collection.id, ($event.target as HTMLInputElement).checked)"
      />
      {{ collection.name }}
    </label>
    <div class="row">
      <input
        v-model="newCollectionName"
        class="grow"
        placeholder="New collection"
        @keydown.enter.prevent="newCollectionName.trim() && createCollection()"
      />
      <button type="button" :disabled="!newCollectionName.trim() || creating" @click="createCollection">
        Create
      </button>
    </div>
    <p v-if="createError" class="error">{{ createError }}</p>
  </fieldset>
</template>
