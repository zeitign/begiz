<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import WebInfoWindow from './components/WebInfoWindow.vue'
import { closeAllInfoWindows, infoWindows } from './lib/infoWindows'
import { session, supabase } from './lib/supabase'

const router = useRouter()
const queryClient = useQueryClient()

async function signOut() {
  await supabase.auth.signOut()
  closeAllInfoWindows()
  queryClient.clear()
  await router.push({ name: 'login' })
}
</script>

<template>
  <header v-if="session" class="header">
    <strong>Begiz</strong>
    <nav>
      <RouterLink :to="{ name: 'home' }">Mosaic</RouterLink>
      <RouterLink :to="{ name: 'new' }">Save web</RouterLink>
      <RouterLink :to="{ name: 'collections' }">Collections</RouterLink>
    </nav>
    <span class="muted">{{ session.user.email }}</span>
    <button type="button" @click="signOut">Sign out</button>
  </header>
  <RouterView />
  <template v-if="session">
    <template v-for="infoWindow in infoWindows" :key="infoWindow.webId">
      <WebInfoWindow v-if="!infoWindow.isMinimized" :info-window="infoWindow" />
    </template>
  </template>
</template>
