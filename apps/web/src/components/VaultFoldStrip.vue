<script setup lang="ts">
import VaultIcon from './VaultIcon.vue'

// A folded column: its icon and its name upright. Clicking it unfolds the column again.
defineProps<{ name: string; icon: string }>()
const emit = defineEmits<{ unfold: [] }>()
</script>

<template>
  <button type="button" class="vault-fold-strip" :aria-label="`Show ${name}`" @click="emit('unfold')">
    <span class="vault-fold-arrow">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M5 12h14" />
        <path d="M13 6l6 6-6 6" />
      </svg>
    </span>
    <VaultIcon :name="icon" />
    <span class="vault-fold-name">{{ name }}</span>
  </button>
</template>
