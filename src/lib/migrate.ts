import { defaultSettings, initialData, SCHEMA_VERSION } from '../store/dataSlice'
import type { DataState, Holder, HolderStage, Mold } from '../types'
import { isPlaster } from './labels'

/** Brings data of any older schema version forward. Throws for files from a newer app. */
export function migrate(input: Partial<DataState> & { schemaVersion?: number }): DataState {
  const v = input.schemaVersion ?? 1
  if (v > SCHEMA_VERSION) throw new Error('newer-schema')
  const out = {
    ...initialData,
    ...input,
    settings: { ...defaultSettings, ...input.settings },
    schemaVersion: SCHEMA_VERSION,
  } as DataState
  // Server rows carry no version, so every step must be safe to run again on migrated data.
  if (v < 2) {
    out.molds = mapValues(out.molds, migrateMold)
    out.holders = mapValues(out.holders, (h) => migrateHolder(h, out.molds))
  }
  if (v < 3) out.holders = mapValues(out.holders, (h) => pouredHolder(h, out.candles))
  return out
}

const mapValues = <T>(o: Record<string, T>, f: (x: T) => T) => Object.fromEntries(Object.entries(o).map(([k, x]) => [k, f(x)]))

type OldMold = Omit<Mold, 'purpose'> & { purpose: Mold['purpose'] | 'lid'; hasLid?: boolean; status?: 'active' | 'torn' | 'retired' }

/**
 * v2: lids are not cast separately any more and the «torn / retired» status became the archive.
 * A plaster mold without a lid is not a candle holder (a candle would lose its scent there), so it becomes a figurine.
 */
export function migrateMold(old: Mold): Mold {
  const { hasLid, status, ...m } = old as OldMold
  if (hasLid === undefined && status === undefined && m.purpose !== 'lid') return old
  let purpose = m.purpose
  if (purpose === 'lid') purpose = 'figurine'
  // Plaster dishes used to be filed as «decor»; decor is wax now.
  else if ((purpose === 'decor' || purpose === 'holder') && /тарел|миск|блюд|поднос/i.test(m.name)) purpose = 'dish'
  else if (purpose === 'holder' && hasLid === false) purpose = 'figurine'
  return { ...m, purpose, ...(status && status !== 'active' ? { archived: true } : {}) } as Mold
}

type OldHolder = Holder & { isLid?: boolean; pairId?: string }

const doneStage = (st: string) => (st === 'lidDone' ? 'done' : st) as HolderStage

export function migrateHolder(old: Holder, molds: Record<string, Mold>): Holder {
  const { isLid, pairId, ...h } = old as OldHolder
  void pairId
  if (h.purpose && isLid === undefined && h.stage !== ('lidDone' as HolderStage)) return old
  const moldPurpose = molds[h.moldId]?.purpose
  return {
    ...h,
    purpose:
      h.purpose ??
      // Already got dampers or a wick: it is a holder whatever the mold is called now.
      (isLid ? 'figurine' : h.history.some((e) => e.stage === 'dampers') ? 'holder' : moldPurpose && isPlaster(moldPurpose) ? moldPurpose : 'holder'),
    stage: doneStage(h.stage),
    history: h.history.map((e) => (e.stage === 'lidDone' ? { ...e, stage: 'done' } : e)),
    ...(h.defect && h.defect.stage === ('lidDone' as HolderStage) ? { defect: { ...h.defect, stage: 'done' as HolderStage } } : {}),
  }
}

/** v3: a holder whose candle is already poured is «стал свечой»; with only a wick it still waits for the pour. */
export function pouredHolder(h: Holder, candles: DataState['candles']): Holder {
  const c = h.candleId ? candles[h.candleId] : undefined
  if (h.stage !== 'wicked' || !c?.pouredAt) return h
  return { ...h, stage: 'candle', history: [...h.history, { stage: 'candle', date: c.pouredAt, consumption: [], params: { candleId: c.id, pourId: c.pourId } }] }
}
