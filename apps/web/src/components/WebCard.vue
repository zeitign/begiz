<script setup lang="ts">
import type { WebCard } from '../lib/api'
import { openInfoWindow } from '../lib/infoWindows'
import WebThumb from './WebThumb.vue'

defineProps<{ web: WebCard }>()
</script>

<template>
  <article class="card" :data-web-id="web.id">
    <div class="card-media" @click="openInfoWindow(web.id)">
      <WebThumb :web="web" />
    </div>
    <div class="card-body">
      <button
        type="button"
        class="card-open"
        :aria-label="`View ${web.title}`"
        @click="openInfoWindow(web.id)"
      >
        <strong class="card-title"><span class="card-title-text">{{ web.title }}</span></strong>
      </button>
      <div class="card-actions">
        <RouterLink
          :to="{ name: 'web', params: { id: web.id } }"
          class="card-action"
          title="Edit"
          :aria-label="`Edit ${web.title}`"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M16.5 3.5l4 4L8 20H4v-4L16.5 3.5z" />
            <path d="M14 6l4 4" />
          </svg>
        </RouterLink>
        <a
          :href="web.url"
          target="_blank"
          rel="noopener noreferrer"
          class="card-action"
          title="Open in a new tab"
          :aria-label="`Open ${web.title} in a new tab`"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M14 4h6v6" />
            <path d="M20 4L10 14" />
            <path d="M18 14v6H4V6h6" />
          </svg>
        </a>
      </div>
    </div>
  </article>
</template>
