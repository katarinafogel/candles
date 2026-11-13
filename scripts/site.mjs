// After the three builds: the site-wide files for Cloudflare Pages in dist/.
//   _redirects — each app answers every address under its folder with its own index.html
//                (the router inside takes it from there); /dev/components lives in the workshop.
//   _headers   — service workers and manifests are never cached, so updates arrive at once.
import { writeFileSync } from 'node:fs'

writeFileSync(
  'dist/_redirects',
  `/dev/components /workshop/dev/components 302
/workshop/* /workshop/index.html 200
/grimoire/* /grimoire/index.html 200
/* /index.html 200
`,
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
console.log('dist/_redirects, dist/_headers written')
