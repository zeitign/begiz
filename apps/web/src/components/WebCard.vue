<script setup lang="ts">
import type { WebCard } from '../lib/api'
import WebThumb from './WebThumb.vue'

defineProps<{ web: WebCard }>()
</script>

<template>
  <RouterLink :to="{ name: 'web', params: { id: web.id } }" class="card">
    <WebThumb :web="web" />
    <div class="card-body">
      <strong>{{ web.title }}</strong>
      <div v-if="web.tags.length" class="row">
        <span v-for="tag in web.tags" :key="tag" class="chip">{{ tag }}</span>
      </div>
    </div>
  </RouterLink>
</template>
