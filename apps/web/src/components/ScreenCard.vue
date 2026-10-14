<script setup lang="ts">
defineOptions({ inheritAttrs: false })

defineProps<{
  /** Right side of the card's header strip, e.g. an error code. */
  label: string
  title: string
  narrow?: boolean
}>()

// Enough frames to fill a large screen; the ones that do not fit are clipped.
const backgroundFrameCount = 40
</script>

<!-- A full-screen card over the mosaic that is not shown yet. Attributes go to the card itself. -->
<template>
  <div class="screen">
    <div class="screen-mosaic" aria-hidden="true">
      <span v-for="frame in backgroundFrameCount" :key="frame" class="screen-mosaic-frame">
        <span class="skeleton-image crossed"></span>
      </span>
    </div>
    <section class="screen-card" :class="{ narrow }" v-bind="$attrs">
      <div class="screen-card-header mono-label">
        <span>Begiz</span>
        <span>{{ label }}</span>
      </div>
      <div class="screen-card-body">
        <div class="screen-card-heading">
          <span class="screen-card-thumb crossed" aria-hidden="true"></span>
          <h1 class="screen-card-title">{{ title }}</h1>
        </div>
        <slot />
      </div>
      <div v-if="$slots.footer" class="screen-card-footer">
        <slot name="footer" />
      </div>
    </section>
  </div>
</template>
