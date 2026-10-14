<script setup lang="ts">
import { isAuthRetryableFetchError, type AuthError } from '@supabase/supabase-js'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ScreenCard from '../components/ScreenCard.vue'
import { supabase } from '../lib/supabase'

const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const signingIn = ref(false)
const signInError = ref<{ code: string; message: string } | null>(null)

function describeSignInError(authError: AuthError) {
  if (isAuthRetryableFetchError(authError)) {
    return { code: 'E01', message: 'Could not reach the sign-in service. Try again in a moment.' }
  }
  if (authError.code === 'invalid_credentials') {
    return { code: 'Denied', message: 'Wrong email or password.' }
  }
  return { code: 'Error', message: authError.message }
}

async function signIn() {
  signingIn.value = true
  signInError.value = null
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  signingIn.value = false
  if (authError) {
    signInError.value = describeSignInError(authError)
    return
  }
  const redirectPath = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  await router.replace(redirectPath.startsWith('/') ? redirectPath : '/')
}
</script>

<template>
  <ScreenCard label="Private archive" title="Sign in" narrow>
    <form class="stack" @submit.prevent="signIn">
      <label>
        <span class="mono-label">Email</span>
        <input v-model="email" type="email" autocomplete="email" required />
      </label>
      <label>
        <span class="mono-label">Password</span>
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <p v-if="signInError" class="form-error" role="alert">
        <span class="mono-label">{{ signInError.code }}</span>
        <span>{{ signInError.message }}</span>
      </p>
      <button type="submit" class="screen-button" :disabled="signingIn">
        {{ signingIn ? 'Signing in…' : '→ Sign in' }}
      </button>
    </form>
    <template #footer>No public sign-up · accounts are created in Supabase</template>
  </ScreenCard>
</template>
