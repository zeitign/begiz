<script setup lang="ts">
// The controls of an open panel, side by side under its card: back, edit and close.
defineProps<{
  /** What the panel shows, for the buttons' labels: "category" or "folder". */
  kind: string
  backLabel: string
  isEditing: boolean
}>()
const emit = defineEmits<{ close: []; edit: [] }>()
</script>

<template>
  <div class="vault-panel-bar">
    <button type="button" class="vault-bar-button" title="Back" :aria-label="backLabel" @click="emit('close')">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M19 12H5" />
        <path d="M11 6l-6 6 6 6" />
      </svg>
    </button>
    <button
      type="button"
      class="vault-bar-button"
      title="Edit"
      :aria-label="`Edit ${kind}`"
      :disabled="isEditing"
      @click="emit('edit')"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M4 20h4L19 9l-4-4L4 16z" />
        <path d="M13 7l4 4" />
      </svg>
    </button>
    <button type="button" class="vault-bar-button" title="Close" :aria-label="`Close ${kind}`" @click="emit('close')">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M6 6l12 12" />
        <path d="M18 6L6 18" />
      </svg>
    </button>
  </div>
</template>
