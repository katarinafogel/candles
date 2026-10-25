import { describe, expect, it } from 'vitest'
import { calcPlaster, calcWax } from '../calc'
import { parseCsv, isServiceRow } from '../csv'
import reducer, { actions, initialData } from '../../store/dataSlice'

describe('calcPlaster', () => {
  it('matches «Книжка» from the sheet (250 ml, 35% water)', () => {
    const r = calcPlaster(250, { density: 1.82, waterPct: 35, plasticizerPct: 1, dyePct: 5, defoamerPct: 0.1 })
    expect(r.waterG).toBe(159.25)
    expect(r.plasterG).toBe(295.75)
    expect(r.plasticizerG).toBe(2.96)
    expect(r.dyeG).toBe(14.79)
    expect(r.defoamerG).toBe(0.3)
  })
})

describe('calcWax', () => {
  it('matches «Шкатулка овал горшочек» (90 g, 7%)', () => {
    const r = calcWax(90, { lossPct: 0, fragrancePct: 7, dyePct: 0, shares: [100] })
    expect(r.waxG).toBe(83.7)
    expect(r.fragranceG).toBe(6.3)
  })
  it('splits a blend by shares', () => {
    const r = calcWax(100, { lossPct: 0, fragrancePct: 0, dyePct: 0, shares: [70, 30] })
    expect(r.waxByPart).toEqual([70, 30])
  })
})

describe('csv', () => {
  it('parses quoted cells and decimal commas', () => {
    expect(parseCsv('a,b\n"27,3",TRUE\n')).toEqual([['a', 'b'], ['27,3', 'TRUE']])
    expect(isServiceRow('Текущая заливка:')).toBe(true)
  })
})

describe('workflow', () => {
  it('mix on two molds creates two holders, stages advance and undo returns materials', () => {
    let s = reducer(initialData, actions.upsertMold({ name: 'Книжка', purpose: 'holder', hasLid: false, copies: 1, waterVolumeMl: 250, waterPct: 35, waxCapacityG: 90, fragrancePct: 7, status: 'active', comment: '' }))
    s = reducer(s, actions.upsertMold({ name: 'Кит', purpose: 'holder', hasLid: false, copies: 1, waterVolumeMl: 100, waterPct: 25, waxCapacityG: 50, fragrancePct: 7, status: 'active', comment: '' }))
    s = reducer(s, actions.upsertMaterial({ id: 'g', category: 'plaster', name: 'Гипс', maker: '', unit: 'g', review: '', initialQty: 1000 }))
    s = reducer(s, actions.upsertMaterial({ id: 'v', category: 'varnishIn', name: 'Лак', maker: '', unit: 'ml', review: '', initialQty: 100 }))
    const part = (factG: number, materialId?: string) => ({ materialId, pct: 0, calcG: factG, factG })
    const d = '2026-10-25T10:00:00.000Z'
    s = reducer(s, actions.createMix({ date: d, moldIds: ['M-001', 'M-002'], mix: { plaster: part(400, 'g'), water: part(200), plasticizer: part(4), defoamer: part(0.4), dye: part(20), density: 1.82, comment: '' } }))
    expect(Object.keys(s.holders)).toEqual(['P-0001', 'P-0002'])
    const stock = (id: string) => s.materials[id].movements.reduce((a, m) => a + m.qty, 0)
    expect(stock('g')).toBeCloseTo(600)
    s = reducer(s, actions.advanceHolders({ ids: ['P-0001', 'P-0002'], date: d, params: { step: 'dried', dryEnd: d } }))
    s = reducer(s, actions.advanceHolders({ ids: ['P-0001', 'P-0002'], date: d, params: { step: 'varnishIn', materialId: 'v', layers: 2 } }))
    expect(stock('v')).toBe(80)
    s = reducer(s, actions.undoHolder({ id: 'P-0001', date: d }))
    expect(s.holders['P-0001'].stage).toBe('dried')
    expect(stock('v')).toBe(90)
  })
})
