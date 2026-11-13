// After the three builds: the site-wide files for Cloudflare Pages in dist/.
//   _redirects — /dev/components lives in the workshop.
//   404.html, _routes.json — for functions/_middleware.js, which gives each app's pages its index.html.
//   _headers   — service workers and manifests are never cached, so updates arrive at once.
import { writeFileSync } from 'node:fs'

writeFileSync('dist/_redirects', '/dev/components /workshop/dev/components 302\n')

// A page that is not a file gets its app's index.html from functions/_middleware.js. For that Pages
// must answer 404 to unknown addresses (with this page), not the root index.html of its SPA mode.
writeFileSync(
  'dist/404.html',
  '<!doctype html><html lang="ru"><meta charset="utf-8"><title>Нет такой страницы</title><p>Такой страницы нет. <a href="/projects">К проектам</a></p></html>\n',
)

// The function runs only for pages: assets go straight from the cache.
writeFileSync(
  'dist/_routes.json',
  JSON.stringify({ version: 1, include: ['/*'], exclude: ['/assets/*', '/workshop/assets/*', '/grimoire/assets/*'] }, null, 2),
)

writeFileSync(
  'dist/_headers',
  `/*/sw.js
  Cache-Control: no-cache
/*/manifest.webmanifest
  Cache-Control: no-cache
/*/assets/*
  Cache-Control: public, max-age=31536000, immutable
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`,
)
console.log('dist/_redirects, _headers, _routes.json, 404.html written')
