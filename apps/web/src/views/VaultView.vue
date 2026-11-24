<script setup lang="ts">
import {
  defaultSortDirection,
  defaultVaultPreferences,
  sortDirections,
  vaultOrders,
  vaultViews,
  type SortDirection,
  type VaultOrder,
  type VaultPreferences,
  type VaultView,
} from '@webs/shared'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FilterDropdown from '../components/FilterDropdown.vue'
import VaultCategoryPanel from '../components/VaultCategoryPanel.vue'
import VaultFaviconFilter from '../components/VaultFaviconFilter.vue'
import VaultList from '../components/VaultList.vue'
import VaultNewCategoryCard from '../components/VaultNewCategoryCard.vue'
import VaultTileGrid, { type PlacedCell, type VaultTile } from '../components/VaultTileGrid.vue'
import { errorMessage } from '../lib/api'
import {
  useInvalidateVault,
  usePlaceVaultTiles,
  useSaveVaultPreferences,
  useVaultFolders,
  useVaultLinks,
  useVaultPreferences,
} from '../lib/queries'
import { useTileExpansion } from '../lib/useTileExpansion'
import { useTypewriter } from '../lib/typewriter'
import {
  buildVaultTree,
  categoryLinkCount,
  categoryMatches,
  linkMatches,
  listOrder,
  listOrders,
  normalizeSearch,
  pluralize,
  sideColumnWidth,
  sortForOrder,
  type CategoryNode,
} from '../lib/vaultTree'

// Home shows the intro and the categories. Opening one slides it to the corner and grows it into a frame
// that fills the screen, with the category in a narrow column and its folders beside it (?category=).
// A folder opens the same way inside the frame, with its links (&folder=).
const route = useRoute()
const router = useRouter()
const invalidateVault = useInvalidateVault()

const { data: folders, isPending: areFoldersPending, error: foldersError } = useVaultFolders()
const { data: links, isPending: areLinksPending, error: linksError } = useVaultLinks()

const loadError = computed(() => foldersError.value ?? linksError.value)
const vaultTree = computed(() => buildVaultTree(folders.value ?? [], links.value ?? []))

const ORDER_LABELS: Record<VaultOrder, string> = {
  random: 'Random',
  name: 'Name',
  date: 'Date added',
  custom: 'Custom order',
}

const DIRECTION_LABELS: Record<SortDirection, string> = {
  asc: '↑ Asc',
  desc: '↓ Desc',
}

const VIEW_LABELS: Record<VaultView, string> = {
  tiles: 'Tiles',
  list: 'List',
}

const { data: savedPreferences, isPending: arePreferencesPending } = useVaultPreferences()
const preferences = computed(() => savedPreferences.value ?? defaultVaultPreferences)
// The grid waits for the saved order too, so the tiles appear in their places instead of jumping to them.
const isPending = computed(() => areFoldersPending.value || areLinksPending.value || arePreferencesPending.value)
const isListView = computed(() => preferences.value.view === 'list')
/** The list has no random order: it offers the rest and reads random as name. */
const shownOrders = computed(() => (isListView.value ? listOrders : vaultOrders))
const shownOrder = computed(() => (isListView.value ? listOrder(preferences.value.order) : preferences.value.order))
const offersDirection = (order: VaultOrder) => order === 'name' || order === 'date'
const hasDirection = computed(() => offersDirection(shownOrder.value))
const saveVaultPreferences = useSaveVaultPreferences()
const placeVaultTiles = usePlaceVaultTiles()
const orderError = ref('')

async function savePreferences(changes: Partial<VaultPreferences>) {
  orderError.value = ''
  try {
    await saveVaultPreferences({ ...preferences.value, ...changes })
  } catch (error) {
    orderError.value = errorMessage(error)
  }
}

/** A new order starts in its usual direction, as in the mosaic: names A→Z, newest first. */
const chooseOrder = (order: VaultOrder) =>
  savePreferences({ order, direction: order === 'date' ? defaultSortDirection.date : defaultSortDirection.title })

/** Picking an order folds the menu, unless it still asks for a direction: then choosing one folds it. */
function pickOrder(order: VaultOrder, closeMenu: () => void) {
  chooseOrder(order)
  if (!offersDirection(order)) closeMenu()
}

