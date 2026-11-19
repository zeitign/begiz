<script setup lang="ts">
import { computed, ref } from 'vue'
import { linkMatches, pluralize, sideColumnWidth, type FolderNode } from '../lib/vaultTree'
import VaultFolderEditor from './VaultFolderEditor.vue'
import VaultFoldStrip from './VaultFoldStrip.vue'
import VaultIcon from './VaultIcon.vue'
import VaultPanelBar from './VaultPanelBar.vue'
import VaultLinkRow from './VaultLinkRow.vue'

const props = defineProps<{
  folder: FolderNode
  query: string
  /** While it slides and grows, only the name and icon are shown. */
  isMoving: boolean
  /** Folded into a strip while the category beside it is unfolded; the links stay. */
  isFolded: boolean
}>()
const emit = defineEmits<{ close: []; deleted: []; unfold: [] }>()

const isEditing = ref(false)
const draftIcon = ref(props.folder.icon)

function startEditing() {
  draftIcon.value = props.folder.icon
  isEditing.value = true
}

const shownIcon = computed(() => (isEditing.value ? draftIcon.value : props.folder.icon))
const shownLinks = computed(() =>
  props.query ? props.folder.links.filter((link) => linkMatches(link, props.query)) : props.folder.links,
)
const linkCountLabel = computed(() =>
  props.query
    ? `${shownLinks.value.length} of ${pluralize(props.folder.links.length, 'link')}`
    : pluralize(props.folder.links.length, 'link'),
)
const contentsLabel = computed(() => (props.folder.links.length ? pluralize(props.folder.links.length, 'link') : ''))
</script>

<template>
  <section
    class="vault-panel vault-folder-panel"
    :class="{ moving: isMoving, folded: isFolded }"
    :style="{ '--vault-side-width': `${sideColumnWidth(folder.name)}px` }"
    :aria-label="folder.name"
  >
    <div class="vault-panel-side">
      <Transition name="vault-fold">
        <VaultFoldStrip v-if="isFolded" :name="folder.name" :icon="folder.icon" @unfold="emit('unfold')" />
        <div v-else class="vault-side-content">
          <div class="vault-identity">
            <h3 class="vault-identity-name">{{ folder.name }}</h3>
            <span class="vault-identity-count">{{ linkCountLabel }}</span>
            <VaultIcon :name="shownIcon" />
          </div>
          <div class="vault-panel-actions">
            <VaultPanelBar
              kind="folder"
              :is-editing="isEditing"
              @edit="startEditing"
              back-label="Back to the folders"
              @close="emit('close')"
            />
            <div class="vault-panel-buttons">
              <RouterLink :to="{ name: 'vault-new', query: { folder: folder.id } }" class="vault-panel-button"
                >New link</RouterLink
              >
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <div class="vault-panel-main">
      <template v-if="isEditing">
        <span class="mono-label vault-panel-heading">Edit folder</span>
        <VaultFolderEditor
          v-model:icon="draftIcon"
          :folder="folder"
          :contents-label="contentsLabel"
          @done="isEditing = false"
          @deleted="emit('deleted')"
        />
      </template>
      <p v-else-if="!shownLinks.length" class="muted vault-panel-message">
        {{ query ? 'No links here match the search.' : 'No links in this folder yet.' }}
      </p>
      <ul v-else class="vault-links">
        <VaultLinkRow v-for="link in shownLinks" :key="link.id" :link="link" />
      </ul>
    </div>
  </section>
</template>
