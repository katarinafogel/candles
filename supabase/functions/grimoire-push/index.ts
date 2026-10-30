// Push notifications of the grimoire. Deploy with JWT verification off (the routes check their own keys):
//   GET  /grimoire-push/public-key — the VAPID public key a device subscribes with (made on first call)
//   POST /grimoire-push/tick       — every 15 minutes from pg_cron (x-cron-key): send what is due
//   POST /grimoire-push/test       — the signed-in witch's own devices get a test message
// What and when comes from the grimoire's settings (meta.notify, eveningAt, the time zone) and the
// same core the app runs (core/, synced by scripts/sync-agent-core.mjs).
import webpush from 'web-push'
import { dayKeyIn } from './core/grimoire/days.ts'
import { dueMessages, type NotifyKind, type PushMessage } from './core/grimoire/notify.ts'
import { rowsToGrimoire } from './core/grimoire/rows.ts'
import type { GrimoireMeta, GrimoireState } from './core/grimoire/types.ts'

const url = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:grimoire@candles.invalid'
const db = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...db, ...(init.headers ?? {}) } })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

interface Config {
  public_key: string | null
  private_key: string | null
  cron_key: string
}
interface Sub {
  endpoint: string
  owner_id: string
  keys: { p256dh: string; auth: string }
}

/** The VAPID pair is made once and kept in push_config, which only this function can read. */
async function config(): Promise<Config & { public_key: string; private_key: string }> {
  const [c] = await rest<Config[]>('push_config?id=eq.1&select=*')
  if (c.public_key && c.private_key) return c as Config & { public_key: string; private_key: string }
  const k = webpush.generateVAPIDKeys()
  await rest('push_config?id=eq.1', { method: 'PATCH', body: JSON.stringify({ public_key: k.publicKey, private_key: k.privateKey }) })
  return { ...c, public_key: k.publicKey, private_key: k.privateKey }
}

async function send(c: Config & { public_key: string; private_key: string }, subs: Sub[], m: Omit<PushMessage, 'kind'>) {
  webpush.setVapidDetails(subject, c.public_key, c.private_key)
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(m), { TTL: 3 * 3600 })
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      // The device unsubscribed or the browser dropped it: forget it.
      if (code === 404 || code === 410) await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE' })
      else console.error('push failed', code, (e as Error).message)
    }
  }
}

/** Only what the messages read: the rows as they are, the settings over their defaults (as the app has them). */
function grimoireOf(rows: { kind: string; id: string; data: unknown }[]): GrimoireState {
  const g = rowsToGrimoire(rows)
  const m = (g.meta ?? {}) as Partial<GrimoireMeta>
  const meta = {
    ...m,
    dayBoundaryHour: m.dayBoundaryHour ?? 4,
    hemisphere: m.hemisphere ?? 'north',
    eveningAt: m.eveningAt ?? '21:00',
    nav: { active: false, history: [], ...m.nav },
    notify: { morning: '09:00', afternoon: '', evening: true, deadlines: true, sabbats: true, ...m.notify },
  } as GrimoireMeta
  return { tasks: {}, projects: {}, habits: {}, habitLogs: {}, wishes: {}, practices: {}, journal: {}, jars: {}, jarTxs: {}, coinTxs: {}, personNotes: {}, cycles: {}, ...g, meta }
}

const localTime = (tz: string, at: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(at)

async function tick() {
  const c = await config()
  const subs = await rest<Sub[]>('push_subscriptions?select=endpoint,owner_id,keys')
  const owners = [...new Set(subs.map((s) => s.owner_id))]
  const now = new Date()
  let sent = 0
  for (const owner of owners) {
    let rows: { kind: string; id: string; data: unknown }[]
    try {
      rows = await rest('rpc/grimoire_rows_as', { method: 'POST', body: JSON.stringify({ p_owner: owner }) })
    } catch {
      continue // no witch role any more
    }
    const g = grimoireOf(rows)
    const tz = g.meta.timeZone ?? 'Europe/Moscow'
    const today = dayKeyIn(now, g.meta.dayBoundaryHour, tz)
    const [state] = await rest<{ day: string; sent: NotifyKind[] }[]>(`push_state?owner_id=eq.${owner}&select=day,sent`)
    const before = state?.day === today ? state.sent : []
    const msgs = dueMessages(g, today, localTime(tz, now), before)
    if (!msgs.length) continue
    const mine = subs.filter((s) => s.owner_id === owner)
    for (const m of msgs) await send(c, mine, { title: m.title, body: m.body, url: m.url })
    sent += msgs.length
    await rest('push_state', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ owner_id: owner, day: today, sent: [...before, ...msgs.map((m) => m.kind)] }),
    })
  }
  return { owners: owners.length, sent }
}

/** The caller by their app session token. */
async function caller(req: Request) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '')
  if (!token) return undefined
  const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${token}` } })
  if (!res.ok) return undefined
  return ((await res.json()) as { id: string }).id
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const path = new URL(req.url).pathname.split('/').filter(Boolean).pop()
  try {
    if (req.method === 'GET' && path === 'public-key') return json({ publicKey: (await config()).public_key })
    if (req.method === 'POST' && path === 'tick') {
      const c = await config()
      if (req.headers.get('x-cron-key') !== c.cron_key) return json({ error: 'forbidden' }, 403)
      return json(await tick())
    }
    if (req.method === 'POST' && path === 'test') {
      const who = await caller(req)
      if (!who) return json({ error: 'sign in' }, 401)
      const subs = await rest<Sub[]>(`push_subscriptions?owner_id=eq.${who}&select=endpoint,owner_id,keys`)
      if (!subs.length) return json({ error: 'no devices' }, 404)
      await send(await config(), subs, { title: 'Гримуар дел', body: 'Уведомления работают. Луна на месте.', url: '#/g' })
      return json({ ok: true, devices: subs.length })
    }
    return json({ error: 'not found' }, 404)
  } catch (e) {
    console.error(e)
    return json({ error: (e as Error).message }, 500)
  }
})
