<script setup lang="ts">
import type { VaultPreferences } from '@webs/shared'
import { computed, ref, watch } from 'vue'
import {
  contentsCountLabel,
  folderSortKeys,
  linkMatches,
  linkSortKeys,
  nestedMatches,
  sortByListOrder,
  type NestedFolder,
} from '../lib/vaultTree'
import VaultIcon from './VaultIcon.vue'
import VaultLinkRow from './VaultLinkRow.vue'

// The contents of an open folder at any depth, as a stack of levels. Opening a folder that holds
// folders adds a level below; the levels above shrink step by step, so the deepest one has the room.
// The links shown are those of the deepest open folder.
const props = defineProps<{
  folder: NestedFolder
  query: string
  preferences: VaultPreferences
}>()

/** The open folder of each level, from the top level down. */
const openFolderIds = ref<string[]>([])
watch(
  () => props.folder.id,
  () => (openFolderIds.value = []),
)

const openFolders = computed(() => {
  const opened: NestedFolder[] = []
  let parent = props.folder
  for (const folderId of openFolderIds.value) {
    const child = parent.subfolders.find((subfolder) => subfolder.id === folderId)
    if (!child) break
    opened.push(child)
    parent = child
  }
  return opened
})

const visibleFolders = (parent: NestedFolder) => {
  const folders = props.query
    ? parent.subfolders.filter((subfolder) => nestedMatches(subfolder, props.query))
    : parent.subfolders
  return sortByListOrder(folders, props.preferences, folderSortKeys)
}

/** A level for the folder itself and for each open folder that holds folders. */
const levels = computed(() =>
  [props.folder, ...openFolders.value]
    .filter((parent, index) => index === 0 || parent.subfolders.length > 0)
    .map((parent, index) => ({ parent, depth: index, folders: visibleFolders(parent) }))
    .filter((level) => level.folders.length > 0),
)

/** How far a level is from the deepest one, which sets its size: 0 is the largest, 3 a thin strip. */
const sizeStep = (depth: number) => Math.min(levels.value.length - 1 - depth, 3)

const currentFolder = computed(() => openFolders.value.at(-1) ?? props.folder)
const shownLinks = computed(() => {
  const links = props.query
    ? currentFolder.value.links.filter((link) => linkMatches(link, props.query))
    : currentFolder.value.links
  return sortByListOrder(links, props.preferences, linkSortKeys)
})

/** Opens a folder at its level, closing what was open below. Opening the deepest open one closes it. */
function toggleFolder(depth: number, folderId: string) {
  const isLastOpen = openFolderIds.value[depth] === folderId && openFolderIds.value.length === depth + 1
  openFolderIds.value = isLastOpen
    ? openFolderIds.value.slice(0, depth)
    : [...openFolderIds.value.slice(0, depth), folderId]
}
</script>

<template>
  <div class="vault-stack">
    <section v-for="level in levels" :key="level.parent.id" class="vault-stack-level" :aria-label="`In ${level.parent.name}`">
      <p class="vault-stack-label" :class="{ current: sizeStep(level.depth) === 0 }">In {{ level.parent.name }}</p>
      <div class="vault-stack-cards">
        <button
          v-for="(subfolder, cardIndex) in level.folders"
          :key="subfolder.id"
          type="button"
          class="vault-stack-card"
          :class="[`size-${sizeStep(level.depth)}`, { open: openFolderIds[level.depth] === subfolder.id }]"
          :style="{ animationDelay: `${cardIndex * 60}ms` }"
          :aria-expanded="openFolderIds[level.depth] === subfolder.id"
          @click="toggleFolder(level.depth, subfolder.id)"
        >
          <span class="vault-stack-card-name">{{ subfolder.name }}</span>
          <span class="vault-stack-card-count">{{ contentsCountLabel(subfolder, query) }}</span>
          <VaultIcon :name="subfolder.icon" />
        </button>
      </div>
    </section>

    <section class="vault-stack-links" :aria-label="`Links in ${currentFolder.name}`">
      <p v-if="levels.length" class="vault-stack-label current">Links in {{ currentFolder.name }}</p>
      <p v-if="!shownLinks.length" class="muted vault-panel-message">
        {{ query ? 'No links here match the search.' : 'No links right here.' }}
      </p>
      <ul v-else :key="currentFolder.id" class="vault-links">
        <VaultLinkRow v-for="link in shownLinks" :key="link.id" :link="link" />
      </ul>
    </section>
  </div>
</template>
