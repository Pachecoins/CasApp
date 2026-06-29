import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png', 'badge-72.png'],
      manifest: {
        name: 'Tuki — Servicios del Hogar',
        short_name: 'Tuki',
        description: 'Servicios del hogar on-demand: jardinería, piletas, limpieza, plomería y más',
        theme_color: '#2D6A4F',
        background_color: '#FAFAF8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/home',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        categories: ['utilities', 'lifestyle'],
        lang: 'es-AR',
        shortcuts: [
          { name: 'Contratar servicio', url: '/home', icons: [{ src: '/icon-192.png', sizes: '96x96' }] },
          { name: 'Mis suscripciones', url: '/subscriptions', icons: [{ src: '/icon-192.png', sizes: '96x96' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.casapp\.com\.ar\/api\/(categories|workers\/nearby)/,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', networkTimeoutSeconds: 5 },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tuki/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
