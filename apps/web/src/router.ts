import { createRouter, createWebHistory } from 'vue-router'
import { session } from './lib/supabase'
import CollectionsView from './views/CollectionsView.vue'
import HomeView from './views/HomeView.vue'
import LoginView from './views/LoginView.vue'
import NewWebView from './views/NewWebView.vue'
import WebDetailView from './views/WebDetailView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/nueva', name: 'new', component: NewWebView },
    { path: '/webs/:id', name: 'web', component: WebDetailView, props: true },
    { path: '/colecciones', name: 'collections', component: CollectionsView },
  ],
})

router.beforeEach((to) => {
  if (!to.meta.public && !session.value) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && session.value) return { name: 'home' }
})
