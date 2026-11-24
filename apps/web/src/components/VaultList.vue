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
  searchNestedVault,
  sortForOrder,
  type NestedFolder,
} from '../lib/vaultTree'
import VaultListLinkRow from './VaultListLinkRow.vue'
import VaultListNewFolder from './VaultListNewFolder.vue'

// The list view shows one level at a time: the categories, or the subfolders and links of the folder
// in the URL (?in=). Searching lists matches from the whole Vault, each with where it lives.
// Order sorts folders and links by name or date; random and custom place tiles, so the list keeps names.
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
/** Sorts folders, links or search results by the chosen order, from the name and date each one gives. */
type SortKeys = { name: string; createdAt: string; sortPosition: number }

const isCustomOrder = computed(() => listOrder(props.preferences.order) === 'custom')

/** Sorts folders, links or search results by the chosen order, from the keys each one gives. */
function sortByOrder<Item>(items: Item[], sortKeys: (item: Item) => SortKeys) {
  const sortable = items.map((item) => ({ item, ...sortKeys(item) }))
  const sorted = isCustomOrder.value
    ? sortable.sort((first, second) => first.sortPosition - second.sortPosition)
    : sortForOrder(sortable, { ...props.preferences, order: listOrder(props.preferences.order) })
  return sorted.map((sortableItem) => sortableItem.item)
}
const folderSortKeys = ({ name, createdAt, sortPosition }: NestedFolder) => ({ name, createdAt, sortPosition })
/** A link sorts by its title, as a folder does by its name. */
const linkSortKeys = (link: VaultLink) => ({ name: link.title, createdAt: link.createdAt, sortPosition: link.sortPosition })

const shownFolders = computed(() =>
  sortByOrder(currentFolder.value?.subfolders ?? vault.value.categories, folderSortKeys),
)
const shownLinks = computed(() => sortByOrder(currentFolder.value?.links ?? [], linkSortKeys))
// Positions only compare within one folder, so in the custom order results keep the tree's order.
const searchResults = computed(() => {
  if (!props.query) return null
  const results = searchNestedVault(vault.value, props.query)
  if (isCustomOrder.value) return results
  return {
    folders: sortByOrder(results.folders, (result) => folderSortKeys(result.folder)),
    links: sortByOrder(results.links, (result) => linkSortKeys(result.link)),
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
watch(currentFolder, () => (isCreatingFolder.value = false))
</script>

<template>
  <section class="vault-list" aria-label="Vault list">
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
          <span class="vault-list-meta">{{ currentContentsLabel }}</span>
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
        </div>
      </header>

      <div class="vault-list-rows" :class="{ 'custom-order': isCustomOrder }">
        <ul v-if="isCreatingFolder" class="vault-list-group">
          <VaultListNewFolder :parent-id="currentFolder?.id ?? null" @done="isCreatingFolder = false" />
        </ul>
        <!-- Folders and links reorder apart: folders always come first. -->
        <VueDraggable
          v-model="orderedFolders"
          tag="ul"
          class="vault-list-group"
          :disabled="!isCustomOrder"
          :animation="150"
          :delay="200"
          :delay-on-touch-only="true"
          @end="saveFolderPosition"
        >
          <li v-for="folder in orderedFolders" :key="folder.id">
            <button type="button" class="vault-list-row vault-list-folder" @click="openFolder(folder.id)">
              <span v-optical-align class="vault-list-main vault-list-folder-name">{{ folder.name }}</span>
              <span class="vault-list-meta">{{ contentsLabel(folder.folderTotal, folder.linkTotal) }}</span>
              <span class="vault-list-end vault-list-chevron" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 6l6 6-6 6" /></svg>
              </span>
            </button>
          </li>
        </VueDraggable>
        <VueDraggable
          v-model="orderedLinks"
          tag="ul"
          class="vault-list-group"
          :disabled="!isCustomOrder"
          :animation="150"
          :delay="200"
          :delay-on-touch-only="true"
          @end="saveLinkPosition"
        >
          <VaultListLinkRow v-for="link in orderedLinks" :key="link.id" :link="link" />
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
        <li v-for="result in searchResults.folders" :key="result.folder.id">
          <button type="button" class="vault-list-row vault-list-folder" @click="openFolder(result.folder.id)">
            <span v-optical-align class="vault-list-main vault-list-folder-name">{{ result.folder.name }}</span>
            <span class="vault-list-meta">{{ result.location || 'Category' }}</span>
            <span class="vault-list-end vault-list-chevron" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 6l6 6-6 6" /></svg>
            </span>
          </button>
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
  </section>
</template>
