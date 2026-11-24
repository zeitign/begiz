<script setup lang="ts">
import { ref } from 'vue'
import type { VaultLink } from '../lib/api'
import { displayUrl, useVaultLinkActions } from '../lib/useVaultLinkActions'

const props = defineProps<{
  link: VaultLink
  /** Where the link lives, shown when it comes from a search. */
  location?: string
}>()

const hasFaviconFailed = ref(false)
const { isEditing, isSaving, draftTitle, draftUrl, actionError, startEditing, saveLink, deleteLink } =
  useVaultLinkActions(() => props.link)
</script>

<template>
  <li class="vault-list-row vault-list-link">
    <form v-if="isEditing" class="vault-list-link-form" @submit.prevent="saveLink">
      <input v-model="draftTitle" required maxlength="200" aria-label="Title" />
      <input v-model="draftUrl" type="url" required aria-label="URL" />
      <button type="submit" class="vault-list-button" :disabled="isSaving">{{ isSaving ? 'Saving…' : 'Save' }}</button>
      <button type="button" class="vault-list-button" @click="isEditing = false">Cancel</button>
    </form>
    <template v-else>
      <span class="vault-list-main">
        <img
          v-if="link.faviconUrl && !hasFaviconFailed"
          :src="link.faviconUrl"
          alt=""
          class="vault-favicon vault-list-favicon"
          width="32"
          height="32"
          referrerpolicy="no-referrer"
          @error="hasFaviconFailed = true"
        />
        <span v-else class="vault-list-initial" aria-hidden="true">{{ link.title.charAt(0).toUpperCase() }}</span>
        <a :href="link.url" target="_blank" rel="noopener noreferrer" class="vault-list-link-title">{{ link.title }}</a>
        <span class="vault-list-url">{{ displayUrl(link.url) }}</span>
      </span>
      <span class="vault-list-meta">{{ location }}</span>
      <span class="vault-list-end vault-list-actions">
        <button type="button" class="vault-link-action" title="Edit" :aria-label="`Edit ${link.title}`" @click="startEditing">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16z" />
            <path d="M13 7l4 4" />
          </svg>
        </button>
        <button type="button" class="vault-link-action" title="Delete" :aria-label="`Delete ${link.title}`" @click="deleteLink">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path d="M4 7h16" />
            <path d="M9 7V4h6v3" />
            <path d="M6 7l1 13h10l1-13" />
          </svg>
        </button>
      </span>
    </template>
    <p v-if="actionError" class="error vault-list-error">{{ actionError }}</p>
  </li>
</template>
