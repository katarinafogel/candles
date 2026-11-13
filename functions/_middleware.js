// Cloudflare Pages: each app answers every page address under its folder with its own index.html,
// so /grimoire/rituals opens the grimoire and its router shows the page. Files are served as they
// are first; only a page that is not a file (404) gets its app's index.html. The showcase takes
// everything outside /workshop/ and /grimoire/ (/projects, /candles-review/…).
// (_redirects can't do this: its rewrites would also replace real files like sw.js.)
const apps = ['/workshop/', '/grimoire/']

export async function onRequest(context) {
  const res = await context.next()
  if (res.status !== 404) return res
  const { request } = context
  if (request.method !== 'GET' && request.method !== 'HEAD') return res
  const url = new URL(request.url)
  // A missing file (with an extension) stays missing: it must not turn into a page.
  if (/\.[a-z0-9]+$/i.test(url.pathname)) return res
  const app = apps.find((p) => url.pathname.startsWith(p) || `${url.pathname}/` === p) ?? '/'
  const page = await context.env.ASSETS.fetch(new URL(app, url))
  return new Response(page.body, { status: 200, headers: page.headers })
}
