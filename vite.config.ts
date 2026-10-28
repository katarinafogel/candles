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
      includeAssets: ['icon.svg', 'icon-grimoire.svg', 'apple-touch-icon.png', 'apple-touch-icon-grimoire.png', '*.webmanifest'],
      // Two installable apps from one site: the workshop and the grimoire, each with its own manifest
      // in public/ (index.html picks one by the address), so the plugin writes none.
      manifest: false,
      includeManifestIcons: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // Static pages are served as is, not replaced by the app shell.
        navigateFallbackDenylist: [/privacy\.html$/],
      },
    }),
  ],
})
