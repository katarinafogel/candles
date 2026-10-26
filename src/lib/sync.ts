// Keeps the Redux data in step with Supabase.
//
// Every data/* action is diffed against the previous state (entities are immutable, so a
// changed reference means a changed entity). Changes go to a queue persisted on the device
// and are sent to apply_changes in one transaction; the queue survives reloads and is
// retried when the connection comes back. On sign-in and when the app comes back to the
// foreground the whole account is loaded from the server.
import type { Middleware, UnknownAction } from '@reduxjs/toolkit'
import localforage from 'localforage'
import { actions, initialData } from '../store/dataSlice'
import { grimoireActions, initialGrimoire, migrateGrimoire } from '../store/grimoireSlice'
import { localActions } from '../store/localSlice'
import type { GrimoireState } from '../grimoire/types'
import type { DataState, Review } from '../types'
import { migrate } from './migrate'
import { supabase } from './supabase'

type WorkshopKind = 'mold' | 'material' | 'mix' | 'holder' | 'candle' | 'pour' | 'decor' | 'person' | 'instruction' | 'meta' | 'review'
type GrimoireKind = 'task' | 'project' | 'habit' | 'habit_log' | 'wish' | 'wheel_practice' | 'journal' | 'jar' | 'jar_tx' | 'coin_tx'
type Kind = WorkshopKind | GrimoireKind

export interface Change {
  op: 'upsert' | 'delete'
  kind: Kind
  id: string
  data?: unknown
}

const collections: [keyof DataState, Kind][] = [
  ['molds', 'mold'],
  ['materials', 'material'],
  ['mixes', 'mix'],
  ['holders', 'holder'],
  ['candles', 'candle'],
  ['pours', 'pour'],
  ['decor', 'decor'],
  ['people', 'person'],
  ['instructions', 'instruction'],
  ['reviews', 'review'],
]

/** Grimoire collections; its settings are the row (meta, grimoire). */
export const grimoireCollections: [Exclude<keyof GrimoireState, 'meta'>, GrimoireKind][] = [
  ['tasks', 'task'],
  ['projects', 'project'],
  ['habits', 'habit'],
  ['habitLogs', 'habit_log'],
  ['wishes', 'wish'],
  ['practices', 'wheel_practice'],
  ['journal', 'journal'],
  ['jars', 'jar'],
  ['jarTxs', 'jar_tx'],
  ['coinTxs', 'coin_tx'],
]

const grimoireKinds = new Set<string>(grimoireCollections.map(([, k]) => k))
export const isGrimoireRow = (kind: string, id: string) => grimoireKinds.has(kind) || (kind === 'meta' && id === 'grimoire')

export function diffGrimoire(prev: GrimoireState, next: GrimoireState): Change[] {
  const out: Change[] = []
  for (const [key, kind] of grimoireCollections) {
    const a = (prev[key] ?? {}) as Record<string, unknown>
    const b = (next[key] ?? {}) as Record<string, unknown>
    if (a === b) continue
    for (const id in b) if (a[id] !== b[id]) out.push({ op: 'upsert', kind, id, data: b[id] })
    for (const id in a) if (!(id in b)) out.push({ op: 'delete', kind, id })
  }
  if (prev.meta !== next.meta) out.push({ op: 'upsert', kind: 'meta', id: 'grimoire', data: next.meta })
  return out
}

export function diff(prev: DataState, next: DataState): Change[] {
  const out: Change[] = []
  for (const [key, kind] of collections) {
    const a = prev[key] as Record<string, unknown>
    const b = next[key] as Record<string, unknown>
    if (a === b) continue
    for (const id in b) if (a[id] !== b[id]) out.push({ op: 'upsert', kind, id, data: b[id] })
    for (const id in a) if (!(id in b)) out.push({ op: 'delete', kind, id })
  }
  if (prev.counters !== next.counters) out.push({ op: 'upsert', kind: 'meta', id: 'counters', data: next.counters })
  if (prev.settings !== next.settings) out.push({ op: 'upsert', kind: 'meta', id: 'settings', data: next.settings })
  return out
}

/** Marks a data action that came from the server, so it is not sent back. */
export const fromServer = <A extends UnknownAction>(a: A) => ({ ...a, meta: { fromServer: true } })

// ---------- queue ----------

interface StoreLike {
  getState: () => { data: DataState; grimoire: GrimoireState; local: { ownerId?: string | null; roles?: string[] } }
  dispatch: (a: UnknownAction) => unknown
}

let store: StoreLike | undefined
const pending = new Map<string, Change>()
let flushTimer: ReturnType<typeof setTimeout> | undefined
let flushing: Promise<void> | undefined

