<script setup lang="ts">
// Varied widths so the placeholder reads like a real mosaic rather than one card repeated.
const placeholderCards = [
  { titleWidth: '72%', tagWidths: [56, 72] },
  { titleWidth: '54%', tagWidths: [64] },
  { titleWidth: '86%', tagWidths: [48, 80, 56] },
  { titleWidth: '63%', tagWidths: [72, 48] },
  { titleWidth: '48%', tagWidths: [60] },
  { titleWidth: '78%', tagWidths: [52, 68] },
  { titleWidth: '58%', tagWidths: [80, 56, 44] },
  { titleWidth: '90%', tagWidths: [64] },
  { titleWidth: '66%', tagWidths: [48, 72] },
  { titleWidth: '52%', tagWidths: [70, 52] },
]
</script>

<template>
  <div class="grid skeleton" role="status" aria-label="Loading webs">
    <article v-for="(card, cardIndex) in placeholderCards" :key="cardIndex" class="card" aria-hidden="true">
      <span class="skeleton-image"></span>
      <div class="card-body">
        <div class="card-title-row">
          <span class="grow">
            <span class="skeleton-box skeleton-text" :style="{ width: card.titleWidth }"></span>
          </span>
          <span class="skeleton-box skeleton-icon"></span>
          <span class="skeleton-box skeleton-icon"></span>
        </div>
        <div class="row">
          <span
            v-for="(tagWidth, tagIndex) in card.tagWidths"
            :key="tagIndex"
            class="skeleton-box skeleton-chip"
            :style="{ width: `${tagWidth}px` }"
          ></span>
        </div>
      </div>
    </article>
  </div>
</template>
