<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Space } from '../router'

const props = defineProps<{ space: Space }>()

const spaceOptions = {
  mosaic: {
    label: 'Mosaic',
    explanation:
      'Mosaic is your inspiration gallery. Save websites with an image, notes and tags, and group them into collections.',
    homeRoute: 'home',
    saveRoute: 'new',
    collectionsRoute: 'collections',
  },
  vault: {
    label: 'Vault',
    explanation:
      'Vault is your bookmark store: plain links in nested folders, easy to search, import and export.',
    homeRoute: 'vault',
    saveRoute: 'vault-new',
    collectionsRoute: 'vault-collections',
  },
}

const currentOptions = computed(() => spaceOptions[props.space])
const isExplanationOpen = ref(false)
</script>

<template>
  <div class="space-nav" :class="{ 'under-vault': space === 'vault' }">
    <section
      class="space-explainer"
      :class="{ open: isExplanationOpen }"
      :aria-label="`About ${currentOptions.label}`"
    >
      <button
        type="button"
        class="what-is-button"
        :aria-expanded="isExplanationOpen"
        aria-controls="space-explanation"
        @click="isExplanationOpen = !isExplanationOpen"
      >
        What is it?
        <svg class="what-is-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
      <div class="explanation-reveal">
        <div id="space-explanation" class="explanation-clip">
          <p class="explanation-text">{{ currentOptions.explanation }}</p>
        </div>
      </div>
    </section>
    <nav class="space-options" :aria-label="`${currentOptions.label} options`">
      <RouterLink :to="{ name: currentOptions.saveRoute }" class="folder-tab">Save web</RouterLink>
      <RouterLink :to="{ name: currentOptions.collectionsRoute }" class="folder-tab">Collections</RouterLink>
      <RouterLink
        :to="{ name: currentOptions.homeRoute }"
        class="folder-tab folder-tab-home"
        :aria-label="`Go to ${currentOptions.label} home`"
        :title="`Go to ${currentOptions.label} home`"
      >
        <span class="folder-tab-logo crossed" aria-hidden="true"></span>
      </RouterLink>
    </nav>
  </div>
</template>
