// After the three builds: the site-wide files for Cloudflare Pages in dist/.
//   _redirects — each app answers every address under its folder with its own index.html (written as
//                the folder: Pages serves /x/index.html at /x/ and would not find the .html address)
//                (the router inside takes it from there); /dev/components lives in the workshop.
//   _headers   — service workers and manifests are never cached, so updates arrive at once.
import { writeFileSync } from 'node:fs'

writeFileSync(
  'dist/_redirects',
  `/dev/components /workshop/dev/components 302
/workshop/* /workshop/ 200
/grimoire/* /grimoire/ 200
/* / 200
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
