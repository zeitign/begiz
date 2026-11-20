<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppSkeleton from './components/AppSkeleton.vue'
import ErrorPage from './components/ErrorPage.vue'
import SpaceNav from './components/SpaceNav.vue'
import WebInfoWindow from './components/WebInfoWindow.vue'
import { appError } from './lib/appError'
import { closeAllInfoWindows, infoWindows } from './lib/infoWindows'
import { isAuthReady, session, supabase } from './lib/supabase'
import { nextTheme, theme, toggleTheme } from './lib/theme'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()

const currentSpace = computed(() => route.meta.space ?? 'mosaic')

// The button shows the theme in use; its label says which one a click brings.
const themeToggleLabel = computed(() => `Theme: ${theme.value} · click for ${nextTheme.value}`)

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
    <div class="app-layout">
      <header v-if="session" class="header">
        <strong class="header-cell header-brand">
          <span class="header-logo crossed" aria-hidden="true"></span>
          Begiz
        </strong>
        <nav class="header-tabs">
          <RouterLink
            :to="{ name: 'home' }"
            class="header-cell header-tab header-tab-mosaic"
            :aria-current="currentSpace === 'mosaic' ? 'page' : undefined"
          >
            Mosaic
          </RouterLink>
          <RouterLink
            :to="{ name: 'vault' }"
            class="header-cell header-tab"
            :aria-current="currentSpace === 'vault' ? 'page' : undefined"
          >
            Vault
          </RouterLink>
        </nav>
        <span class="header-spacer"></span>
        <span class="header-cell header-email">{{ session.user.email }}</span>
        <button
          type="button"
          class="header-cell header-theme"
          :title="themeToggleLabel"
          :aria-label="themeToggleLabel"
          @click="toggleTheme"
        >
          <svg v-if="theme === 'light'" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <circle cx="12" cy="12" r="5" />
            <path
              d="M12 1v2.5M12 20.5V23M1 12h2.5M20.5 12H23M4.2 4.2l1.8 1.8M18 18l1.8 1.8M4.2 19.8 6 18M18 6l1.8-1.8"
            />
          </svg>
          <svg v-else-if="theme === 'dark'" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <!-- Scaled up to match the sun and the smiley, keeping the same line width. -->
            <path
              d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"
              transform="translate(12 12) scale(1.45) translate(-12.6 -11.4)"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <circle cx="12" cy="12" r="11" />
            <path d="M7.5 14.5a5.5 5.5 0 0 0 9 0" />
            <path d="M8.5 8.75v1.5M15.5 8.75v1.5" />
          </svg>
        </button>
        <button type="button" class="header-cell header-action" @click="signOut">Sign out</button>
      </header>
      <SpaceNav v-if="session" :space="currentSpace" />
      <RouterView />
    </div>
    <template v-if="session">
      <template v-for="infoWindow in infoWindows" :key="infoWindow.webId">
        <WebInfoWindow v-if="!infoWindow.isMinimized" :info-window="infoWindow" />
      </template>
    </template>
  </template>
</template>
