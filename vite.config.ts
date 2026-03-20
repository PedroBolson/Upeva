import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('firebase')) {
            return 'firebase'
          }

          if (id.includes('react-router') || id.includes('@remix-run')) {
            return 'router'
          }

          if (id.includes('@tanstack/react-query')) {
            return 'query'
          }

          if (
            id.includes('react-hook-form') ||
            id.includes('@hookform/resolvers') ||
            id.includes('zod')
          ) {
            return 'forms'
          }

          if (id.includes('framer-motion')) {
            return 'motion'
          }

          if (id.includes('react') || id.includes('scheduler')) {
            return 'react-vendor'
          }

          return 'vendor'
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
