<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

defineProps<{ to: RouteLocationRaw; label: string }>()
</script>

<!-- RouterLink marks the current page with aria-current, which turns the tab into the hanging label. -->
<template>
  <RouterLink :to="to" class="header-cell header-tab">
    {{ label }}
    <span class="header-tab-label" aria-hidden="true">
      <span class="header-tab-label-text">{{ label }}</span>
    </span>
  </RouterLink>
</template>
