import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 2499,
    host: process.env.VIDARCH_DEV_HOST || '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://localhost:2498',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://localhost:2498',
        changeOrigin: true,
      },
    },
  },
})
