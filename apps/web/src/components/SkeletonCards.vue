<script setup lang="ts">
// Varied widths so the placeholder reads like a real mosaic rather than one card repeated.
const placeholderTitleWidths = ['72%', '54%', '86%', '63%', '48%', '78%', '58%', '90%', '66%', '52%']
</script>

<template>
  <div class="grid skeleton" role="status" aria-label="Loading webs">
    <article
      v-for="(titleWidth, cardIndex) in placeholderTitleWidths"
      :key="cardIndex"
      class="card"
      aria-hidden="true"
    >
      <span class="skeleton-image crossed"></span>
      <div class="card-body">
        <span class="card-open">
          <span class="skeleton-box skeleton-text" :style="{ width: titleWidth }"></span>
        </span>
        <div class="card-actions">
          <span class="card-action"></span>
          <span class="card-action"></span>
        </div>
      </div>
    </article>
  </div>
</template>
