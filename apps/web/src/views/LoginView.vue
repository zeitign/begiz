<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'

const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const signingIn = ref(false)
const signInError = ref('')

async function signIn() {
  signingIn.value = true
  signInError.value = ''
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  signingIn.value = false
  if (authError) {
    signInError.value = 'Wrong email or password'
    return
  }
  const redirectPath = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  await router.replace(redirectPath.startsWith('/') ? redirectPath : '/')
}
</script>

<template>
  <main class="page narrow">
    <form class="stack" @submit.prevent="signIn">
      <h1>Begiz</h1>
      <label>
        Email
        <input v-model="email" type="email" autocomplete="email" required />
      </label>
      <label>
        Password
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <button type="submit" :disabled="signingIn">{{ signingIn ? 'Signing in…' : 'Sign in' }}</button>
      <p v-if="signInError" class="error">{{ signInError }}</p>
    </form>
  </main>
</template>