const queueKey = () => `pending:${store?.getState().local.ownerId ?? 'none'}`

function report(extra: { syncing?: boolean; error?: string }) {
  store?.dispatch(localActions.setSync({ pending: pending.size, ...extra }))
}

async function saveQueue() {
  try {
    await localforage.setItem(queueKey(), [...pending.values()])
  } catch {
    /* the queue also lives in memory; it is lost only if the tab closes */
  }
}

function enqueue(changes: Change[]) {
  if (!changes.length) return
  for (const c of changes) pending.set(`${c.kind}:${c.id}`, c)
  report({})
  void saveQueue()
  clearTimeout(flushTimer)
  flushTimer = setTimeout(() => void flush(), 400)
}

export function flush(): Promise<void> {
  if (flushing) return flushing
  if (!pending.size || !navigator.onLine || !store?.getState().local.ownerId) return Promise.resolve()
  flushing = (async () => {
    report({ syncing: true })
    try {
      while (pending.size) {
        const batch = [...pending.entries()].slice(0, 400)
        const { error } = await supabase.rpc('apply_changes', { p_changes: batch.map(([, c]) => c) })
        if (error) throw new Error(error.message)
        // Something changed again while sending: keep the newer version queued.
        for (const [k, c] of batch) if (pending.get(k) === c) pending.delete(k)
        await saveQueue()
      }
      report({ syncing: false, error: undefined })
    } catch (e) {
      report({ syncing: false, error: (e as Error).message })
    } finally {
      flushing = undefined
    }
  })()
  return flushing
}

type SyncedState = { data: DataState; grimoire: GrimoireState; local: { ownerId?: string | null; roles?: string[] } }

export const syncMiddleware: Middleware = (api) => (next) => (action) => {
  const before = api.getState() as SyncedState
  const result = next(action)
  const a = action as UnknownAction & { meta?: { fromServer?: boolean } }
  if (typeof a.type !== 'string' || a.meta?.fromServer) return result
  const state = api.getState() as SyncedState
  if (!state.local.ownerId) return result
  if (a.type.startsWith('data/') && state.data !== before.data) enqueue(diff(before.data, state.data))
  // Without the witch role the server refuses grimoire rows, and one refused row would fail the whole batch.
  if (a.type.startsWith('grimoire/') && state.grimoire !== before.grimoire && state.local.roles?.includes('witch'))
    enqueue(diffGrimoire(before.grimoire, state.grimoire))
  return result
}

// ---------- loading ----------

async function fetchAll(): Promise<{ data: DataState; grimoire: GrimoireState; empty: boolean }> {
  const rows: { kind: Kind; id: string; data: unknown }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('entities').select('kind,id,data').order('kind').order('id').range(from, from + 999)
    if (error) throw new Error(error.message)
    rows.push(...(data as typeof rows))
    if (data.length < 1000) break
  }
  const reviews: { id: string; candle_id: string; data: Record<string, unknown>; source: string; read: boolean; created_at: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('reviews').select('id,candle_id,data,source,read,created_at').order('created_at').range(from, from + 999)
    if (error) throw new Error(error.message)
    reviews.push(...(data as typeof reviews))
    if (data.length < 1000) break
  }

  const d: Partial<DataState> & Record<string, unknown> = {
    molds: {},
    materials: {},
    mixes: {},
    holders: {},
    candles: {},
    pours: {},
    decor: {},
    people: {},
    instructions: {},
    reviews: {},
  }
  const byKind: Record<string, string> = Object.fromEntries(collections.map(([key, kind]) => [kind, key]))
  const g = Object.fromEntries(grimoireCollections.map(([key]) => [key, {}])) as Record<string, Record<string, unknown>> & { meta?: unknown }
  const gByKind: Record<string, string> = Object.fromEntries(grimoireCollections.map(([key, kind]) => [kind, key]))
  let workshopRows = 0
  for (const r of rows) {
    if (r.kind === 'meta') {
      if (r.id === 'counters') d.counters = r.data as DataState['counters']
      if (r.id === 'settings') d.settings = r.data as DataState['settings']
      if (r.id === 'grimoire') g.meta = r.data
      else workshopRows++
    } else if (byKind[r.kind]) {
      ;(d[byKind[r.kind]] as Record<string, unknown>)[r.id] = r.data
      workshopRows++
    } else if (gByKind[r.kind]) {
      g[gByKind[r.kind]][r.id] = r.data
    }
    // Rows of kinds this version doesn't know (from a newer app) are left alone.
  }
  for (const r of reviews) {
    d.reviews![r.id] = {
      ...(r.data as object),
      id: r.id,
      candleId: r.candle_id,
      source: r.source as Review['source'],
      read: r.read,
      date: (r.data.date as string) ?? r.created_at,
    } as Review
  }
  const empty = !workshopRows && !reviews.length
  // A brand-new account starts with the default instruction template.
  if (empty) d.instructions = initialData.instructions
  return { data: migrate(d), grimoire: migrateGrimoire(g as Partial<GrimoireState>), empty }
}

