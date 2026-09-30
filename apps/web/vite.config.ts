import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  server: {
    // Escuchar en todas las interfaces: si no, el navegador de Windows no llega a Vite dentro de WSL.
    host: true,
    // En local, el front y la API comparten origen gracias al proxy: sin CORS.
    proxy: {
      '/api': 'http://localhost:8787',
      '/files': 'http://localhost:8787',
    },
  },
})
