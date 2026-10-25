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
})
