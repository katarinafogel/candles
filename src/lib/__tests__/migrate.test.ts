import { describe, expect, it } from 'vitest'
import reducer, { actions, initialData, type HolderStepParams } from '../../store/dataSlice'
import { migrate } from '../migrate'
import type { DataState } from '../../types'

const base = { copies: 1, waterVolumeMl: 100, waterPct: 25, waxCapacityG: 50, fragrancePct: 7, comment: '' }

describe('v2 migration', () => {
  it('turns lids, lidless holders and torn molds into the new types and the archive', () => {
    const old = {
      molds: {
        a: { ...base, id: 'a', name: 'Шкатулка', purpose: 'holder', hasLid: true, status: 'active' },
        b: { ...base, id: 'b', name: 'Ваза', purpose: 'holder', hasLid: false, status: 'active' },
        c: { ...base, id: 'c', name: 'Крышка', purpose: 'lid', hasLid: false, status: 'torn' },
        d: { ...base, id: 'd', name: 'Тыква', purpose: 'candle', hasLid: false, status: 'retired' },
      },
      holders: {
        p: { id: 'p', moldId: 'c', isLid: true, pairId: 'q', stage: 'lidDone', history: [{ stage: 'drying' }, { stage: 'lidDone' }] },
        q: { id: 'q', moldId: 'a', isLid: false, pairId: 'p', stage: 'drying', history: [{ stage: 'drying' }] },
      },
    } as unknown as Partial<DataState>
    const d = migrate(old)
    expect(d.molds.a).toEqual({ ...base, id: 'a', name: 'Шкатулка', purpose: 'holder' })
    expect(d.molds.b.purpose).toBe('figurine')
    expect(d.molds.c).toMatchObject({ purpose: 'figurine', archived: true })
    expect(d.molds.d).toMatchObject({ purpose: 'candle', archived: true })
    expect(d.holders.p).toMatchObject({ purpose: 'figurine', stage: 'done' })
    expect(d.holders.p.history.map((e) => e.stage)).toEqual(['drying', 'done'])
    expect(d.holders.q).toMatchObject({ purpose: 'holder' })
    expect('pairId' in d.holders.q).toBe(false)
    // Server rows carry no version, so migrating twice must change nothing.
    expect(migrate({ ...d, schemaVersion: 1 })).toEqual(d)
  })
})

describe('dishes and figurines', () => {
  it('are cast in a mix and finish after the outer varnish', () => {
    let s = reducer(initialData, actions.upsertMold({ ...base, name: 'Тарелка лист', purpose: 'dish' }))
    const part = { pct: 0, calcG: 0, factG: 0 }
    const mix = { plaster: part, water: part, plasticizer: part, defoamer: part, dye: part, density: 1.82, comment: '' }
    s = reducer(s, actions.createMix({ date: '2026-10-25T10:00:00.000Z', moldIds: ['M-001'], mix }))
    const id = Object.keys(s.holders)[0]
    expect(s.holders[id].purpose).toBe('dish')
    const date = '2026-10-26T10:00:00.000Z'
    for (const params of [
      { step: 'dried', dryEnd: date },
      { step: 'varnishIn', layers: 1 },
      { step: 'painted', skip: true, description: '', paints: [] as { materialId: string; qty: number }[] },
      { step: 'varnishOut', kind: 'gloss', layers: 1 },
      { step: 'done' },
    ] as HolderStepParams[])
      s = reducer(s, actions.advanceHolders({ ids: [id], date, params }))
    expect(s.holders[id].stage).toBe('done')
  })
})

describe('undo after a stage change', () => {
  it('maps old decor dishes, and undoing a pour removes the emptied pour', () => {
    let s = reducer(initialData, actions.upsertMold({ ...base, name: 'Пень', purpose: 'figurine' }))
    s = migrate({ ...s, schemaVersion: 1, molds: { ...s.molds, x: { ...base, id: 'x', name: 'Тарелка сердечко', purpose: 'decor', hasLid: false } as never } })
    expect(s.molds.x.purpose).toBe('dish')
    s = reducer(s, actions.createMoldedCandle({ moldId: 'M-001', name: 'Тест', wick: { scheme: 'double05', lengthCm: 10 }, date: '2026-10-26T10:00:00.000Z' }))
    const cid = Object.keys(s.candles)[0]
    const pour = { date: '2026-10-26T11:00:00.000Z', candleIds: [cid], waxes: [], lossPct: 0, fragrance: { pct: 0 }, dye: { pct: 0 }, calc: { totalG: 0, waxG: 0, fragranceG: 0, dyeG: 0 }, fact: { waxG: [], fragranceG: 0, dyeG: 0 }, comment: '' }
    s = reducer(s, actions.createPour({ pour: pour as never }))
    expect(Object.keys(s.pours)).toHaveLength(1)
    s = reducer(s, actions.undoCandle({ id: cid, date: '2026-10-26T12:00:00.000Z' }))
    expect(s.candles[cid].stage).toBe('wicked')
    expect(s.pours).toEqual({})
  })
})

