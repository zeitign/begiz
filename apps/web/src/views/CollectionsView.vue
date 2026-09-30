<script setup lang="ts">
import { ref } from 'vue'
import { api, call, errorMessage, type Collection } from '../lib/api'
import { useCollections, useInvalidateAll } from '../lib/queries'

const { data: collections, isPending } = useCollections()
const invalidateAll = useInvalidateAll()
const error = ref('')

async function run(action: () => Promise<unknown>) {
  error.value = ''
  try {
    await action()
    await invalidateAll()
  } catch (err) {
    error.value = errorMessage(err)
  }
}

function rename(collection: Collection) {
  const name = prompt('Nuevo nombre', collection.name)?.trim()
  if (!name || name === collection.name) return
  run(() => call(api.collections[':id'].$patch({ param: { id: collection.id }, json: { name } })))
}

function remove(collection: Collection) {
  if (!confirm(`¿Borrar la colección "${collection.name}"? Las webs no se borran.`)) return
  run(() => call(api.collections[':id'].$delete({ param: { id: collection.id } })))
}
</script>

<template>
  <main class="page narrow stack">
    <h1>Colecciones</h1>
    <p class="muted">Las colecciones se crean al guardar o editar una web.</p>
    <p v-if="isPending">Cargando…</p>
    <p v-else-if="!collections?.length">Todavía no hay colecciones.</p>
    <div v-for="collection in collections" :key="collection.id" class="row">
      <RouterLink class="grow" :to="{ name: 'home', query: { collection: collection.id } }">
        {{ collection.name }}
      </RouterLink>
      <span class="muted">{{ collection.webCount }} webs</span>
      <button type="button" @click="rename(collection)">Renombrar</button>
      <button type="button" @click="remove(collection)">Borrar</button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
  </main>
</template>
