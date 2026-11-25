<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { VaultPreferences } from '@webs/shared'
import { VueDraggable, type DraggableEvent } from 'vue-draggable-plus'
import { api, errorMessage, responseBody, type VaultFolder, type VaultLink } from '../lib/api'
import { vOpticalAlign } from '../lib/opticalAlign'
import { useInvalidateVault } from '../lib/queries'
import {
  buildNestedVault,
  folderTrail,
  listOrder,
  pluralize,
  folderSortKeys,
  linkSortKeys,
  searchNestedVault,
  sortByListOrder,
  type NestedFolder,
  type VaultPicks,
} from '../lib/vaultTree'
import VaultListLinkRow from './VaultListLinkRow.vue'
import VaultListNewFolder from './VaultListNewFolder.vue'
import VaultTray from './VaultTray.vue'

// The list view shows one level at a time: the categories, or the subfolders and links of the folder
// in the URL (?in=). Searching lists matches from the whole Vault, each with where it lives.
// Order sorts folders and links by name or date; random and custom place tiles, so the list keeps names.
// Select turns a tap on a row into picking it; the picks wait in the tray while you move around.
const props = defineProps<{
  folders: VaultFolder[]
  links: VaultLink[]
  query: string
  preferences: VaultPreferences
}>()
const emit = defineEmits<{ clearSearch: [] }>()

const route = useRoute()
const router = useRouter()

const vault = computed(() => buildNestedVault(props.folders, props.links))
const trail = computed(() => (typeof route.query.in === 'string' ? folderTrail(route.query.in, vault.value) : []))
const currentFolder = computed<NestedFolder | undefined>(() => trail.value.at(-1))
// The tree is rebuilt on every refresh, so moving to another folder is watched by its id.
const currentFolderId = computed(() => currentFolder.value?.id ?? null)
/** Sorts folders, links or search results by the chosen order, from the name and date each one gives. */
const isCustomOrder = computed(() => listOrder(props.preferences.order) === 'custom')

const shownFolders = computed(() =>
  sortByListOrder(currentFolder.value?.subfolders ?? vault.value.categories, props.preferences, folderSortKeys),
)
const shownLinks = computed(() => sortByListOrder(currentFolder.value?.links ?? [], props.preferences, linkSortKeys))
// Positions only compare within one folder, so in the custom order results keep the tree's order.
const searchResults = computed(() => {
  if (!props.query) return null
  const results = searchNestedVault(vault.value, props.query)
  if (isCustomOrder.value) return results
  return {
    folders: sortByListOrder(results.folders, props.preferences, (result) => folderSortKeys(result.folder)),
    links: sortByListOrder(results.links, props.preferences, (result) => linkSortKeys(result.link)),
  }
})

// Local copies that dragging reorders right away, before the API answers (as in the mosaic).
const orderedFolders = ref<NestedFolder[]>([])
const orderedLinks = ref<VaultLink[]>([])
watch(shownFolders, (folders) => (orderedFolders.value = [...folders]), { immediate: true })
watch(shownLinks, (links) => (orderedLinks.value = [...links]), { immediate: true })

const invalidateVault = useInvalidateVault()
const moveError = ref('')

/** By the time the drop ends, the local copy is already in its new order: the row goes after its new
 * previous neighbour. If saving fails, the rows go back to the saved order. */
async function saveDroppedPosition<Row extends { id: string }>(
  event: DraggableEvent,
  rows: Row[],
  savePosition: (rowId: string, afterRowId: string | null) => Promise<unknown>,
) {
  if (event.oldIndex === event.newIndex || event.newIndex === undefined) return
  const movedRow = rows[event.newIndex]
  if (!movedRow) return
  moveError.value = ''
  try {
    await savePosition(movedRow.id, rows[event.newIndex - 1]?.id ?? null)
  } catch (error) {
    moveError.value = errorMessage(error)
    orderedFolders.value = [...shownFolders.value]
    orderedLinks.value = [...shownLinks.value]
  }
  await invalidateVault()
}

const saveFolderPosition = (event: DraggableEvent) =>
  saveDroppedPosition(event, orderedFolders.value, (folderId, afterFolderId) =>
    responseBody(api.vault.folders[':id'].position.$put({ param: { id: folderId }, json: { afterFolderId } })),
  )
const saveLinkPosition = (event: DraggableEvent) =>
  saveDroppedPosition(event, orderedLinks.value, (linkId, afterLinkId) =>
    responseBody(api.vault.links[':id'].position.$put({ param: { id: linkId }, json: { afterLinkId } })),
  )

const contentsLabel = (folderTotal: number, linkTotal: number) =>
  `${pluralize(folderTotal, 'folder')} · ${pluralize(linkTotal, 'link')}`

