import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

type WorkboxRouteMatch = {
  request: {
    destination?: string
    mode?: string
  }
  url: URL
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Upeva - Adoção de Animais',
        short_name: 'Upeva',
        description: 'Adote um amigo pela Upeva',
        theme_color: '#f3eadc',
        background_color: '#f3eadc',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'pt-BR',
        icons: [
          { src: 'pwa-64x64.png',            sizes: '64x64',   type: 'image/png' },
          { src: 'pwa-192x192.png',           sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png',           sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }: WorkboxRouteMatch) => (
              url.origin === 'https://firebasestorage.googleapis.com' &&
              request.destination === 'image' &&
              request.mode === 'cors'
            ),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ request, url }: WorkboxRouteMatch) => {
              if (
                url.origin !== 'https://firebasestorage.googleapis.com' ||
                request.destination !== 'image' ||
                request.mode !== 'no-cors'
              ) {
                return false
              }

              // Only regular <img> loads are cached here. Canvas loads use
              // crossOrigin="anonymous", arrive as CORS requests, and must never
              // be answered with an opaque response from this runtime cache.
              const signedStorageParams = new Set([
                'expires',
                'googleaccessid',
                'signature',
                'x-goog-algorithm',
                'x-goog-credential',
                'x-goog-date',
                'x-goog-expires',
                'x-goog-signature',
                'x-goog-signedheaders',
              ])

              for (const key of url.searchParams.keys()) {
                if (signedStorageParams.has(key.toLowerCase())) {
                  return false
                }
              }

              const encodedObjectPath = url.pathname.split('/o/')[1]

              if (!encodedObjectPath) {
                return false
              }

              let objectPath: string
              try {
                objectPath = decodeURIComponent(encodedObjectPath)
              } catch {
                return false
              }

              return (
                objectPath.startsWith('animals/') &&
                /\.(jpe?g|png|webp)$/i.test(objectPath)
              )
            },
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-storage-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/admin\/login/, /^\/admin\/reset-password/],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('firebase')) {
            return 'firebase'
          }

          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/') ||
            id.includes('/node_modules/react-is/')
          ) {
            return 'react-vendor'
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
