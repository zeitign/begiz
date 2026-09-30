<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import { api, call, errorMessage } from '../lib/api'
import { useCollections } from '../lib/queries'

const model = defineModel<string[]>({ required: true })

const queryClient = useQueryClient()
const { data: collections } = useCollections()

const newName = ref('')
const creating = ref(false)
const error = ref('')

function toggle(id: string, checked: boolean) {
  model.value = checked ? [...model.value, id] : model.value.filter((current) => current !== id)
}

async function create() {
  creating.value = true
  error.value = ''
  try {
    const collection = await call(api.collections.$post({ json: { name: newName.value } }))
    await queryClient.invalidateQueries({ queryKey: ['collections'] })
    model.value = [...model.value, collection.id]
    newName.value = ''
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <fieldset class="stack">
    <legend>Colecciones</legend>
    <p v-if="!collections?.length" class="muted">Todavía no hay colecciones.</p>
    <label v-for="collection in collections" :key="collection.id" class="check">
      <input
        type="checkbox"
        :checked="model.includes(collection.id)"
        @change="toggle(collection.id, ($event.target as HTMLInputElement).checked)"
      />
      {{ collection.name }}
    </label>
    <div class="row">
      <input
        v-model="newName"
        class="grow"
        placeholder="Nueva colección"
        @keydown.enter.prevent="newName.trim() && create()"
      />
      <button type="button" :disabled="!newName.trim() || creating" @click="create">Crear</button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
  </fieldset>
</template>