/** Each view keeps its own place in the URL, so switching starts the other one from its top. */
function chooseView(view: VaultView) {
  router.replace({ query: {} })
  categoryExpansion.reset()
  savePreferences({ view })
}

/** Shared by both grids: tiles dropped in a new cell. */
async function placeTiles(cells: PlacedCell[]) {
  orderError.value = ''
  try {
    await placeVaultTiles(cells)
  } catch (error) {
    orderError.value = errorMessage(error)
  }
}

const searchPlaceholder = useTypewriter(['THAT FONT SITE?', 'THAT TOOL?', 'THE ARTICLE?', 'THAT DOC?', 'THE GOOD ONE?'])
const searchInput = ref('')
const query = computed(() => normalizeSearch(searchInput.value))

function categoryTile(category: CategoryNode): VaultTile {
  const linkCount = categoryLinkCount(category)
  const matchingLinkCount = category.folders.reduce(
    (total, folder) => total + folder.links.filter((link) => linkMatches(link, query.value)).length,
    0,
  )
  return {
    id: category.id,
    name: category.name,
    icon: category.icon,
    gridCell: category.gridCell,
    countLabel: query.value
      ? `${matchingLinkCount} of ${pluralize(linkCount, 'link')}`
      : `${pluralize(category.folders.length, 'folder')} · ${pluralize(linkCount, 'link')}`,
  }
}

const categoryTiles = computed(() => sortForOrder(vaultTree.value.categories, preferences.value).map(categoryTile))
const categoryCountLabel = computed(() => pluralize(vaultTree.value.categories.length, 'category', 'categories'))
const matchingCategoryIds = computed(
  () =>
    new Set(
      vaultTree.value.categories
        .filter((category) => categoryMatches(category, query.value))
        .map((category) => category.id),
    ),
)

const categoryGrid = ref<InstanceType<typeof VaultTileGrid>>()
const categoryExpansion = useTileExpansion(
  {
    element: () => categoryGrid.value?.boardElement,
    tileElement: (categoryId) => categoryGrid.value?.tileElement(categoryId),
  },
  {
    drawsFrame: true,
    cornerWidth: (categoryId) => sideColumnWidth(vaultTree.value.categoriesById.get(categoryId)?.name ?? ''),
  },
)
const openCategory = computed(() =>
  categoryExpansion.openTileId.value
    ? vaultTree.value.categoriesById.get(categoryExpansion.openTileId.value)
    : undefined,
)

function openCategoryTile(categoryId: string) {
  router.replace({ query: { category: categoryId } })
  categoryExpansion.open(categoryId)
}

function closeCategory() {
  router.replace({ query: {} })
  categoryExpansion.close()
}

function handleCategoryDeleted() {
  router.replace({ query: {} })
  categoryExpansion.reset()
}

// The category in the URL opens without motion: after a reload, or coming back from saving a link.
watch(
  [() => route.query.category, isPending],
  ([categoryInUrl]) => {
    if (isPending.value) return
    const category = typeof categoryInUrl === 'string' ? vaultTree.value.categoriesById.get(categoryInUrl) : undefined
    if (!category) {
      if (categoryExpansion.phase.value === 'open') categoryExpansion.reset()
      return
    }
    if (categoryExpansion.phase.value === 'closed') categoryExpansion.showOpen(category.id)
  },
  { immediate: true },
)

// A new category is edited in a card next to the intro. Once created, the card leaves its place to the
// real tile, which stays hidden until the grid has it and then pops in.
const isCreatingCategory = ref(false)
const createdCategoryId = ref<string | null>(null)
const poppingCategoryId = ref<string | null>(null)
const POP_MS = 500

async function showCreatedCategory(categoryId: string) {
  createdCategoryId.value = categoryId
  await invalidateVault()
  isCreatingCategory.value = false
  createdCategoryId.value = null
  poppingCategoryId.value = categoryId
  setTimeout(() => {
    if (poppingCategoryId.value === categoryId) poppingCategoryId.value = null
  }, POP_MS)
}
</script>

