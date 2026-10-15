<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppSkeleton from './components/AppSkeleton.vue'
import ErrorPage from './components/ErrorPage.vue'
import WebInfoWindow from './components/WebInfoWindow.vue'
import { appError } from './lib/appError'
import { closeAllInfoWindows, infoWindows } from './lib/infoWindows'
import { isAuthReady, session, supabase } from './lib/supabase'
import { theme, toggleTheme } from './lib/theme'

const router = useRouter()
const queryClient = useQueryClient()

const themeToggleLabel = computed(() =>
  theme.value === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
)

// Signing out here, in another tab, or the API rejecting the session all end the same way.
watch(session, (newSession, oldSession) => {
  if (!oldSession || newSession) return
  closeAllInfoWindows()
  queryClient.clear()
  router.replace({ name: 'login' })
})

function signOut() {
  return supabase.auth.signOut()
}
</script>

<template>
  <ErrorPage v-if="appError" :kind="appError" />
  <AppSkeleton v-else-if="!isAuthReady" />
  <template v-else>
    <header v-if="session" class="header">
      <strong>Begiz</strong>
      <nav>
        <RouterLink :to="{ name: 'home' }">Mosaic</RouterLink>
        <RouterLink :to="{ name: 'new' }">Save web</RouterLink>
        <RouterLink :to="{ name: 'collections' }">Collections</RouterLink>
      </nav>
      <span class="muted">{{ session.user.email }}</span>
      <button
        type="button"
        class="icon-button round"
        :title="themeToggleLabel"
        :aria-label="themeToggleLabel"
        @click="toggleTheme"
      >
        <svg v-if="theme === 'dark'" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        </svg>
      </button>
      <button type="button" @click="signOut">Sign out</button>
    </header>
    <RouterView />
    <template v-if="session">
      <template v-for="infoWindow in infoWindows" :key="infoWindow.webId">
        <WebInfoWindow v-if="!infoWindow.isMinimized" :info-window="infoWindow" />
      </template>
    </template>
  </template>
</template>
