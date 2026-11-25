<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, errorMessage, responseBody } from '../lib/api'
import { useInvalidateVault, useVaultFolders, useVaultPreferences } from '../lib/queries'
import { buildNestedVault, trailLabel, type NestedFolder } from '../lib/vaultTree'

const route = useRoute()
const router = useRouter()
const invalidateVault = useInvalidateVault()

const { data: folders, isPending: areFoldersPending } = useVaultFolders()
const { data: preferences } = useVaultPreferences()

/** Every folder below a category, at any depth, named by its trail from the category down. */
function folderOptions(folder: NestedFolder, trail: NestedFolder[]): { id: string; label: string }[] {
  const trailWithFolder = [...trail, folder]
  return [
    { id: folder.id, label: trailLabel(trailWithFolder) },
    ...folder.subfolders.flatMap((subfolder) => folderOptions(subfolder, trailWithFolder)),
  ]
}

/** Links can only go in a folder, so the select groups the folders by category and skips empty categories. */
const categoriesWithFolders = computed(() =>
  buildNestedVault(folders.value ?? [], [])
    .categories.filter((category) => category.subfolders.length > 0)
    .map((category) => ({
      id: category.id,
      name: category.name,
      folders: category.subfolders.flatMap((folder) => folderOptions(folder, [])),
    })),
)

const url = ref('')
const title = ref('')
const folderId = ref(typeof route.query.folder === 'string' ? route.query.folder : '')

const isSaving = ref(false)
const saveError = ref('')

/** Back to the saved link: its folder in the list, or its folder open in the tiles when they show it. */
function savedLinkPlace(folderId: string) {
  if (preferences.value?.view === 'list') return { in: folderId }
  const parentId = folders.value?.find((folder) => folder.id === folderId)?.parentId
  const isCategory = folders.value?.some((folder) => folder.id === parentId && folder.parentId === null)
  return parentId && isCategory ? { category: parentId, folder: folderId } : {}
}

async function saveLink() {
  isSaving.value = true
  saveError.value = ''
  try {
    const savedLink = await responseBody(
      api.vault.links.$post({ json: { url: url.value.trim(), title: title.value, folderId: folderId.value } }),
    )
    await invalidateVault()
    await router.push({ name: 'vault', query: savedLinkPlace(savedLink.folderId) })
  } catch (error) {
    saveError.value = errorMessage(error)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <main class="page narrow">
    <p v-if="!areFoldersPending && !categoriesWithFolders.length">
      Links are saved in folders, and there are none yet.
      <RouterLink :to="{ name: 'vault' }">Create a category and a folder in it</RouterLink> first.
    </p>
    <form v-else class="stack" @submit.prevent="saveLink">
      <label>
        URL
        <input v-model="url" type="url" placeholder="https://…" required />
      </label>
      <label>
        Title
        <input v-model="title" required maxlength="200" />
      </label>
      <label>
        Folder
        <select v-model="folderId" required>
          <option value="" disabled>Choose a folder</option>
          <optgroup v-for="category in categoriesWithFolders" :key="category.id" :label="category.name">
            <option v-for="folder in category.folders" :key="folder.id" :value="folder.id">{{ folder.label }}</option>
          </optgroup>
        </select>
      </label>
      <button type="submit" :disabled="isSaving">{{ isSaving ? 'Saving…' : 'Save' }}</button>
      <p v-if="saveError" class="error">{{ saveError }}</p>
    </form>
  </main>
</template>
