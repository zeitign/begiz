<script setup lang="ts">
import { ref } from 'vue'
import type { VaultLink } from '../lib/api'
import { displayUrl, useVaultLinkActions } from '../lib/useVaultLinkActions'

const props = defineProps<{ link: VaultLink }>()

const hasFaviconFailed = ref(false)
const { isEditing, isSaving, draftTitle, draftUrl, actionError, startEditing, saveLink, deleteLink } =
  useVaultLinkActions(() => props.link)
</script>

<template>
  <li class="vault-link">
    <img
      v-if="link.faviconUrl && !hasFaviconFailed"
      :src="link.faviconUrl"
      alt=""
      class="vault-favicon"
      width="32"
      height="32"
      referrerpolicy="no-referrer"
      @error="hasFaviconFailed = true"
    />
    <span v-else class="vault-favicon vault-favicon-initial" aria-hidden="true">
      {{ link.title.charAt(0).toUpperCase() }}
    </span>

    <form v-if="isEditing" class="vault-link-form" @submit.prevent="saveLink">
      <input v-model="draftTitle" required maxlength="200" aria-label="Title" />
      <input v-model="draftUrl" type="url" required aria-label="URL" />
      <button type="submit" class="vault-primary-button" :disabled="isSaving">{{ isSaving ? 'Saving…' : 'Save' }}</button>
      <button type="button" @click="isEditing = false">Cancel</button>
    </form>
    <template v-else>
      <span class="vault-link-text">
        <a :href="link.url" target="_blank" rel="noopener noreferrer" class="vault-link-title">{{ link.title }}</a>
        <span class="vault-link-url">{{ displayUrl(link.url) }}</span>
      </span>
      <span class="vault-link-actions">
        <button type="button" class="vault-link-action" title="Edit" :aria-label="`Edit ${link.title}`" @click="startEditing">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16z" />
            <path d="M13 7l4 4" />
          </svg>
        </button>
        <button type="button" class="vault-link-action" title="Delete" :aria-label="`Delete ${link.title}`" @click="deleteLink">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M4 7h16" />
            <path d="M9 7V4h6v3" />
            <path d="M6 7l1 13h10l1-13" />
          </svg>
        </button>
      </span>
    </template>
    <p v-if="actionError" class="error vault-link-error">{{ actionError }}</p>
  </li>
</template>
