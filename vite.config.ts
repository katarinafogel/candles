import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Relative base works on GitHub Pages under /<repo>/ together with HashRouter.
  base: './',
  build: { chunkSizeWarningLimit: 1200 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Мастерская свечей',
        short_name: 'Свечи',
        description: 'Производственный журнал мастерской свечей',
        lang: 'ru',
        theme_color: '#13110f',
        background_color: '#13110f',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Static pages are served as is, not replaced by the app shell.
        navigateFallbackDenylist: [/privacy\.html$/],
      },
    }),
  ],
})