const currentContentsLabel = computed(() => {
  if (currentFolder.value) return contentsLabel(currentFolder.value.folderTotal, currentFolder.value.linkTotal)
  const categories = vault.value.categories
  const folderTotal = categories.reduce((total, category) => total + category.folderTotal, 0)
  const linkTotal = categories.reduce((total, category) => total + category.linkTotal, 0)
  return `${pluralize(categories.length, 'category', 'categories')} · ${contentsLabel(folderTotal, linkTotal)}`
})

/** Categories only hold folders, so links go in folders below them. */
const canHoldLinks = computed(() => currentFolder.value !== undefined && currentFolder.value.parentId !== null)

const resultCount = computed(() =>
  searchResults.value ? searchResults.value.folders.length + searchResults.value.links.length : 0,
)

function openFolder(folderId: string | null) {
  emit('clearSearch')
  router.push({ query: folderId ? { in: folderId } : {} })
}

const parentFolderId = computed(() => trail.value.at(-2)?.id ?? null)

const isCreatingFolder = ref(false)
watch(currentFolderId, () => (isCreatingFolder.value = false))

const isSelecting = ref(false)
const picks = ref<VaultPicks>({ folderIds: [], linkIds: [] })
const hasPicks = computed(() => picks.value.folderIds.length + picks.value.linkIds.length > 0)
/** What the tray last did, shown in place of the counts until you move on. */
const trayMessage = ref('')
watch(currentFolderId, () => (trayMessage.value = ''))

// Picks deleted or gone elsewhere leave the tray, so it never sends something that no longer exists.
watch(vault, (nestedVault) => {
  picks.value = {
    folderIds: picks.value.folderIds.filter((folderId) => nestedVault.foldersById.has(folderId)),
    linkIds: picks.value.linkIds.filter((linkId) => props.links.some((link) => link.id === linkId)),
  }
})

const togglePick = (pickedIds: string[], itemId: string) =>
  pickedIds.includes(itemId) ? pickedIds.filter((pickedId) => pickedId !== itemId) : [...pickedIds, itemId]

function pickFolder(folderId: string) {
  picks.value = { ...picks.value, folderIds: togglePick(picks.value.folderIds, folderId) }
  trayMessage.value = ''
}

function pickLink(linkId: string) {
  picks.value = { ...picks.value, linkIds: togglePick(picks.value.linkIds, linkId) }
  trayMessage.value = ''
}

/** A tap on a folder row picks it while selecting, and otherwise opens it (outside the custom order,
 * where the row is held to drag it). */
function onFolderRowClick(folderId: string) {
  if (isSelecting.value) pickFolder(folderId)
  else if (!isCustomOrder.value) openFolder(folderId)
}

const headingMeta = computed(() => {
  if (trayMessage.value) return trayMessage.value
  if (isSelecting.value) return 'Tap rows to pick them. The tray keeps them while you move around.'
  return currentContentsLabel.value
})
</script>

