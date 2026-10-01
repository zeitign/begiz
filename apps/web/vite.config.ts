import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  server: {
    // Listen on every interface: otherwise the Windows browser cannot reach Vite inside WSL.
    host: true,
    // Locally the proxy gives the front and the API the same origin: no CORS needed.
    proxy: {
      '/api': 'http://localhost:8787',
      '/files': 'http://localhost:8787',
    },
  },
})
