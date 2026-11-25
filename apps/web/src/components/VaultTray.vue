<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api, errorMessage, responseBody, type VaultLink } from '../lib/api'
import { useInvalidateVault } from '../lib/queries'
import {
  folderTrail,
  moveRefusal,
  pluralize,
  type MoveRefusal,
  type NestedVault,
  type VaultPicks,
} from '../lib/vaultTree'
import VaultFolderTree from './VaultFolderTree.vue'

// The tray holds what was picked in the list while you move around the Vault. From it, everything goes
// at once to a folder chosen in its tree, or to the folder open in the list, or is deleted.
const props = defineProps<{
  vault: NestedVault
  links: VaultLink[]
  /** The folder open in the list; null on the categories. */
  currentFolderId: string | null
}>()
const picks = defineModel<VaultPicks>('picks', { required: true })
const emit = defineEmits<{ done: [message: string] }>()

const invalidateVault = useInvalidateVault()
const isChoosingPlace = ref(false)
const isConfirmingDelete = ref(false)
const isSaving = ref(false)
const actionError = ref('')

const REFUSAL_REASONS: Record<MoveRefusal, string> = {
  here: 'They already live here',
  itself: 'A folder can’t go inside itself',
  noLinks: 'Links need a folder',
  hasLinks: 'A category holds no links',
}

const pickCount = computed(() => picks.value.folderIds.length + picks.value.linkIds.length)
const pickCountLabel = computed(() => pluralize(pickCount.value, 'item'))
/** The sheets that peek out from under the card: one per extra pick, up to two. */
const sheetCount = computed(() => Math.min(pickCount.value - 1, 2))

