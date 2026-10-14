<script setup lang="ts">
import SkeletonCards from './SkeletonCards.vue'

const placeholderTagWidths = [64, 88, 56, 104, 72, 60, 92]
</script>

<!-- Shown while the session is checked: the mosaic as it will look, with what is already known as text. -->
<template>
  <div role="status" aria-label="Loading">
    <header class="header skeleton" aria-hidden="true">
      <strong>Begiz</strong>
      <nav>
        <span>Mosaic</span>
        <span>Save web</span>
        <span>Collections</span>
      </nav>
      <span class="skeleton-box skeleton-email"></span>
      <span class="skeleton-box skeleton-round"></span>
      <span class="skeleton-field">Sign out</span>
    </header>
    <main class="page stack">
      <div class="row skeleton" aria-hidden="true">
        <span class="skeleton-field grow">Search by title</span>
        <span class="skeleton-field">All collections</span>
        <span class="skeleton-field">Custom order</span>
      </div>
      <div class="row skeleton" aria-hidden="true">
        <span
          v-for="(tagWidth, tagIndex) in placeholderTagWidths"
          :key="tagIndex"
          class="skeleton-box skeleton-chip"
          :style="{ width: `${tagWidth}px` }"
        ></span>
      </div>
      <SkeletonCards />
    </main>
  </div>
</template>
