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
      <div class="card-title-row">
        <strong class="grow">{{ web.title }}</strong>
        <button
          type="button"
          class="icon-button"
          title="View"
          aria-label="View"
          @click="openInfoWindow(web.id)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <RouterLink
          :to="{ name: 'web', params: { id: web.id } }"
          class="icon-button"
          title="Edit"
          aria-label="Edit"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M16.5 3.5l4 4L8 20H4v-4L16.5 3.5z" />
            <path d="M14 6l4 4" />
          </svg>
        </RouterLink>
      </div>
      <div v-if="web.tags.length" class="row">
        <span v-for="tag in web.tags" :key="tag" class="chip">{{ tag }}</span>
      </div>
    </div>
  </article>
</template>
