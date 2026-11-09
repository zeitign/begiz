<script setup lang="ts">
import { computed } from 'vue'
import CollectionColumn from '../components/CollectionColumn.vue'
import { useCollections } from '../lib/queries'

const { data: collections, isPending, error: loadError } = useCollections()

const collectionCountLabel = computed(() => {
  const collectionCount = collections.value?.length ?? 0
  return collectionCount === 1 ? '1 collection' : `${collectionCount} collections`
})
</script>

<template>
  <main class="collections-page">
    <p v-if="loadError" class="collections-message error">{{ loadError.message }}</p>
    <p v-else-if="isPending" class="collections-message">Loading…</p>
    <p v-else-if="!collections?.length" class="collections-message muted">
      No collections yet. They are created when saving or editing a web.
    </p>
    <template v-else>
      <p class="collections-message collection-count">{{ collectionCountLabel }}</p>
      <div class="collection-columns">
        <CollectionColumn v-for="collection in collections" :key="collection.id" :collection="collection" />
      </div>
    </template>
  </main>
</template>
