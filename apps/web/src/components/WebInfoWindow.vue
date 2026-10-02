<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { api, responseBody } from '../lib/api'
import {
  bringInfoWindowToFront,
  closeInfoWindow,
  minimizeInfoWindow,
  moveInfoWindow,
  resizeInfoWindow,
  toggleMaximizeInfoWindow,
  type InfoWindow,
} from '../lib/infoWindows'
import FloatingWindow from './FloatingWindow.vue'
import WebThumb from './WebThumb.vue'

const props = defineProps<{ infoWindow: InfoWindow }>()

const webId = computed(() => props.infoWindow.webId)
const { data: web, error: loadError } = useQuery({
  queryKey: computed(() => ['web', webId.value]),
  queryFn: () => responseBody(api.webs[':id'].$get({ param: { id: webId.value } })),
})

const getCardRect = () =>
  document.querySelector(`[data-web-id="${webId.value}"]`)?.getBoundingClientRect()

const fullImageUrl = computed(() => web.value?.fullUrl ?? web.value?.previewUrl ?? null)
</script>

<template>
  <FloatingWindow
    :title="web?.title ?? 'Loading…'"
    :x="infoWindow.x"
    :y="infoWindow.y"
    :width="infoWindow.width"
    :is-maximized="infoWindow.isMaximized"
    :stack-order="infoWindow.stackOrder"
    :get-minimize-target-rect="getCardRect"
    @move="(x, y) => moveInfoWindow(webId, x, y)"
    @resize="(x, width) => resizeInfoWindow(webId, x, width)"
    @focus="bringInfoWindowToFront(webId)"
    @minimize="minimizeInfoWindow(webId)"
    @toggle-maximize="toggleMaximizeInfoWindow(webId)"
    @close="closeInfoWindow(webId)"
  >
    <p v-if="loadError" class="error">{{ loadError.message }}</p>
    <p v-else-if="!web">Loading…</p>

    <article v-else class="stack">
      <img v-if="fullImageUrl" :src="fullImageUrl" alt="" class="window-image" />
      <div v-else class="window-image"><WebThumb :web="web" /></div>

      <h2>{{ web.title }}</h2>
      <div class="row window-url-row">
        <span class="muted grow url-text">{{ web.url }}</span>
        <a :href="web.url" target="_blank" rel="noopener noreferrer">Open web ↗</a>
      </div>

      <p v-if="web.notes" class="reading-text">{{ web.notes }}</p>

      <div v-if="web.tags.length" class="row window-tags">
        <span v-for="tag in web.tags" :key="tag" class="chip">{{ tag }}</span>
      </div>
    </article>
  </FloatingWindow>
</template>