// Each new pick lands on the card with a small hop, so the tray answers every tap.
const card = ref<HTMLElement>()
const HOP_EASING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
watch(pickCount, (newCount, oldCount) => {
  if (newCount <= oldCount || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  card.value?.animate([{ translate: '0 0' }, { translate: '0 -6px' }, { translate: '0 0' }], {
    duration: 320,
    easing: HOP_EASING,
  })
})

const placeName = (folderId: string | null) =>
  folderId ? (props.vault.foldersById.get(folderId)?.name ?? 'that folder') : 'the categories'
const origin = (parentId: string | null) => (parentId ? `from ${placeName(parentId)}` : 'category')

const pickedItems = computed(() => [
  ...picks.value.folderIds.flatMap((folderId) => {
    const folder = props.vault.foldersById.get(folderId)
    if (!folder) return []
    return [{ id: folderId, isFolder: true, name: folder.name, origin: origin(folder.parentId) }]
  }),
  ...picks.value.linkIds.flatMap((linkId) => {
    const link = props.links.find((candidate) => candidate.id === linkId)
    if (!link) return []
    return [{ id: linkId, isFolder: false, name: link.title, origin: origin(link.folderId) }]
  }),
])

function unpick(itemId: string) {
  picks.value = {
    folderIds: picks.value.folderIds.filter((folderId) => folderId !== itemId),
    linkIds: picks.value.linkIds.filter((linkId) => linkId !== itemId),
  }
  isConfirmingDelete.value = false
}

const emptyTray = () => (picks.value = { folderIds: [], linkIds: [] })

const refusalOf = (destinationId: string | null) => moveRefusal(props.vault, props.links, picks.value, destinationId)
const hereRefusal = computed(() => refusalOf(props.currentFolderId))
const openFolderIds = computed(() =>
  props.currentFolderId ? folderTrail(props.currentFolderId, props.vault).map((folder) => folder.id) : [],
)

/** What deleting takes with it: everything below the picked folders, counted once when one holds another. */
const deleteQuestion = computed(() => {
  const { folderIds, linkIds } = picks.value
  const pickedFolders = folderIds.flatMap((folderId) => props.vault.foldersById.get(folderId) ?? [])
  const isInsideAnotherPick = (folderId: string) =>
    folderTrail(folderId, props.vault)
      .slice(0, -1)
      .some((folderAbove) => folderIds.includes(folderAbove.id))
  const insideCount = pickedFolders
    .filter((folder) => !isInsideAnotherPick(folder.id))
    .reduce((total, folder) => total + folder.folderTotal + folder.linkTotal, 0)
  const parts = [
    folderIds.length ? pluralize(folderIds.length, 'folder') : '',
    linkIds.length ? pluralize(linkIds.length, 'link') : '',
  ].filter(Boolean)
  return `Delete ${parts.join(' and ')}${insideCount ? `, with ${insideCount} inside` : ''}?`
})

async function runTrayAction(request: () => Promise<unknown>, doneMessage: string) {
  isSaving.value = true
  actionError.value = ''
  try {
    await request()
    // Before refreshing: the refresh drops picks that no longer exist, which closes the tray.
    emit('done', doneMessage)
    emptyTray()
    await invalidateVault()
  } catch (error) {
    actionError.value = errorMessage(error)
  } finally {
    isSaving.value = false
    isChoosingPlace.value = false
    isConfirmingDelete.value = false
  }
}

const moveTo = (destinationId: string | null) =>
  runTrayAction(
    () => responseBody(api.vault.move.$post({ json: { ...picks.value, folderId: destinationId } })),
    `${pickCountLabel.value} moved to ${placeName(destinationId)}.`,
  )

const deletePicked = () =>
  runTrayAction(() => responseBody(api.vault.delete.$post({ json: picks.value })), `${pickCountLabel.value} deleted.`)
</script>

<template>
  <aside class="vault-tray" aria-label="Picked items">
    <TransitionGroup name="vault-tray-sheet">
      <span
        v-for="sheet in sheetCount"
        :key="sheet"
        class="vault-tray-sheet"
        :class="`sheet-${sheet}`"
        aria-hidden="true"
      ></span>
    </TransitionGroup>
    <div ref="card" class="vault-tray-card">
      <template v-if="isChoosingPlace">
        <div class="vault-tray-head">
          <h2 class="vault-tray-title">Move {{ pickCountLabel }} to</h2>
          <button type="button" class="vault-tray-text-button" @click="isChoosingPlace = false">← Back</button>
        </div>
        <VaultFolderTree
          class="vault-tray-tree"
          :vault="vault"
          root-label="Vault · as categories"
          :refusal-of="refusalOf"
          :open-ids="openFolderIds"
          @choose="moveTo"
        />
      </template>

      <template v-else>
        <div class="vault-tray-head">
          <h2 class="vault-tray-title">{{ pickCountLabel }} picked</h2>
          <button type="button" class="vault-tray-text-button" @click="emptyTray">Empty</button>
        </div>
        <ul class="vault-tray-items">
          <li v-for="item in pickedItems" :key="item.id" class="vault-tray-item">
            <span class="vault-tray-kind" aria-hidden="true">{{ item.isFolder ? '▪' : '↗' }}</span>
            <span class="vault-tray-name">{{ item.name }}</span>
            <span class="vault-tray-origin">{{ item.origin }}</span>
            <button
              type="button"
              class="vault-tray-text-button"
              :aria-label="`Put ${item.name} back`"
              @click="unpick(item.id)"
            >
              ×
            </button>
          </li>
        </ul>
        <span class="filter-stripes" aria-hidden="true"></span>
        <template v-if="isConfirmingDelete">
          <p class="vault-tray-question">{{ deleteQuestion }}</p>
          <div class="vault-tray-actions">
            <button type="button" class="vault-tray-action" :disabled="isSaving" @click="deletePicked">
              {{ isSaving ? 'Deleting…' : 'Delete' }}
            </button>
            <button type="button" class="vault-tray-action" @click="isConfirmingDelete = false">Keep</button>
          </div>
        </template>
        <template v-else>
          <div class="vault-tray-actions">
            <button type="button" class="vault-tray-action" :disabled="isSaving" @click="isChoosingPlace = true">
              Move to…
            </button>
            <button type="button" class="vault-tray-action" :disabled="isSaving" @click="isConfirmingDelete = true">
              Delete
            </button>
          </div>
          <div class="vault-tray-actions">
            <button
              type="button"
              class="vault-tray-action"
              :disabled="isSaving || hereRefusal !== null"
              @click="moveTo(currentFolderId)"
            >
              {{ hereRefusal ? REFUSAL_REASONS[hereRefusal] : `Move here, to ${placeName(currentFolderId)}` }}
            </button>
          </div>
        </template>
      </template>
      <p v-if="actionError" class="error vault-tray-error">{{ actionError }}</p>
    </div>
  </aside>
</template>
