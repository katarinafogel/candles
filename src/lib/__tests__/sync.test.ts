import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))
vi.mock('localforage', () => ({ default: { setItem: async () => {}, getItem: async () => null, config: () => {} } }))

const { diff } = await import('../sync')
const { default: reducer, actions, initialData } = await import('../../store/dataSlice')

describe('sync diff', () => {
  it('sends only the entities a step touched, in one batch', () => {
    let s = reducer(initialData, actions.upsertMold({ name: 'Книжка', purpose: 'holder', copies: 1, waterVolumeMl: 250, waterPct: 35, waxCapacityG: 90, fragrancePct: 7, comment: '' }))
    s = reducer(s, actions.upsertMaterial({ id: 'g', category: 'plaster', name: 'Гипс', maker: '', unit: 'g', review: '', initialQty: 1000 }))
    const before = s
    const part = (factG: number, materialId?: string) => ({ materialId, pct: 0, calcG: factG, factG })
    s = reducer(s, actions.createMix({ date: '2026-10-25T10:00:00.000Z', moldIds: ['M-001'], mix: { plaster: part(300, 'g'), water: part(160), plasticizer: part(3), defoamer: part(0.3), dye: part(15), density: 1.82, comment: '' } }))
    const ch = diff(before, s).map((c) => `${c.op}:${c.kind}:${c.id}`).sort()
    expect(ch).toEqual(['upsert:holder:P-0001', 'upsert:material:g', 'upsert:meta:counters', 'upsert:mix:G-0001'])
  })
  it('sends deletions', () => {
    const s = reducer(initialData, actions.upsertPerson({ id: 'p1', name: 'Аня', contact: '', notes: '' }))
    const after = reducer(s, actions.deletePerson('p1'))
    expect(diff(s, after)).toEqual([{ op: 'delete', kind: 'person', id: 'p1' }])
  })
  it('keeps a deleted holder, its candle and reviews in the database with a date', () => {
    const date = '2026-11-01T10:00:00.000Z'
    const wick = { scheme: 'single', lengthCm: 10 } as never
    const part = (factG: number) => ({ pct: 0, calcG: factG, factG })
    let s = reducer(initialData, actions.upsertMold({ name: 'Книжка', purpose: 'holder', copies: 1, waterVolumeMl: 250, waterPct: 35, waxCapacityG: 90, fragrancePct: 7, comment: '' }))
    s = reducer(s, actions.createMix({ date, moldIds: ['M-001'], mix: { plaster: part(300), water: part(160), plasticizer: part(3), defoamer: part(0.3), dye: part(15), density: 1.82, comment: '' } }))
    s = { ...s, holders: { 'P-0001': { ...s.holders['P-0001'], stage: 'dampers' } } }
    s = reducer(s, actions.advanceHolders({ ids: ['P-0001'], date, params: { step: 'wicked', wick, name: 'Свеча' } }))
    s = reducer(s, actions.createPour({ pour: { date, candleIds: ['S-0001'], waxes: [], fact: { waxG: [] }, fragrance: {}, dye: {} } as never }))
    s = reducer(s, actions.addReviews([{ id: 'r1', candleId: 'S-0001', date, source: 'manual', read: true }]))
    const after = reducer(s, actions.deleteItem({ kind: 'candle', id: 'S-0001', date }))
    expect(after.holders).toEqual({})
    expect(after.candles).toEqual({})
    expect(after.reviews).toEqual({})
    expect(after.pours['W-0001'].candleIds).toEqual([])
    const removed = diff(s, after, date).filter((c) => c.deleteDate)
    expect(removed.map((c) => `${c.op}:${c.kind}:${c.id}`).sort()).toEqual(['upsert:candle:S-0001', 'upsert:holder:P-0001', 'upsert:review:r1'])
    expect(removed.every((c) => c.deleteDate === date && c.data)).toBe(true)
    // From the holder's page the same pair goes.
    expect(reducer(s, actions.deleteItem({ kind: 'holder', id: 'P-0001', date })).candles).toEqual({})
  })
  it('still deletes outright when a step is undone', () => {
    const s = reducer(initialData, actions.createMoldedCandle({ moldId: 'M-001', name: '', wick: { scheme: 'single', lengthCm: 10 } as never, date: '2026-11-01T10:00:00.000Z' }))
    const after = reducer(s, actions.undoCandle({ id: 'S-0001', date: '2026-11-01T11:00:00.000Z' }))
    expect(diff(s, after)).toEqual([{ op: 'delete', kind: 'candle', id: 'S-0001' }])
  })
})
