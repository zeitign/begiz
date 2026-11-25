<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MoveRefusal, NestedFolder, NestedVault } from '../lib/vaultTree'

// The whole Vault as a tree of folders that unfold, to choose where something goes. Folders that
// cannot be chosen stay in the tree, greyed out, with a note saying why.
const props = defineProps<{
  vault: NestedVault
  /** Why a folder (null = among the categories) cannot be chosen, or null when it can. */
  refusalOf: (folderId: string | null) => MoveRefusal | null
  /** Folders unfolded from the start, such as the trail to where you are. */
  openIds: string[]
}>()
const emit = defineEmits<{ choose: [folderId: string | null] }>()

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

type TreeRow = { folder: NestedFolder; depth: number; isUnfolded: boolean; refusal: MoveRefusal | null }

const rows = computed(() => {
  const treeRows: TreeRow[] = []
  const addRows = (folders: NestedFolder[], depth: number) => {
    for (const folder of folders) {
      const isUnfolded = unfoldedIds.value.has(folder.id)
      treeRows.push({ folder, depth, isUnfolded, refusal: props.refusalOf(folder.id) })
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
    <li class="vault-tree-row">
      <span class="vault-tree-toggle" aria-hidden="true"></span>
      <button
        type="button"
        class="vault-tree-target vault-tree-category"
        :disabled="rootRefusal !== null"
        @click="emit('choose', null)"
      >
        <span>Vault · as categories</span>
        <span v-if="rootRefusal" class="vault-tree-note">{{ REFUSAL_NOTES[rootRefusal] }}</span>
      </button>
    </li>
    <li
      v-for="row in rows"
      :key="row.folder.id"
      class="vault-tree-row"
      :style="{ paddingLeft: `${row.depth * 18}px` }"
    >
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
      <button
        type="button"
        class="vault-tree-target"
        :class="{ 'vault-tree-category': row.depth === 0 }"
        :disabled="row.refusal !== null"
        @click="emit('choose', row.folder.id)"
      >
        <span>{{ row.folder.name }}</span>
        <span v-if="row.refusal" class="vault-tree-note">{{ REFUSAL_NOTES[row.refusal] }}</span>
      </button>
    </li>
  </ul>
</template>
