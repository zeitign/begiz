<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'

const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function login() {
  loading.value = true
  error.value = ''
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  loading.value = false
  if (authError) {
    error.value = 'Email o contraseña incorrectos'
    return
  }
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  await router.replace(redirect.startsWith('/') ? redirect : '/')
}
</script>

<template>
  <main class="page narrow">
    <form class="stack" @submit.prevent="login">
      <h1>Begiz</h1>
      <label>
        Email
        <input v-model="email" type="email" autocomplete="email" required />
      </label>
      <label>
        Contraseña
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <button type="submit" :disabled="loading">{{ loading ? 'Entrando…' : 'Entrar' }}</button>
      <p v-if="error" class="error">{{ error }}</p>
    </form>
  </main>
</template>
