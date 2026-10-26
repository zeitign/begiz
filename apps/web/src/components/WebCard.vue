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
      <strong class="card-title">{{ web.title }}</strong>
    </div>
    <div class="card-actions">
      <button type="button" class="card-action" @click="openInfoWindow(web.id)">
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        View
      </button>
      <RouterLink :to="{ name: 'web', params: { id: web.id } }" class="card-action">
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <path d="M16.5 3.5l4 4L8 20H4v-4L16.5 3.5z" />
          <path d="M14 6l4 4" />
        </svg>
        Edit
      </RouterLink>
      <a
        :href="web.url"
        target="_blank"
        rel="noopener noreferrer"
        class="card-action"
        :aria-label="`Open ${web.title} in a new tab`"
      >
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <path d="M14 4h6v6" />
          <path d="M20 4L10 14" />
          <path d="M18 14v6H4V6h6" />
        </svg>
        Open
      </a>
    </div>
  </article>
</template>
