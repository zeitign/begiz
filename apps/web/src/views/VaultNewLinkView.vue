<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VaultFolderTree from '../components/VaultFolderTree.vue'
import VaultNewFolderForm from '../components/VaultNewFolderForm.vue'
import { api, errorMessage, responseBody } from '../lib/api'
import { useInvalidateVault, useVaultFolders, useVaultPreferences } from '../lib/queries'
import { buildNestedVault, folderTrail, trailLabel, type MoveRefusal } from '../lib/vaultTree'

// A framed sheet with three numbered sections: the URL, the title and the folder, chosen in the Vault's
// tree, where new folders and categories can be made. With no folder to hold links yet, the folder
// section is a notice that walks through making the first category and its first folder.
const route = useRoute()
const router = useRouter()
const invalidateVault = useInvalidateVault()

const { data: folders, isPending: areFoldersPending } = useVaultFolders()
const { data: preferences } = useVaultPreferences()

const vault = computed(() => buildNestedVault(folders.value ?? [], []))
/** Links only go in folders, so a Vault with categories but no folder in them still cannot hold one. */
const hasLinkFolders = computed(() => vault.value.categories.some((category) => category.subfolders.length > 0))
const firstCategory = computed(() => vault.value.categories[0])

const url = ref('')
const title = ref('')
const chosenFolderId = ref<string | null>(typeof route.query.folder === 'string' ? route.query.folder : null)
/** The folder selector opens only when its field is pressed. */
const isTreeOpen = ref(false)
const folderTree = ref<InstanceType<typeof VaultFolderTree>>()

const chosenTrail = computed(() =>
  chosenFolderId.value ? trailLabel(folderTrail(chosenFolderId.value, vault.value)) : '',
)
const openFolderIds = computed(() =>
  chosenFolderId.value ? folderTrail(chosenFolderId.value, vault.value).map((folder) => folder.id) : [],
)
const categoryRefusal = (folderId: string | null): MoveRefusal | null =>
  folderId === null || vault.value.foldersById.get(folderId)?.parentId === null ? 'noLinks' : null

function chooseFolder(folderId: string | null) {
  chosenFolderId.value = folderId
  isTreeOpen.value = false
}

/** A folder just made is where the link goes. */
function onFolderCreated(folder: { id: string; parentId: string | null }) {
  if (folder.parentId !== null) chosenFolderId.value = folder.id
}

function startCategory() {
  isTreeOpen.value = true
  folderTree.value?.startCategory()
}

/** In the empty Vault notice: what is being named, a category or the first folder of one. */
const emptyVaultStep = ref<'category' | 'folder' | null>(null)

