import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

const gitHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
})()

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'KIROKU 記録',
        short_name: 'KIROKU',
        lang: 'ja',
        display: 'standalone',
        background_color: '#f1f2f6',
        theme_color: '#f1f2f6',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Photos never change once uploaded (each has its own uuid path), so keep them
            // on the device. The signed-URL token is ignored so a re-signed URL still hits.
            urlPattern: /\/storage\/v1\/object\/sign\/kiroku-photos\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'kiroku-photos',
              matchOptions: { ignoreSearch: true },
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Google Fonts (CSS + font files) — keep them for offline use
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  base: '/kiroku-app/',
  define: {
    __APP_VERSION__: JSON.stringify(gitHash),
  },
})
