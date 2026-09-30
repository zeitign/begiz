<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  web: { url: string; previewUrl: string | null; faviconUrl: string | null }
}>()

const hostname = computed(() => {
  try {
    return new URL(props.web.url).hostname.replace(/^www\./, '')
  } catch {
    return props.web.url
  }
})
const faviconFailed = ref(false)
</script>

<template>
  <img v-if="web.previewUrl" :src="web.previewUrl" alt="" class="thumb" loading="lazy" />
  <!-- Sin imagen: tarjeta generada con favicon y dominio. -->
  <div v-else class="thumb thumb-placeholder">
    <img
      v-if="web.faviconUrl && !faviconFailed"
      :src="web.faviconUrl"
      alt=""
      width="32"
      height="32"
      referrerpolicy="no-referrer"
      @error="faviconFailed = true"
    />
    <span>{{ hostname }}</span>
  </div>
</template>
