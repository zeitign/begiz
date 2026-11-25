<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, errorMessage, responseBody } from '../lib/api'
import { useInvalidateVault } from '../lib/queries'

// Names a new folder in place, wherever one can be made: the list, the folder tree, the empty Vault notice.
const props = defineProps<{
  /** The folder it goes in; null makes it a category. */
  parentId: string | null
  placeholder?: string
}>()
const emit = defineEmits<{ created: [folder: { id: string; parentId: string | null }]; cancel: [] }>()

const invalidateVault = useInvalidateVault()
const nameInput = ref<HTMLInputElement>()
const draftName = ref('')
const isSaving = ref(false)
const createError = ref('')

onMounted(() => nameInput.value?.focus())

async function createFolder() {
  isSaving.value = true
  createError.value = ''
  try {
    const createdFolder = await responseBody(
      api.vault.folders.$post({ json: { name: draftName.value, parentId: props.parentId, icon: null } }),
    )
    // Before refreshing: the new folder can change what is shown, and remove this form with it.
    emit('created', createdFolder)
    await invalidateVault()
  } catch (error) {
    createError.value = errorMessage(error)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <form class="vault-new-folder" @submit.prevent="createFolder" @keydown.esc="emit('cancel')">
    <input
      ref="nameInput"
      v-model="draftName"
      class="vault-new-folder-input"
      required
      maxlength="200"
      :placeholder="placeholder ?? 'Name it!'"
      :aria-label="parentId ? 'Folder name' : 'Category name'"
    />
    <button type="submit" class="vault-list-button" :disabled="isSaving">{{ isSaving ? 'Creating…' : 'Create' }}</button>
    <button type="button" class="vault-list-button" @click="emit('cancel')">Cancel</button>
    <p v-if="createError" class="error vault-new-folder-error">{{ createError }}</p>
  </form>
</template>
