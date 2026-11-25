<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MoveRefusal, NestedFolder, NestedVault } from '../lib/vaultTree'
import VaultNewFolderForm from './VaultNewFolderForm.vue'

// The whole Vault as a tree of folders that unfold, to choose where something goes. Folders that
// cannot be chosen stay in the tree, greyed out, with a note saying why; their name unfolds them instead.
// Where folders can be made (canCreateFolders), each row offers Add folder on hover and a new category
// can be started from outside.
const props = defineProps<{
  vault: NestedVault
  /** Why a folder (null = among the categories) cannot be chosen, or null when it can. */
  refusalOf: (folderId: string | null) => MoveRefusal | null
  /** Folders unfolded from the start, such as the trail to where you are. */
  openIds: string[]
  /** A first row to choose the categories themselves as the place, when that makes sense. */
  rootLabel?: string
  /** The folder chosen so far, shown pressed. */
  chosenId?: string | null
  canCreateFolders?: boolean
  /** Without the notes saying why a folder cannot be chosen, where the rule is plain anyway. */
  hidesNotes?: boolean
}>()
const emit = defineEmits<{
  choose: [folderId: string | null]
  created: [folder: { id: string; parentId: string | null }]
}>()

const REFUSAL_NOTES: Record<MoveRefusal, string> = {
  here: 'Here',
  itself: 'Itself',
  noLinks: 'No links',
  hasLinks: 'Has links',
}

const unfoldedIds = ref(new Set(props.openIds))

function toggleFolder(folderId: string) {
  if (unfoldedIds.value.has(folderId)) unfoldedIds.value.delete(folderId)
  else unfoldedIds.value.add(folderId)
}

/** Where a new folder is being named: inside a folder, among the categories, or nowhere. */
const NEW_CATEGORY = 'new-category'
const creatingIn = ref<string | null>(null)

function startFolderIn(folderId: string) {
  unfoldedIds.value.add(folderId)
  creatingIn.value = folderId
}

/** A new category opens straight away with the field for its first folder, since links need one. */
function onCreated(folder: { id: string; parentId: string | null }) {
  if (folder.parentId === null) startFolderIn(folder.id)
  else {
    unfoldedIds.value.add(folder.parentId)
    creatingIn.value = null
  }
  emit('created', folder)
}

defineExpose({ startCategory: () => (creatingIn.value = NEW_CATEGORY) })

type TreeRow = { folder: NestedFolder; depth: number; isUnfolded: boolean; note: string; isRefused: boolean }

const rows = computed(() => {
  const treeRows: TreeRow[] = []
  const addRows = (folders: NestedFolder[], depth: number) => {
    for (const folder of folders) {
      const isUnfolded = unfoldedIds.value.has(folder.id) || creatingIn.value === folder.id
      const refusal = props.refusalOf(folder.id)
      const note = refusal && !props.hidesNotes ? REFUSAL_NOTES[refusal] : ''
      treeRows.push({ folder, depth, isUnfolded, note, isRefused: refusal !== null })
      if (isUnfolded) addRows(folder.subfolders, depth + 1)
    }
  }
  addRows(props.vault.categories, 0)
  return treeRows
})

const rootRefusal = computed(() => props.refusalOf(null))
</script>

<template>
  <ul class="vault-tree">
    <li v-if="rootLabel" class="vault-tree-row">
      <span class="vault-tree-toggle" aria-hidden="true"></span>
      <button
        type="button"
        class="vault-tree-target vault-tree-category"
        :disabled="rootRefusal !== null"
        @click="emit('choose', null)"
      >
        <span>{{ rootLabel }}</span>
        <span v-if="rootRefusal" class="vault-tree-note">{{ REFUSAL_NOTES[rootRefusal] }}</span>
      </button>
    </li>
    <li v-for="row in rows" :key="row.folder.id">
      <div class="vault-tree-row" :style="{ paddingLeft: `${row.depth * 18}px` }">
        <button
          v-if="row.folder.subfolders.length"
          type="button"
          class="vault-tree-toggle"
          :aria-expanded="row.isUnfolded"
          :aria-label="`Show the folders in ${row.folder.name}`"
          @click="toggleFolder(row.folder.id)"
        >
          <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
        <span v-else class="vault-tree-toggle" aria-hidden="true"></span>
        <!-- A folder that cannot be chosen unfolds from its name, when it has something inside. -->
        <button
          v-if="row.isRefused"
          type="button"
          class="vault-tree-target refused"
          :class="{ 'vault-tree-category': row.depth === 0 }"
          :disabled="!row.folder.subfolders.length"
          :aria-expanded="row.folder.subfolders.length ? row.isUnfolded : undefined"
          @click="toggleFolder(row.folder.id)"
        >
          <span>{{ row.folder.name }}</span>
          <span v-if="row.note" class="vault-tree-note">{{ row.note }}</span>
        </button>
        <button
          v-else
          type="button"
          class="vault-tree-target"
          :class="{ 'vault-tree-category': row.depth === 0 }"
          :aria-pressed="chosenId !== undefined ? row.folder.id === chosenId : undefined"
          @click="emit('choose', row.folder.id)"
        >
          <span>{{ row.folder.name }}</span>
          <span v-if="row.note" class="vault-tree-note">{{ row.note }}</span>
        </button>
        <button
          v-if="canCreateFolders"
          type="button"
          class="vault-tree-add"
          :aria-label="`New folder in ${row.folder.name}`"
          @click="startFolderIn(row.folder.id)"
        >
          Add folder
        </button>
      </div>
      <VaultNewFolderForm
        v-if="creatingIn === row.folder.id"
        class="vault-tree-new-folder"
        :style="{ paddingLeft: `${(row.depth + 1) * 18 + 26}px` }"
        :parent-id="row.folder.id"
        :placeholder="row.depth === 0 ? `Name a folder in ${row.folder.name}` : 'Name the folder'"
        @created="onCreated"
        @cancel="creatingIn = null"
      />
    </li>
    <li v-if="creatingIn === NEW_CATEGORY">
      <VaultNewFolderForm
        class="vault-tree-new-folder"
        style="padding-left: 26px"
        :parent-id="null"
        placeholder="Name the category"
        @created="onCreated"
        @cancel="creatingIn = null"
      />
    </li>
  </ul>
</template>
