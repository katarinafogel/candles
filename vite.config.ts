import { defineConfig, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA, type ManifestOptions } from 'vite-plugin-pwa'

// Three apps, three builds into one site (npm run build runs them one after another):
//   vite build --mode showcase  → dist/            the root: «Другие проекты», candle reviews
//   vite build --mode workshop  → dist/workshop/   the workshop, its own manifest and service worker
//   vite build --mode grimoire  → dist/grimoire/   the grimoire, its own manifest and service worker (push)
// Each app lives in apps/<name>/ (index.html, main.tsx, public/); the code is shared from src/ and packages/.
// Plain `vite` runs the workshop; tests (mode 'test') run from the repository's root.

const here = (p: string) => decodeURIComponent(new URL(p, import.meta.url).pathname)
const pkg = (name: string) => here(`./packages/${name}/src`)

type App = 'showcase' | 'workshop' | 'grimoire'
const apps: Record<App, { base: string; out: string; manifest?: Partial<ManifestOptions> }> = {
  showcase: { base: '/', out: 'dist' },
  workshop: {
    base: '/workshop/',
    out: 'dist/workshop',
    manifest: { name: 'Мастерская свечей', short_name: 'Мастерская', description: 'Производственный журнал мастерской свечей' },
  },
  grimoire: {
    base: '/grimoire/',
    out: 'dist/grimoire',
    manifest: { name: 'Гримуар дел', short_name: 'Гримуар', description: 'Дела, ритуалы и колесо года' },
  },
}

export default defineConfig(({ mode }) => {
  const app: App = mode in apps ? (mode as App) : 'workshop'
  const a = apps[app]
  const test = mode === 'test'
  const config: UserConfig = {
    ...(test ? {} : { root: here(`./apps/${app}`) }),
    base: a.base,
    envDir: here('.'),
    define: { 'import.meta.env.VITE_APP': JSON.stringify(app) },
    build: {
      outDir: here(`./${a.out}`),
      // The showcase builds first into dist/; the apps then fill their own folders.
      emptyOutDir: true,
      chunkSizeWarningLimit: 1200,
    },
    server: { fs: { allow: [here('.')] } },
    resolve: {
      alias: {
        '@shared': pkg('shared'),
        '@grimoire-core': pkg('grimoire-core'),
        '@workshop-core': pkg('workshop-core'),
      },
    },
    plugins: [react()],
  }
  if (a.manifest && !test) {
    config.plugins!.push(
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          ...a.manifest,
          // Its own id, start and scope: the phone installs each app as a separate one.
          id: a.base,
          start_url: a.base,
          scope: a.base,
          lang: 'ru',
          display: 'standalone',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
          navigateFallback: 'index.html',
          ...(app === 'grimoire' ? { importScripts: ['push-sw.js'] } : {}),
        },
      }),
    )
  }
  return config
})