const hasLocalData = (d: DataState) =>
  Object.keys(d.molds).length + Object.keys(d.materials).length + Object.keys(d.candles).length + Object.keys(d.holders).length > 0

/**
 * Roles of the signed-in master. A database without migration 0002 has no user_roles table yet:
 * that means no roles. Any other failure (offline) keeps the cached roles.
 */
async function fetchRoles(userId: string): Promise<string[] | undefined> {
  const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', userId)
  if (error) return error.code === '42P01' || error.code === 'PGRST205' ? [] : undefined
  return (data as { role: string }[]).map((r) => r.role).sort()
}

const grimoireIsEmpty = (g: GrimoireState) => grimoireCollections.every(([key]) => !Object.keys(g[key] ?? {}).length)

/** Loads the account. Local changes are sent first so the server copy is complete. */
export async function load(): Promise<void> {
  if (!store) return
  const ownerId = store.getState().local.ownerId
  if (ownerId) {
    const roles = await fetchRoles(ownerId).catch(() => undefined)
    if (roles) store.dispatch(localActions.setRoles(roles))
  }
  const witch = !!store.getState().local.roles?.includes('witch')
  if (!witch) {
    // The role went away: grimoire changes can't be sent any more, and the device copy is cleared.
    for (const [k, c] of pending) if (isGrimoireRow(c.kind, c.id)) pending.delete(k)
    report({})
    void saveQueue()
    if (!grimoireIsEmpty(store.getState().grimoire)) store.dispatch(fromServer(grimoireActions.replaceAll(initialGrimoire)))
  }
  await flush()
  if (pending.size) return // offline or failing: keep working on the local copy
  report({ syncing: true })
  try {
    const { data, grimoire, empty } = await fetchAll()
    if (witch) store.dispatch(fromServer(grimoireActions.replaceAll(grimoire)))
    const local = store.getState().data
    if (empty) {
      // First sign-in: data made on this device before accounts existed moves into the account.
      const start = hasLocalData(local) ? local : data
      store.dispatch(fromServer(actions.replaceAll(start)))
      enqueue(diff({ ...initialData, instructions: {}, counters: { ...initialData.counters }, settings: { ...initialData.settings } }, start))
    } else {
      store.dispatch(fromServer(actions.replaceAll(data)))
    }
    store.dispatch(localActions.setSync({ loadedAt: new Date().toISOString(), error: undefined, syncing: false }))
  } catch (e) {
    report({ syncing: false, error: (e as Error).message })
  }
}

/** Called once a session is known; switches the device cache to that user. */
export async function startSync(userId: string, email?: string) {
  if (!store) return
  const prevOwner = store.getState().local.ownerId
  if (prevOwner && prevOwner !== userId) {
    // Someone else used this device before: their cached data must not leak into this account.
    store.dispatch(fromServer(actions.replaceAll(initialData)))
    store.dispatch(fromServer(grimoireActions.replaceAll(initialGrimoire)))
    store.dispatch(localActions.setRoles([]))
  }
  store.dispatch(localActions.setAccount({ ownerId: userId, email }))
  pending.clear()
  const saved = (await localforage.getItem<Change[]>(queueKey()).catch(() => null)) ?? []
  for (const c of saved) pending.set(`${c.kind}:${c.id}`, c)
  report({})
  await load()
}

export async function stopSync() {
  if (!store) return
  pending.clear()
  store.dispatch(localActions.setAccount({ ownerId: null }))
  store.dispatch(localActions.setProfile(null))
  store.dispatch(localActions.setRoles([]))
  store.dispatch(fromServer(actions.replaceAll(initialData)))
  store.dispatch(fromServer(grimoireActions.replaceAll(initialGrimoire)))
  report({ error: undefined })
}

export const pendingCount = () => pending.size

export function initSync(s: StoreLike) {
  store = s
  const retry = () => void flush()
  window.addEventListener('online', retry)
  setInterval(retry, 30_000)
  // Pick up changes made on another device when the app comes back to the foreground.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !store?.getState().local.ownerId) return
    const loadedAt = (store.getState() as unknown as { local: { sync?: { loadedAt?: string } } }).local.sync?.loadedAt
    if (!loadedAt || Date.now() - new Date(loadedAt).getTime() > 60_000) void load()
  })
}
