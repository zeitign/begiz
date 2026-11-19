<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, errorMessage, responseBody } from '../lib/api'
import { DEFAULT_FOLDER_ICON } from '../lib/vaultTree'
import VaultIcon from './VaultIcon.vue'
import VaultIconPicker from './VaultIconPicker.vue'

// A category being created: a card twice the size of a tile, next to the intro, with its name and icon
// edited inside. Once created it contracts to a tile's size; then the grid shows the real one.
const emit = defineEmits<{ cancel: []; created: [categoryId: string] }>()

/** As long as the box's width and height transitions in style.css. */
const CONTRACT_MS = 450
const BOARD_GAP = 16

const draftName = ref('')
const draftIcon = ref(DEFAULT_FOLDER_ICON)
const isSaving = ref(false)
const createError = ref('')
const cardElement = ref<HTMLElement>()
const nameInput = ref<HTMLInputElement>()
/** The tile's size it contracts to: the card spans two columns and the gap between them. */
const contractedSize = ref<number | null>(null)

onMounted(() => nameInput.value?.focus())

async function createCategory() {
  isSaving.value = true
  createError.value = ''
  try {
    const created = await responseBody(
      api.vault.folders.$post({ json: { name: draftName.value, icon: draftIcon.value, parentId: null } }),
    )
    if (cardElement.value) contractedSize.value = (cardElement.value.offsetWidth - BOARD_GAP) / 2
    await new Promise((resolve) => setTimeout(resolve, CONTRACT_MS))
    emit('created', created.id)
  } catch (error) {
    createError.value = errorMessage(error)
    isSaving.value = false
  }
}
</script>

<template>
  <div ref="cardElement" class="vault-new-card">
    <form
      class="vault-new-card-box"
      :class="{ contracted: contractedSize !== null }"
      :style="contractedSize !== null ? { width: `${contractedSize}px`, height: `${contractedSize}px` } : undefined"
      aria-label="New category"
      @submit.prevent="createCategory"
      @keydown.esc="emit('cancel')"
    >
      <div class="vault-new-card-editor">
        <input
          ref="nameInput"
          v-model="draftName"
          class="vault-new-card-name"
          required
          maxlength="200"
          placeholder="Name it!"
          aria-label="Category name"
        />
        <VaultIconPicker v-model="draftIcon" />
        <p v-if="createError" class="error">{{ createError }}</p>
        <div class="vault-panel-buttons">
          <button type="button" class="vault-panel-button" @click="emit('cancel')">Cancel</button>
          <button type="submit" class="vault-panel-button vault-new-card-create" :disabled="isSaving">
            {{ isSaving ? 'Creating…' : 'Create' }}
          </button>
        </div>
      </div>
      <div class="vault-identity vault-new-card-tile" aria-hidden="true">
        <h2 class="vault-identity-name">{{ draftName }}</h2>
        <span class="vault-identity-count">0 folders · 0 links</span>
        <VaultIcon :name="draftIcon" />
      </div>
    </form>
  </div>
</template>