<template>
  <main class="page wide stack vault-page">
    <VaultFaviconFilter />
    <div class="filter-bar">
      <div class="search-sentence">
        <label for="vault-search" class="search-sentence-text">I'm gonna search</label>
        <div class="search-box">
          <input
            id="vault-search"
            v-model="searchInput"
            type="search"
            :placeholder="searchPlaceholder.displayedText.value"
            @focus="searchPlaceholder.pause"
            @blur="searchPlaceholder.resume"
          />
          <span class="filter-stripes" aria-hidden="true"></span>
        </div>
        <span class="search-sentence-text">in this vault</span>
      </div>
      <div class="filter-frame">
        <div class="filter-cells vault-filter-cells">
          <FilterDropdown v-slot="{ close }" label="Order">
            <label v-for="order in shownOrders" :key="order" class="filter-option">
              <input
                type="radio"
                name="vault-order"
                :checked="shownOrder === order"
                @change="pickOrder(order, close)"
              />
              <span>{{ ORDER_LABELS[order] }}</span>
            </label>
            <div v-if="hasDirection" class="order-direction" role="group" aria-label="Direction">
              <button
                v-for="direction in sortDirections"
                :key="direction"
                type="button"
                :aria-pressed="preferences.direction === direction"
                @click="savePreferences({ direction }); close()"
              >
                {{ DIRECTION_LABELS[direction] }}
              </button>
            </div>
            <p v-if="shownOrder === 'custom'" class="filter-option muted">
              {{ isListView ? 'Drag a row to reorder.' : 'Drag a card to any cell.' }}
            </p>
          </FilterDropdown>
          <div class="vault-view-switch" role="group" aria-label="View">
            <button
              v-for="view in vaultViews"
              :key="view"
              type="button"
              :aria-pressed="preferences.view === view"
              @click="chooseView(view)"
            >
              {{ VIEW_LABELS[view] }}
            </button>
          </div>
          <p class="filter-count">{{ categoryCountLabel }}</p>
        </div>
        <span class="filter-stripes" aria-hidden="true"></span>
      </div>
    </div>
    <p v-if="orderError" class="error">{{ orderError }}</p>

    <p v-if="loadError" class="error">{{ loadError.message }}</p>
    <p v-else-if="isPending">Loading…</p>
    <VaultList
      v-else-if="isListView"
      :folders="folders ?? []"
      :links="links ?? []"
      :query="query"
      :preferences="preferences"
      @clear-search="searchInput = ''"
    />
    <VaultTileGrid
      v-else
      ref="categoryGrid"
      :tiles="categoryTiles"
      :order="preferences.order"
      :matching-tile-ids="query ? matchingCategoryIds : null"
      :hidden-tile-id="categoryExpansion.hiddenTileId.value ?? createdCategoryId"
      :popping-tile-id="poppingCategoryId"
      :is-hiding-tiles="categoryExpansion.isHidingTiles.value"
      :shows-tiles="categoryExpansion.showsTiles.value"
      @open="openCategoryTile"
      @place="placeTiles"
    >
      <template #intro>
        <h1 class="vault-intro-title">Every link, in its vault.</h1>
        <button
          type="button"
          class="vault-intro-button"
          :disabled="isCreatingCategory"
          @click="isCreatingCategory = true"
        >
          + New category
        </button>
      </template>
      <template #after-intro>
        <VaultNewCategoryCard
          v-if="isCreatingCategory"
          @cancel="isCreatingCategory = false"
          @created="showCreatedCategory"
        />
      </template>

      <span
        v-if="categoryExpansion.isDrawingFrame.value"
        class="vault-frame-drawing"
        :style="{
          '--vault-corner-width': `${sideColumnWidth(openCategory?.name ?? '')}px`,
          '--vault-corner-height': `${categoryExpansion.tileSize.value}px`,
        }"
        aria-hidden="true"
      ></span>
      <VaultCategoryPanel
        v-if="openCategory && categoryExpansion.isPanelShown.value"
        :key="openCategory.id"
        :class="{
          floating: categoryExpansion.isMoving.value,
          grown: categoryExpansion.isGrown.value,
          'in-corner': categoryExpansion.isInCorner.value,
        }"
        :style="categoryExpansion.panelStyle.value"
        :category="openCategory"
        :query="query"
        :preferences="preferences"
        :is-moving="categoryExpansion.isMoving.value"
        @close="closeCategory"
        @deleted="handleCategoryDeleted"
        @place="placeTiles"
      />
    </VaultTileGrid>
  </main>
</template>
