<script setup lang="ts">
import { computed } from 'vue'
import type { Collection } from '../lib/api'
import WebThumb from './WebThumb.vue'

const props = defineProps<{ collection: Collection }>()

const ORNAMENTS = [' * ', ' _ ', ' ` ', ' " ', ' - ']
// Enough to run along the tallest side of a column; each side clips what does not fit.
const NAME_REPETITIONS = 30

/** The name in lowercase over and over, each side starting at another ornament and letter so they differ. */
function repeatedName(firstOrnament: number, skippedLetters: number) {
  const lowercaseName = props.collection.name.toLowerCase()
  return Array.from(
    { length: NAME_REPETITIONS },
    (_, index) => lowercaseName + ORNAMENTS[(firstOrnament + index) % ORNAMENTS.length],
  )
    .join('')
    .slice(skippedLetters)
}

const frameText = computed(() => ({
  top: repeatedName(4, 0),
  right: repeatedName(3, 2),
  bottom: repeatedName(0, 1),
  left: repeatedName(1, 4),
}))

const webCountLabel = computed(() =>
  props.collection.webCount === 1 ? '1 web' : `${props.collection.webCount} webs`,
)
</script>

<template>
  <div class="collection-column">
    <RouterLink
      :to="{ name: 'collection', params: { id: collection.id } }"
      class="collection-frame"
      :aria-label="`${collection.name}, ${webCountLabel}`"
    >
      <span class="frame-text frame-text-left" aria-hidden="true"><span>{{ frameText.left }}</span></span>
      <span class="frame-text frame-text-top" aria-hidden="true">
        <strong class="frame-title">{{ collection.name }}_</strong> {{ frameText.top }}
      </span>
      <span class="frame-text frame-text-right" aria-hidden="true"><span>{{ frameText.right }}</span></span>
      <span class="frame-text frame-text-bottom" aria-hidden="true">{{ frameText.bottom }}</span>
      <span class="collection-covers" aria-hidden="true">
        <span
          v-for="(web, index) in collection.coverWebs"
          :key="web.id"
          class="collection-cover"
          :style="{ '--cover-index': index }"
        >
          <WebThumb :web="web" />
        </span>
        <span v-if="!collection.coverWebs.length" class="collection-empty">No webs yet</span>
      </span>
    </RouterLink>
  </div>
</template>
