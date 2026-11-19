<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import VaultIcon from './VaultIcon.vue'

const chosenIcon = defineModel<string>({ required: true })

/** Enough to choose from without rendering the whole library at once. */
const SHOWN_ICON_LIMIT = 96

/** Shown before searching: icons that fit common kinds of folders. */
const SUGGESTED_ICON_NAMES = [
  'folder', 'briefcase', 'wrench', 'text-aa', 'palette', 'game-controller', 'newspaper', 'book-open',
  'music-notes', 'film-strip', 'camera', 'code', 'globe', 'airplane', 'house', 'shopping-cart',
  'graduation-cap', 'heart', 'star', 'lightbulb', 'coffee', 'flower', 'asterisk', 'sparkle',
  'chart-line', 'currency-eur', 'paint-brush', 'pen-nib', 'tree', 'rocket', 'cooking-pot', 'barbell',
]

type IconEntry = { name: string; tags: readonly string[] }

const iconCatalog = shallowRef<IconEntry[]>([])
const catalogError = ref('')
const iconSearch = ref('')

// The catalog (names and search tags) is large, so it only downloads when the editor opens.
onMounted(async () => {
  try {
    const { icons } = await import('@phosphor-icons/core')
    iconCatalog.value = icons.map((icon) => ({ name: icon.name, tags: icon.tags }))
  } catch {
    catalogError.value = 'The icons could not be loaded.'
  }
})

const matchingIcons = computed(() => {
  const query = iconSearch.value.trim().toLowerCase()
  if (!query) {
    const suggestedNames = new Set(SUGGESTED_ICON_NAMES)
    return iconCatalog.value.filter((icon) => suggestedNames.has(icon.name))
  }
  return iconCatalog.value.filter(
    (icon) => icon.name.includes(query) || icon.tags.some((tag) => tag.toLowerCase().includes(query)),
  )
})
const shownIcons = computed(() => matchingIcons.value.slice(0, SHOWN_ICON_LIMIT))
</script>

<template>
  <fieldset class="vault-icon-picker">
    <legend>Icon</legend>
    <input v-model="iconSearch" type="search" aria-label="Search icons" placeholder="Search icons: work, music, book…" />
    <p v-if="catalogError" class="error">{{ catalogError }}</p>
    <p v-else-if="!iconCatalog.length" class="muted">Loading icons…</p>
    <p v-else-if="!shownIcons.length" class="muted">No icon matches “{{ iconSearch.trim() }}”.</p>
    <div class="vault-icon-options">
      <button
        v-for="icon in shownIcons"
        :key="icon.name"
        type="button"
        class="vault-icon-option"
        :aria-pressed="icon.name === chosenIcon"
        :aria-label="icon.name"
        :title="icon.name"
        @click="chosenIcon = icon.name"
      >
        <VaultIcon :name="icon.name" />
      </button>
    </div>
    <p v-if="!iconSearch.trim() && iconCatalog.length" class="muted">
      Search to find any of the {{ iconCatalog.length }} icons.
    </p>
    <p v-else-if="matchingIcons.length > SHOWN_ICON_LIMIT" class="muted">
      Showing {{ SHOWN_ICON_LIMIT }} of {{ matchingIcons.length }} icons. Search to find the rest.
    </p>
  </fieldset>
</template>
