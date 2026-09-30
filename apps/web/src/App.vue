<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { session, supabase } from './lib/supabase'

const router = useRouter()
const queryClient = useQueryClient()

async function logout() {
  await supabase.auth.signOut()
  queryClient.clear()
  await router.push({ name: 'login' })
}
</script>

<template>
  <header v-if="session" class="header">
    <strong>Begiz</strong>
    <nav>
      <RouterLink :to="{ name: 'home' }">Mosaico</RouterLink>
      <RouterLink :to="{ name: 'new' }">Guardar web</RouterLink>
      <RouterLink :to="{ name: 'collections' }">Colecciones</RouterLink>
    </nav>
    <button type="button" @click="logout">Salir</button>
  </header>
  <RouterView />
</template>
