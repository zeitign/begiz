<script setup lang="ts">
import type { VaultPreferences } from '@webs/shared'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTileExpansion } from '../lib/useTileExpansion'
import {
  contentsCountLabel,
  nestedMatches,
  pluralize,
  sideColumnWidth,
  sortForOrder,
  type CategoryNode,
  type FolderNode,
} from '../lib/vaultTree'
import VaultFolderEditor from './VaultFolderEditor.vue'
import VaultFolderPanel from './VaultFolderPanel.vue'
import VaultFoldStrip from './VaultFoldStrip.vue'
import VaultIcon from './VaultIcon.vue'
import VaultNewFolderPanel from './VaultNewFolderPanel.vue'
import VaultPanelBar from './VaultPanelBar.vue'
import VaultTileGrid, { type PlacedCell, type VaultTile } from './VaultTileGrid.vue'

const props = defineProps<{
  category: CategoryNode
  query: string
  preferences: VaultPreferences
  /** While it slides and grows, only the name and icon are shown. */
  isMoving: boolean
}>()
const emit = defineEmits<{ close: []; deleted: []; place: [cells: PlacedCell[]] }>()

const route = useRoute()
const router = useRouter()

const folderCountLabel = computed(() => pluralize(props.category.nested.folderTotal, 'folder'))
const linkCountLabel = computed(() => pluralize(props.category.nested.linkTotal, 'link'))

// Editing the category replaces its folders on the right, like editing a folder replaces its links.
const isEditing = ref(false)
const draftIcon = ref(props.category.icon)
const shownIcon = computed(() => (isEditing.value ? draftIcon.value : props.category.icon))
const contentsLabel = computed(() =>
  props.category.nested.folderTotal
    ? `${pluralize(props.category.nested.folderTotal, 'folder')} and ${pluralize(props.category.nested.linkTotal, 'link')}`
    : '',
)

function startEditing() {
  draftIcon.value = props.category.icon
  isEditing.value = true
}

const folderTiles = computed<VaultTile[]>(() =>
  sortForOrder(props.category.folders, props.preferences).map((folder) => ({
    id: folder.id,
    name: folder.name,
    icon: folder.icon,
    gridCell: folder.gridCell,
    countLabel: contentsCountLabel(folder.nested, props.query),
  })),
)
const matchingFolderIds = computed(
  () =>
    new Set(
      props.category.folders.filter((folder) => nestedMatches(folder.nested, props.query)).map((folder) => folder.id),
    ),
)
/** Only when it adds something to the card: while searching, or when the category is empty. */
const introText = computed(() => {
  if (!props.query) return props.category.folders.length ? '' : 'No folders yet. Create one to save links in it.'
  const matchCount = matchingFolderIds.value.size
  return matchCount ? `${pluralize(matchCount, 'folder')} match “${props.query}”.` : `Nothing matches “${props.query}”.`
})

const folderGrid = ref<InstanceType<typeof VaultTileGrid>>()
const folderExpansion = useTileExpansion(
  {
    element: () => folderGrid.value?.boardElement,
    tileElement: (folderId) => folderGrid.value?.tileElement(folderId),
  },
  {
    cornerWidth: (folderId) =>
      sideColumnWidth(props.category.folders.find((folder) => folder.id === folderId)?.name ?? ''),
  },
)
const openFolder = computed(() =>
  props.category.folders.find((folder) => folder.id === folderExpansion.openTileId.value),
)

function keepFolderInUrl(folderId: string | null) {
  router.replace({
    query: folderId ? { category: props.category.id, folder: folderId } : { category: props.category.id },
  })
}

function openFolderTile(folderId: string) {
  keepFolderInUrl(folderId)
  folderExpansion.open(folderId)
}

// With a folder open, one of the two columns is folded into a strip: the category at first, and
// clicking a strip unfolds it and folds the other one.
type FoldedColumn = 'category' | 'folder' | null
const foldedColumn = ref<FoldedColumn>('category')
const isFolderOpen = computed(() => folderExpansion.phase.value === 'open' && Boolean(openFolder.value))
/** The category folds as soon as the folder heads for the corner, so both move together, and stays folded
 * until the folder's column has closed. */
const isFolderShown = computed(
  () => ['sliding', 'open', 'collapsing'].includes(folderExpansion.phase.value) && Boolean(openFolder.value),
)
const isCategoryFolded = computed(() => isFolderShown.value && foldedColumn.value === 'category')
const isFolderFolded = computed(() => isFolderOpen.value && foldedColumn.value === 'folder')
watch(
  () => folderExpansion.openTileId.value,
  () => (foldedColumn.value = 'category'),
)

