<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId, useTemplateRef } from 'vue'

defineProps<{ label: string }>()

const isOpen = ref(false)
const panelId = useId()
const dropdown = useTemplateRef<HTMLElement>('dropdown')
const trigger = useTemplateRef<HTMLButtonElement>('trigger')

function closeOnOutsidePress(event: PointerEvent) {
  if (!dropdown.value?.contains(event.target as Node)) isOpen.value = false
}

function closeAndRestoreFocus() {
  if (!isOpen.value) return
  isOpen.value = false
  trigger.value?.focus()
}

onMounted(() => document.addEventListener('pointerdown', closeOnOutsidePress))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOnOutsidePress))
</script>

<template>
  <div ref="dropdown" class="filter-dropdown" @keydown.esc="closeAndRestoreFocus">
    <button
      ref="trigger"
      type="button"
      class="filter-trigger"
      :aria-expanded="isOpen"
      :aria-controls="panelId"
      @click="isOpen = !isOpen"
    >
      {{ label }}
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
    <div :id="panelId" class="filter-panel">
      <div class="filter-panel-content">
        <slot />
      </div>
    </div>
  </div>
</template>
