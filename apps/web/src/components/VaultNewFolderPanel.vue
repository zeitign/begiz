<script setup lang="ts">
import { ref } from 'vue'
import { DEFAULT_FOLDER_ICON, sideColumnWidth } from '../lib/vaultTree'
import VaultFolderEditor from './VaultFolderEditor.vue'
import VaultIcon from './VaultIcon.vue'

// A folder that does not exist yet, opened like one that does: its card on the left, and beside it
// the editor where it gets its name and icon.
defineProps<{ categoryId: string }>()
const emit = defineEmits<{ cancel: []; created: [folderId: string] }>()

const NEW_FOLDER = { id: null, name: '', icon: DEFAULT_FOLDER_ICON }
const draftIcon = ref(NEW_FOLDER.icon)
</script>

<template>
  <section
    class="vault-panel vault-folder-panel grown"
    :style="{ '--vault-side-width': `${sideColumnWidth('New folder')}px` }"
    aria-label="New folder"
  >
    <div class="vault-panel-side">
      <div class="vault-side-content">
        <div class="vault-identity">
          <h3 class="vault-identity-name">New folder</h3>
          <span class="vault-identity-count">0 links</span>
          <VaultIcon :name="draftIcon" />
        </div>
      </div>
    </div>
    <div class="vault-panel-main">
      <span class="mono-label vault-panel-heading">New folder</span>
      <VaultFolderEditor
        v-model:icon="draftIcon"
        :folder="NEW_FOLDER"
        contents-label=""
        :parent-id="categoryId"
        @done="emit('cancel')"
        @created="emit('created', $event)"
      />
    </div>
  </section>
</template>
