import { VueQueryPlugin } from '@tanstack/vue-query'
import { createApp } from 'vue'
import App from './App.vue'
import { initAuth } from './lib/supabase'
import { router } from './router'
import './style.css'

await initAuth()

createApp(App).use(router).use(VueQueryPlugin).mount('#app')
