<script setup lang="ts">
import { computed } from 'vue'
import type { AppErrorKind } from '../lib/appError'

const props = defineProps<{ kind: AppErrorKind }>()

const errorTexts: Record<
  AppErrorKind,
  { code: string; title: string; message: string; service: string; status: string; hint: string }
> = {
  'sign-in': {
    code: 'E01 · Sign-in',
    title: 'The mosaic could not load',
    message: 'The sign-in service did not answer, so Begiz cannot check who you are yet.',
    service: 'Sign-in (Supabase)',
    status: 'No answer',
    hint: 'If it keeps happening, the Supabase project may be paused.',
  },
  server: {
    code: 'E02 · Server',
    title: 'The mosaic could not load',
    message: 'The Begiz server did not answer, so your webs cannot be fetched right now.',
    service: 'Begiz API',
    status: 'Could not connect',
    hint: 'Check that the API is running.',
  },
  unexpected: {
    code: 'E03 · Unexpected',
    title: 'Something broke',
    message: 'Begiz ran into an error it did not expect while showing this page.',
    service: 'Begiz app',
    status: 'Unexpected error',
    hint: 'Reloading usually fixes it.',
  },
}

const errorText = computed(() => errorTexts[props.kind])
// Enough frames to fill a large screen; the ones that do not fit are clipped.
const backgroundFrameCount = 40

function reload() {
  window.location.reload()
}
</script>

<!-- The mosaic that never finished loading, with the error card on top. -->
<template>
  <div class="error-page">
    <div class="error-page-mosaic" aria-hidden="true">
      <span v-for="frame in backgroundFrameCount" :key="frame" class="error-page-frame">
        <span class="skeleton-image crossed"></span>
      </span>
    </div>
    <section class="error-card" role="alert">
      <div class="error-card-header">
        <span>Begiz</span>
        <span>{{ errorText.code }}</span>
      </div>
      <div class="error-card-body">
        <div class="error-card-heading">
          <span class="error-card-thumb crossed" aria-hidden="true"></span>
          <h1 class="error-card-title">{{ errorText.title }}</h1>
        </div>
        <p>{{ errorText.message }}</p>
        <dl class="error-card-details">
          <dt>Service</dt>
          <dd>{{ errorText.service }}</dd>
          <dt>Status</dt>
          <dd>{{ errorText.status }}</dd>
          <dt>Your webs</dt>
          <dd>Not affected</dd>
        </dl>
        <div class="error-card-actions">
          <button type="button" class="error-card-retry" @click="reload">↻ Try again</button>
          <span class="muted">{{ errorText.hint }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