<template>
  <section class="vault-list" :class="{ 'has-tray': hasPicks }" aria-label="Vault list">
    <template v-if="!searchResults">
      <nav class="vault-list-grid vault-list-crumbs" aria-label="Where you are">
        <button
          type="button"
          class="vault-list-crumb vault-list-up"
          :disabled="!currentFolder"
          aria-label="Up one level"
          @click="openFolder(parentFolderId)"
        >
          <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
            <path d="M7 13V1.5M1.5 7 7 1.5 12.5 7" />
          </svg>
          Up
        </button>
        <ol class="vault-list-trail">
          <li>
            <button
              type="button"
              class="vault-list-crumb"
              :aria-current="currentFolder ? undefined : 'location'"
              @click="openFolder(null)"
            >
              Vault
            </button>
          </li>
          <li v-for="folder in trail" :key="folder.id">
            <span class="vault-list-separator" aria-hidden="true">›</span>
            <button
              type="button"
              class="vault-list-crumb"
              :aria-current="folder === currentFolder ? 'location' : undefined"
              @click="openFolder(folder.id)"
            >
              {{ folder.name }}
            </button>
          </li>
        </ol>
      </nav>

      <header class="vault-list-grid vault-list-header">
        <div class="vault-list-heading">
          <h1 v-optical-align class="vault-list-title">{{ currentFolder?.name ?? 'Every link, in its vault.' }}</h1>
          <span class="vault-list-meta">{{ headingMeta }}</span>
        </div>
        <div class="vault-list-adds">
          <button type="button" class="vault-list-button" :disabled="isCreatingFolder" @click="isCreatingFolder = true">
            {{ currentFolder ? '+ New folder' : '+ New category' }}
          </button>
          <RouterLink
            v-if="canHoldLinks"
            :to="{ name: 'vault-new', query: { folder: currentFolder?.id } }"
            class="vault-list-button"
          >
            + New link
          </RouterLink>
          <button
            type="button"
            class="vault-list-button"
            :aria-pressed="isSelecting"
            @click="isSelecting = !isSelecting"
          >
            {{ isSelecting ? 'Done' : 'Select' }}
          </button>
        </div>
      </header>

      <div class="vault-list-rows" :class="{ 'custom-order': isCustomOrder && !isSelecting, selecting: isSelecting }">
        <ul v-if="isCreatingFolder" class="vault-list-group">
          <VaultListNewFolder :parent-id="currentFolder?.id ?? null" @done="isCreatingFolder = false" />
        </ul>
        <!-- Folders and links reorder apart: folders always come first. -->
        <VueDraggable
          v-model="orderedFolders"
          tag="ul"
          class="vault-list-group"
          :disabled="!isCustomOrder || isSelecting"
          :animation="150"
          :delay="200"
          :delay-on-touch-only="true"
          @end="saveFolderPosition"
        >
          <li
            v-for="folder in orderedFolders"
            :key="folder.id"
            class="vault-list-row vault-list-folder"
            :class="{ picked: picks.folderIds.includes(folder.id) }"
            @click="onFolderRowClick(folder.id)"
          >
            <span v-if="isSelecting" class="vault-list-check" aria-hidden="true"></span>
            <span class="vault-list-main">
              <button
                v-optical-align
                type="button"
                class="vault-list-folder-name"
                :aria-pressed="isSelecting ? picks.folderIds.includes(folder.id) : undefined"
                @click.stop="onFolderRowClick(folder.id)"
              >
                {{ folder.name }}
              </button>
            </span>
            <span class="vault-list-meta">{{ contentsLabel(folder.folderTotal, folder.linkTotal) }}</span>
            <span class="vault-list-end">
              <button
                type="button"
                class="vault-list-chevron"
                :aria-label="`Open ${folder.name}`"
                @click.stop="openFolder(folder.id)"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
              </button>
            </span>
          </li>
        </VueDraggable>
        <VueDraggable
          v-model="orderedLinks"
          tag="ul"
          class="vault-list-group"
          :disabled="!isCustomOrder || isSelecting"
          :animation="150"
          :delay="200"
          :delay-on-touch-only="true"
          @end="saveLinkPosition"
        >
          <VaultListLinkRow
            v-for="link in orderedLinks"
            :key="link.id"
            :link="link"
            :is-selecting="isSelecting"
            :is-picked="picks.linkIds.includes(link.id)"
            @pick="pickLink(link.id)"
          />
        </VueDraggable>
        <p v-if="!shownFolders.length && !shownLinks.length && !isCreatingFolder" class="vault-list-empty">
          {{ currentFolder ? 'Nothing in this folder yet.' : 'No categories yet.' }}
        </p>
        <p v-if="moveError" class="error">{{ moveError }}</p>
      </div>
    </template>

    <template v-else>
      <header class="vault-list-grid vault-list-header">
        <div class="vault-list-heading">
          <h1 v-optical-align class="vault-list-title">{{ pluralize(resultCount, 'result') }}</h1>
          <span class="vault-list-meta">In the whole vault. Each one says where it lives.</span>
        </div>
      </header>
      <ul class="vault-list-rows">
        <li
          v-for="result in searchResults.folders"
          :key="result.folder.id"
          class="vault-list-row vault-list-folder"
          @click="openFolder(result.folder.id)"
        >
          <span class="vault-list-main">
            <button v-optical-align type="button" class="vault-list-folder-name" @click.stop="openFolder(result.folder.id)">
              {{ result.folder.name }}
            </button>
          </span>
          <span class="vault-list-meta">{{ result.location || 'Category' }}</span>
          <span class="vault-list-end vault-list-chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 6l6 6-6 6" /></svg>
          </span>
        </li>
        <VaultListLinkRow
          v-for="result in searchResults.links"
          :key="result.link.id"
          :link="result.link"
          :location="result.location"
        />
        <li v-if="!resultCount" class="vault-list-empty">Nothing matches.</li>
      </ul>
    </template>

    <Transition name="vault-tray" :duration="{ enter: 1000, leave: 320 }">
      <VaultTray
        v-if="hasPicks"
        v-model:picks="picks"
        :vault="vault"
        :links="links"
        :current-folder-id="currentFolderId"
        @done="(message) => (trayMessage = message)"
      />
    </Transition>
  </section>
</template>
