<script setup lang="ts">
import SkeletonCards from './SkeletonCards.vue'

const placeholderTagWidths = [64, 88, 56, 104, 72, 60, 92]
</script>

<!-- Shown while the session is checked: the mosaic as it will look, with what is already known as text. -->
<template>
  <div role="status" aria-label="Loading">
    <header class="header skeleton" aria-hidden="true">
      <strong class="header-cell header-brand">
        <span class="header-logo crossed"></span>
        Begiz
      </strong>
      <span class="header-tabs">
        <span class="header-cell header-tab">Save web</span>
        <span class="header-cell header-tab" aria-current="page">Mosaic</span>
        <span class="header-cell header-tab">Collections</span>
      </span>
      <span class="header-spacer"></span>
      <span class="header-cell header-email"><span class="skeleton-box skeleton-email"></span></span>
      <span class="header-cell header-theme"><span class="skeleton-box skeleton-round"></span></span>
      <span class="header-cell header-action">Sign out</span>
    </header>
    <main class="page wide stack">
      <div class="filter-bar skeleton" aria-hidden="true">
        <span class="filter-field">
          <span class="field-label">Search</span>
          <span class="skeleton-field-text">Title contains…</span>
        </span>
        <span class="filter-field">
          <span class="field-label">Collection</span>
          <span class="skeleton-field-text">All collections</span>
        </span>
        <span class="filter-field">
          <span class="field-label">Sort</span>
          <span class="skeleton-field-text">Custom order</span>
        </span>
      </div>
      <div class="tag-filters skeleton" aria-hidden="true">
        <span class="field-label">Tags</span>
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