/** After the category comes its first folder; once that exists, it is chosen and the tree stays closed. */
function onFirstFolderCreated(folder: { id: string; parentId: string | null }) {
  emptyVaultStep.value = folder.parentId === null ? 'folder' : null
  isTreeOpen.value = false
  onFolderCreated(folder)
}

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
  if (!chosenFolderId.value) return
  isSaving.value = true
  saveError.value = ''
  try {
    const savedLink = await responseBody(
      api.vault.links.$post({ json: { url: url.value.trim(), title: title.value, folderId: chosenFolderId.value } }),
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
  <main class="page wide save-link">
    <div class="save-link-intro">
      <h1 class="save-link-title">Save a link.</h1>
      <p class="save-link-lede">
        Paste it, name it, and choose where it lives. A folder that doesn’t exist yet can be made right here.
      </p>
      <div class="save-link-key">
        <span class="save-link-key-heading">How the Vault holds it</span>
        <p><span class="save-link-number">01</span>Categories group your folders. They hold no links.</p>
        <p><span class="save-link-number">02</span>Folders hold the links, and more folders if you like.</p>
        <p><span class="save-link-number">03</span>Hover a folder in the tree and press Add folder to make one inside.</p>
      </div>
    </div>

    <form class="save-link-sheet" aria-label="New link" @submit.prevent="saveLink">
      <label class="save-link-section">
        <span class="save-link-label">
          <span class="save-link-number">01</span><span class="save-link-name">URL</span>
        </span>
        <input v-model="url" class="save-link-input" type="url" placeholder="https://…" required />
      </label>
      <label class="save-link-section">
        <span class="save-link-label">
          <span class="save-link-number">02</span><span class="save-link-name">Title</span>
        </span>
        <input v-model="title" class="save-link-input" placeholder="Name it" required maxlength="200" />
      </label>

      <div class="save-link-section save-link-folder">
        <span class="save-link-label">
          <span class="save-link-number">03</span><span class="save-link-name">Folder</span>
        </span>

        <template v-if="areFoldersPending">
          <p class="save-link-indented muted">Loading…</p>
        </template>

        <div v-else-if="!hasLinkFolders" class="save-link-warning" role="status">
          <span class="save-link-warning-band" aria-hidden="true"></span>
          <div class="save-link-warning-body">
            <span class="save-link-warning-mark" aria-hidden="true">!</span>
            <div class="save-link-warning-text">
              <template v-if="firstCategory">
                <p class="save-link-warning-title">Almost there. Now a folder!</p>
                <p class="save-link-warning-hint">
                  {{ firstCategory.name }} is ready. Links live in folders, so name the one this link goes in.
                </p>
              </template>
              <template v-else>
                <p class="save-link-warning-title">Nothing here yet.</p>
                <p class="save-link-warning-hint">
                  Links live in folders, and folders live in a category. Start with the category; the folder
                  comes right after.
                </p>
              </template>
              <VaultNewFolderForm
                v-if="emptyVaultStep"
                :parent-id="firstCategory && emptyVaultStep === 'folder' ? firstCategory.id : null"
                :placeholder="
                  firstCategory && emptyVaultStep === 'folder' ? `Name a folder in ${firstCategory.name}` : 'Name the category'
                "
                @created="onFirstFolderCreated"
                @cancel="emptyVaultStep = null"
              />
              <button
                v-else-if="firstCategory"
                type="button"
                class="save-link-warning-action"
                @click="emptyVaultStep = 'folder'"
              >
                + Folder in {{ firstCategory.name }}
              </button>
              <button v-else type="button" class="save-link-warning-action" @click="emptyVaultStep = 'category'">
                + Create one! · New category
              </button>
            </div>
          </div>
        </div>

        <!-- A selector: the field is the head of a box that unfolds with the tree under it, as one piece. -->
        <div v-else class="save-link-picker" :class="{ open: isTreeOpen }">
          <button
            type="button"
            class="save-link-chosen"
            :aria-expanded="isTreeOpen"
            @click="isTreeOpen = !isTreeOpen"
          >
            <span :class="chosenTrail ? 'save-link-chosen-trail' : 'save-link-chosen-placeholder'">
              {{ chosenTrail || 'Choose a folder' }}
            </span>
            <svg class="save-link-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <div class="save-link-picker-body" :inert="!isTreeOpen">
            <div class="save-link-tree">
              <VaultFolderTree
                ref="folderTree"
                class="save-link-tree-list"
                :vault="vault"
                :refusal-of="categoryRefusal"
                :open-ids="openFolderIds"
                :chosen-id="chosenFolderId"
                can-create-folders
                hides-notes
                @choose="chooseFolder"
                @created="onFolderCreated"
              />
              <button type="button" class="save-link-tree-foot" @click="startCategory">+ New category</button>
            </div>
          </div>
        </div>
      </div>

      <div class="save-link-foot">
        <span class="filter-stripes" aria-hidden="true"></span>
        <div class="save-link-foot-bar">
          <span class="save-link-status error" role="alert">{{ saveError }}</span>
          <button type="submit" class="save-link-save" :disabled="!chosenFolderId || isSaving">
            {{ isSaving ? 'Saving…' : 'Save' }} <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </form>
  </main>
</template>
