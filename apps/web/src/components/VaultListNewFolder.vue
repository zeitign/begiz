<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, errorMessage, responseBody } from '../lib/api'
import { useInvalidateVault } from '../lib/queries'

const props = defineProps<{
  /** The folder it goes in; null makes it a category. */
  parentId: string | null
}>()
const emit = defineEmits<{ done: [] }>()

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
    await responseBody(api.vault.folders.$post({ json: { name: draftName.value, parentId: props.parentId, icon: null } }))
    await invalidateVault()
    emit('done')
  } catch (error) {
    createError.value = errorMessage(error)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <li class="vault-list-row">
    <form class="vault-list-new-folder" @submit.prevent="createFolder" @keydown.esc="emit('done')">
      <input
        ref="nameInput"
        v-model="draftName"
        class="vault-list-folder-name"
        required
        maxlength="200"
        placeholder="Name it!"
        :aria-label="parentId ? 'Folder name' : 'Category name'"
      />
      <button type="submit" class="vault-list-button" :disabled="isSaving">{{ isSaving ? 'Creating…' : 'Create' }}</button>
      <button type="button" class="vault-list-button" @click="emit('done')">Cancel</button>
    </form>
    <p v-if="createError" class="error vault-list-error">{{ createError }}</p>
  </li>
</template>
