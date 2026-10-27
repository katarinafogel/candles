// GENERATED from src/grimoire/rows.ts by scripts/sync-agent-core.mjs — edit the original, then run: node scripts/sync-agent-core.mjs
// How the grimoire lies in the `entities` table: one row per entity, its settings in (meta, grimoire).
// Shared by the app's sync and by the agent's server (supabase/functions/grimoire-mcp), so both read
// and write exactly the same rows.
import type { GrimoireState } from './types.ts'

export type GrimoireKind = 'task' | 'project' | 'habit' | 'habit_log' | 'wish' | 'wheel_practice' | 'journal' | 'jar' | 'jar_tx' | 'coin_tx' | 'person_notes'

export interface RowChange {
  op: 'upsert' | 'delete'
  kind: GrimoireKind | 'meta'
  id: string
  data?: unknown
}

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
  ['personNotes', 'person_notes'],
]

export const grimoireKinds: GrimoireKind[] = grimoireCollections.map(([, k]) => k)
const kindSet = new Set<string>(grimoireKinds)
export const isGrimoireRow = (kind: string, id: string) => kindSet.has(kind) || (kind === 'meta' && id === 'grimoire')

/** Rows to write so the stored grimoire goes from `prev` to `next`. Entities are immutable, so a new reference means a change. */
export function diffGrimoire(prev: GrimoireState, next: GrimoireState): RowChange[] {
  const out: RowChange[] = []
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

/** Collects grimoire rows into the state shape (not yet migrated). Other rows are ignored. */
export function rowsToGrimoire(rows: { kind: string; id: string; data: unknown }[]): Partial<GrimoireState> {
  const g = Object.fromEntries(grimoireCollections.map(([key]) => [key, {}])) as Record<string, Record<string, unknown>> & { meta?: unknown }
  const byKind: Record<string, string> = Object.fromEntries(grimoireCollections.map(([key, kind]) => [kind, key]))
  for (const r of rows) {
    if (r.kind === 'meta' && r.id === 'grimoire') g.meta = r.data
    else if (byKind[r.kind]) g[byKind[r.kind]][r.id] = r.data
  }
  return g as Partial<GrimoireState>
}