describe('holder flow', () => {
  it('ticks varnish leaves, waits for the pour after the wick and becomes a candle when poured', () => {
    let s = reducer(initialData, actions.upsertMold({ ...base, name: 'Горшочек', purpose: 'holder' }))
    const part = { pct: 0, calcG: 0, factG: 0 }
    const mix = { plaster: part, water: part, plasticizer: part, defoamer: part, dye: part, density: 1.82, comment: '' }
    s = reducer(s, actions.createMix({ date: '2026-10-25T10:00:00.000Z', moldIds: ['M-001'], mix }))
    const id = Object.keys(s.holders)[0]
    const date = '2026-10-26T10:00:00.000Z'
    s = reducer(s, actions.advanceHolders({ ids: [id], date, params: { step: 'dried', dryEnd: date } }))
    for (let n = 1; n < 5; n++) s = reducer(s, actions.setVarnishLayers({ id, done: n, date }))
    expect(s.holders[id]).toMatchObject({ stage: 'dried', layersDone: 4 })
    s = reducer(s, actions.setVarnishLayers({ id, done: 5, date }))
    expect(s.holders[id]).toMatchObject({ stage: 'varnishIn', varnishIn: { layers: 5 } })
    expect(s.holders[id].layersDone).toBeUndefined()
    // Undo takes off only the last layer.
    s = reducer(s, actions.undoHolder({ id, date }))
    expect(s.holders[id]).toMatchObject({ stage: 'dried', layersDone: 4 })
    s = reducer(s, actions.setVarnishLayers({ id, done: 5, date }))
    s = reducer(s, actions.advanceHolders({ ids: [id], date, params: { step: 'painted', skip: true, description: '', paints: [] } }))
    s = reducer(s, actions.setVarnishLayers({ id, done: 3, date }))
    expect(s.holders[id]).toMatchObject({ stage: 'varnishOut', varnishOut: { kind: 'gloss', layers: 3 } })
    s = reducer(s, actions.advanceHolders({ ids: [id], date, params: { step: 'dampers', count: 3 } }))
    s = reducer(s, actions.advanceHolders({ ids: [id], date, params: { step: 'wicked', wick: { scheme: 'double05', lengthCm: 10 }, name: 'Горшочек' } }))
    const cid = s.holders[id].candleId!
    expect(s.holders[id].stage).toBe('wicked')
    expect(s.candles[cid].stage).toBe('wicked')
    const pour = { date, candleIds: [cid], waxes: [], lossPct: 0, fragrance: { pct: 0 }, dye: { pct: 0 }, calc: { totalG: 0, waxG: 0, fragranceG: 0, dyeG: 0 }, fact: { waxG: [], fragranceG: 0, dyeG: 0 }, comment: '' }
    s = reducer(s, actions.createPour({ pour: pour as never }))
    expect(s.holders[id].stage).toBe('candle')
    expect(s.candles[cid].stage).toBe('curing')
    s = reducer(s, actions.undoCandle({ id: cid, date }))
    expect(s.holders[id].stage).toBe('wicked')
    // Old data: a holder with a poured candle was left at «wicked».
    s = reducer(s, actions.createPour({ pour: pour as never }))
    const old = { ...s, holders: { [id]: { ...s.holders[id], stage: 'wicked' as const, history: s.holders[id].history.slice(0, -1) } } }
    const m = migrate({ ...old, schemaVersion: 2 })
    expect(m.holders[id].stage).toBe('candle')
    expect(migrate({ ...m, schemaVersion: 1 })).toEqual(m)
  })
})
