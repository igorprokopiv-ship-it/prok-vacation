import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: 'Prok Vacation',
        short_name: 'Vacation',
        description:
          'Offline-first multi-trip companion — itinerary, tickets, maps, notes.',
        theme_color: '#1c2a3a',
        background_color: '#f7f1e8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Shell only — trip media uses hash blob Cache Storage (delta sync)
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/content/blobs/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'prok-vacation-blobs-v1',
              expiration: {
                maxEntries: 2000,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/images/') ||
              url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'prok-vacation-runtime',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 4177,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8083',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4177,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8083',
        changeOrigin: true,
      },
    },
  },
})
