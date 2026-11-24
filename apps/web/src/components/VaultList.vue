<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { VaultPreferences } from '@webs/shared'
import type { VaultFolder, VaultLink } from '../lib/api'
import { vOpticalAlign } from '../lib/opticalAlign'
import {
  buildNestedVault,
  folderTrail,
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
function sortByOrder<Item>(items: Item[], sortKeys: (item: Item) => { name: string; createdAt: string }) {
  return sortForOrder(
    items.map((item) => ({ item, ...sortKeys(item) })),
    props.preferences,
  ).map((sortable) => sortable.item)
}
const folderSortKeys = (folder: NestedFolder) => ({ name: folder.name, createdAt: folder.createdAt })
/** A link sorts by its title, as a folder does by its name. */
const linkSortKeys = (link: VaultLink) => ({ name: link.title, createdAt: link.createdAt })

const shownFolders = computed(() =>
  sortByOrder(currentFolder.value?.subfolders ?? vault.value.categories, folderSortKeys),
)
const shownLinks = computed(() => sortByOrder(currentFolder.value?.links ?? [], linkSortKeys))
const searchResults = computed(() => {
  if (!props.query) return null
  const results = searchNestedVault(vault.value, props.query)
  return {
    folders: sortByOrder(results.folders, (result) => folderSortKeys(result.folder)),
    links: sortByOrder(results.links, (result) => linkSortKeys(result.link)),
  }
})

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

      <ul class="vault-list-rows">
        <VaultListNewFolder
          v-if="isCreatingFolder"
          :parent-id="currentFolder?.id ?? null"
          @done="isCreatingFolder = false"
        />
        <li v-for="folder in shownFolders" :key="folder.id">
          <button type="button" class="vault-list-row vault-list-folder" @click="openFolder(folder.id)">
            <span v-optical-align class="vault-list-main vault-list-folder-name">{{ folder.name }}</span>
            <span class="vault-list-meta">{{ contentsLabel(folder.folderTotal, folder.linkTotal) }}</span>
            <span class="vault-list-end vault-list-chevron" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 6l6 6-6 6" /></svg>
            </span>
          </button>
        </li>
        <VaultListLinkRow v-for="link in shownLinks" :key="link.id" :link="link" />
        <li v-if="!shownFolders.length && !shownLinks.length && !isCreatingFolder" class="vault-list-empty">
          {{ currentFolder ? 'Nothing in this folder yet.' : 'No categories yet.' }}
        </li>
      </ul>
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
