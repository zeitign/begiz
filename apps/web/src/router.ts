import { createRouter, createWebHistory } from 'vue-router'
import { authReady, session } from './lib/supabase'
import CollectionsView from './views/CollectionsView.vue'
import CollectionView from './views/CollectionView.vue'
import HomeView from './views/HomeView.vue'
import LoginView from './views/LoginView.vue'
import NewWebView from './views/NewWebView.vue'
import VaultNewLinkView from './views/VaultNewLinkView.vue'
import WebDetailView from './views/WebDetailView.vue'

export type Space = 'mosaic' | 'vault'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    space?: Space
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/new', name: 'new', component: NewWebView },
    { path: '/webs/:id', name: 'web', component: WebDetailView, props: true },
    // Nested, so the Collections tab stays active on the page of each collection.
    {
      path: '/collections',
      children: [
        { path: '', name: 'collections', component: CollectionsView },
        { path: ':id', name: 'collection', component: CollectionView, props: true },
      ],
    },
    // Loaded apart, so the mosaic never downloads the Vault and its icon font.
    { path: '/vault', name: 'vault', component: () => import('./views/VaultView.vue'), meta: { space: 'vault' } },
    { path: '/vault/new', name: 'vault-new', component: VaultNewLinkView, meta: { space: 'vault' } },
  ],
})

router.beforeEach(async (to) => {
  await authReady
  if (!to.meta.public && !session.value) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && session.value) return { name: 'home' }
})
