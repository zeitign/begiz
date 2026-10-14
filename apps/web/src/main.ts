import { VueQueryPlugin } from '@tanstack/vue-query'
import { createApp } from 'vue'
import App from './App.vue'
import { showAppError } from './lib/appError'
import { router } from './router'
import './style.css'

const app = createApp(App)

// A bug in any component replaces the app with the error page instead of leaving it half drawn.
app.config.errorHandler = (error) => {
  console.error(error)
  showAppError('unexpected')
}

app.use(router).use(VueQueryPlugin).mount('#app')
