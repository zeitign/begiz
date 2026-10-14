<script setup lang="ts">
import { computed } from 'vue'
import type { AppErrorKind } from '../lib/appError'
import ScreenCard from './ScreenCard.vue'

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

function reload() {
  window.location.reload()
}
</script>

<template>
  <ScreenCard :label="errorText.code" :title="errorText.title" role="alert">
    <p>{{ errorText.message }}</p>
    <dl class="error-details">
      <dt>Service</dt>
      <dd>{{ errorText.service }}</dd>
      <dt>Status</dt>
      <dd>{{ errorText.status }}</dd>
      <dt>Your webs</dt>
      <dd>Not affected</dd>
    </dl>
    <div class="error-actions">
      <button type="button" class="screen-button" @click="reload">↻ Try again</button>
      <span class="muted">{{ errorText.hint }}</span>
    </div>
  </ScreenCard>
</template>
