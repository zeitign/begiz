<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, errorMessage, responseBody } from '../lib/api'
import { useInvalidateVault } from '../lib/queries'
import VaultIconPicker from './VaultIconPicker.vue'

// Edits a folder or category, or creates one when it has no id yet.
const props = defineProps<{
  folder: { id: string | null; name: string; icon: string }
  /** What deleting it also deletes, such as "3 folders and 12 links". Empty when it holds nothing. */
  contentsLabel: string
  /** Where a new folder goes: its category. */
  parentId?: string
}>()
const emit = defineEmits<{ done: []; deleted: []; created: [folderId: string] }>()

/** Shared with the panel, so the folder shows the icon being chosen before it is saved. */
const draftIcon = defineModel<string>('icon', { required: true })

const invalidateVault = useInvalidateVault()
const draftName = ref(props.folder.name)
const isSaving = ref(false)
const nameInput = ref<HTMLInputElement>()

// A new folder starts by its name.
onMounted(() => {
  if (!props.folder.id) nameInput.value?.focus()
})
const editError = ref('')

async function saveFolder() {
  isSaving.value = true
  editError.value = ''
  const fields = { name: draftName.value, icon: draftIcon.value }
  try {
    if (props.folder.id) {
      await responseBody(api.vault.folders[':id'].$patch({ param: { id: props.folder.id }, json: fields }))
      await invalidateVault()
      emit('done')
    } else {
      const created = await responseBody(
        api.vault.folders.$post({ json: { ...fields, parentId: props.parentId ?? null } }),
      )
      await invalidateVault()
      emit('created', created.id)
    }
  } catch (error) {
    editError.value = errorMessage(error)
  } finally {
    isSaving.value = false
  }
}

async function deleteFolder() {
  if (!props.folder.id) return
  const contents = props.contentsLabel ? ` This also deletes the ${props.contentsLabel} inside it.` : ''
  if (!confirm(`Delete “${props.folder.name}”?${contents} It cannot be undone.`)) return
  editError.value = ''
  try {
    await responseBody(api.vault.folders[':id'].$delete({ param: { id: props.folder.id } }))
    emit('deleted')
    await invalidateVault()
  } catch (error) {
    editError.value = errorMessage(error)
  }
}
</script>

<template>
  <form class="vault-folder-editor stack" @submit.prevent="saveFolder">
    <label>
      Name
      <input ref="nameInput" v-model="draftName" required maxlength="200" />
    </label>
    <VaultIconPicker v-model="draftIcon" />
    <div class="vault-editor-actions">
      <button type="submit" class="vault-primary-button" :disabled="isSaving">
        {{ isSaving ? 'Saving…' : 'Save' }}
      </button>
      <button type="button" @click="emit('done')">Cancel</button>
      <span class="grow"></span>
      <button v-if="folder.id" type="button" @click="deleteFolder">Delete</button>
    </div>
    <p v-if="editError" class="error">{{ editError }}</p>
  </form>
</template>