/** As long as the fold's spring in style.css. */
const FOLD_MS = 600

/** The folder's column folds to the left first; then the category unfolds, and then the folder pops back. */
function closeFolder() {
  keepFolderInUrl(null)
  folderExpansion.close({ popDelay: isCategoryFolded.value ? FOLD_MS : 0 })
}

// The folder in the URL opens without motion once the category has finished opening.
watch(
  [() => route.query.folder, () => props.isMoving],
  ([folderInUrl]) => {
    if (props.isMoving) return
    const folder = props.category.folders.find((candidate) => candidate.id === folderInUrl)
    if (!folder) {
      if (folderExpansion.phase.value === 'open') folderExpansion.reset()
      return
    }
    if (folderExpansion.phase.value === 'closed') folderExpansion.showOpen(folder.id)
  },
  { immediate: true },
)

function handleFolderDeleted() {
  keepFolderInUrl(null)
  folderExpansion.reset()
}

// A new folder opens empty beside the category, where it gets its name; once saved, it is opened.
const isCreatingFolder = ref(false)

function openCreatedFolder(folderId: string) {
  isCreatingFolder.value = false
  keepFolderInUrl(folderId)
}
</script>

<template>
  <!-- A frame over the whole board: the category in a narrow column, its folders or its editor beside it. -->
  <section
    class="vault-panel vault-category-panel"
    :class="{ moving: isMoving, folded: isCategoryFolded }"
    :style="{ '--vault-side-width': `${sideColumnWidth(category.name)}px` }"
    :aria-label="category.name"
  >
    <div class="vault-panel-side">
      <Transition name="vault-fold">
        <VaultFoldStrip
          v-if="isCategoryFolded"
          :name="category.name"
          :icon="category.icon"
          @unfold="foldedColumn = 'folder'"
        />
        <div v-else class="vault-side-content">
          <div class="vault-identity">
            <h2 class="vault-identity-name">{{ category.name }}</h2>
            <span class="vault-identity-count vault-identity-counts">
              <span>{{ folderCountLabel }}</span>
              <span class="vault-identity-subcount">{{ linkCountLabel }}</span>
            </span>
            <VaultIcon :name="shownIcon" />
          </div>
          <div class="vault-panel-actions">
            <VaultPanelBar
              kind="category"
              :is-editing="isEditing"
              @edit="startEditing"
              back-label="Back to the vault"
              @close="emit('close')"
            />
            <div class="vault-panel-buttons">
              <button
                type="button"
                class="vault-panel-button"
                :disabled="isCreatingFolder"
                @click="isCreatingFolder = true"
              >
                New folder
              </button>
            </div>
            <p v-if="introText" class="vault-panel-note">{{ introText }}</p>
          </div>
        </div>
      </Transition>
    </div>

    <div class="vault-panel-main">
      <template v-if="isEditing">
        <span class="mono-label vault-panel-heading">Edit category</span>
        <VaultFolderEditor
          v-model:icon="draftIcon"
          :folder="category"
          :contents-label="contentsLabel"
          @done="isEditing = false"
          @deleted="emit('deleted')"
        />
      </template>

      <VaultNewFolderPanel
        v-else-if="isCreatingFolder"
        :category-id="category.id"
        @cancel="isCreatingFolder = false"
        @created="openCreatedFolder"
      />

      <VaultTileGrid
        v-else
        ref="folderGrid"
        class="vault-folder-board"
        :tiles="folderTiles"
        :order="preferences.order"
        :matching-tile-ids="query ? matchingFolderIds : null"
        :hidden-tile-id="folderExpansion.hiddenTileId.value"
        :popping-tile-id="folderExpansion.poppingTileId.value"
        :is-hiding-tiles="folderExpansion.isHidingTiles.value"
        :shows-tiles="folderExpansion.showsTiles.value"
        :has-intro="false"
        @open="openFolderTile"
        @place="emit('place', $event)"
      >
        <VaultFolderPanel
          v-if="openFolder && folderExpansion.isPanelShown.value"
          :key="openFolder.id"
          :class="{
            floating: folderExpansion.isMoving.value,
            grown: folderExpansion.isGrown.value,
            'in-corner': folderExpansion.isInCorner.value,
          }"
          :style="folderExpansion.panelStyle.value"
          :folder="openFolder"
          :query="query"
          :preferences="preferences"
          :is-moving="folderExpansion.isMoving.value"
          :is-folded="isFolderFolded"
          @unfold="foldedColumn = 'category'"
          @close="closeFolder"
          @deleted="handleFolderDeleted"
        />
      </VaultTileGrid>
    </div>
  </section>
</template>
