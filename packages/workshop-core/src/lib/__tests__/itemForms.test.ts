import { describe, expect, it } from 'vitest'
import { candleToForm, emptyCandleForm, emptyHolderForm, formToDecor, formToHolder, formToPour, holderToForm } from '../itemForms'
import reducer, { actions, initialData } from '../../store/dataSlice'
import type { Candle, Holder, Pour } from '../../types'

const date = '2026-11-01T10:00:00.000Z'

describe('holder form', () => {
  it('leaves empty sections out', () => {
    const r = formToHolder(emptyHolderForm(), 1.82)
    expect(r).toEqual({ comment: undefined, mix: undefined, varnishIn: undefined, painting: undefined, varnishOut: undefined, dampers: undefined })
  })
  it('keeps what a real mix calculated when grams are corrected', () => {
    const part = { materialId: 'g', pct: 75, calcG: 100, factG: 100 }
    const h = { mix: { water: part, plaster: part, plasticizer: part, defoamer: part, dye: part, density: 1.5, comment: 'c' }, varnishIn: { layers: 5 } } as unknown as Holder
    const f = holderToForm(h)
    expect(f.varnishInLayers).toBe(5)
    const r = formToHolder({ ...f, grams: { ...f.grams, plaster: 90 } }, 1.82, h)
    expect(r.mix!.plaster).toEqual({ materialId: 'g', pct: 75, calcG: 100, factG: 90 })
    expect(r.mix!.density).toBe(1.5)
  })
})

describe('candle form', () => {
  it('makes no pour until something about the wax is known', () => {
    expect(formToPour(emptyCandleForm())).toBeUndefined()
    expect(formToPour({ ...emptyCandleForm(), fragranceId: 'f', fragrancePct: 7 })).toMatchObject({ fragrance: { materialId: 'f', pct: 7 } })
  })
  it('keeps the amounts of a real pour', () => {
    const pour = { id: 'W-1', candleIds: ['S-1', 'S-2'], waxes: [{ share: 100 }], lossPct: 3, fragrance: { pct: 7 }, dye: { pct: 0 }, tempMoldC: 'none', calc: { totalG: 9, waxG: 8, fragranceG: 1, dyeG: 0 }, fact: { waxG: [8], fragranceG: 1, dyeG: 0 }, comment: '' } as unknown as Pour
    const c = { name: 'a', wick: { scheme: 'double05', lengthCm: 10 }, decor: [{ decorId: 'D-1', qty: 2, dyed: true }] } as unknown as Candle
    const f = candleToForm(c, pour)
    expect(f.noHeat).toBe(true)
    expect(formToDecor(f)).toEqual([{ decorId: 'D-1', materialId: undefined, qty: 2, dyed: true }])
    expect(formToPour(f, pour)).toMatchObject({ lossPct: 3, fact: { waxG: [8] }, tempMoldC: 'none' })
  })
})

describe('adding and editing', () => {
  const mold = (name: string, purpose: 'holder' | 'candle') => actions.upsertMold({ name, purpose, copies: 1, waterVolumeMl: 100, waterPct: 25, waxCapacityG: 50, fragrancePct: 7, comment: '' })
  const base = reducer(reducer(initialData, mold('Книжка', 'holder')), mold('Шар', 'candle'))
  const pour = formToPour({ ...emptyCandleForm(), fragranceId: 'f' })
  const add = (given?: { burnedBySelf: boolean; givenAt: string }) =>
    reducer(base, actions.addReadyCandles({ items: [{ moldId: 'M-001', count: 1 }, { moldId: 'M-002', count: 1 }], date, name: '', decor: [], pour, holder: { comment: 'гипс' }, given }))

  it('puts a batch into one pour and passes details to its holders, taking no stock', () => {
    const s = add()
    expect(s.pours['W-0001'].candleIds).toEqual(['S-0001', 'S-0002'])
    expect(s.candles['S-0002'].pourId).toBe('W-0001')
    expect(s.holders['P-0001'].comment).toBe('гипс')
    expect(s.materials).toEqual(base.materials)
  })
  it('a ready candle that was already given goes back to ready', () => {
    const s = add({ burnedBySelf: true, givenAt: date })
    expect(s.candles['S-0001']).toMatchObject({ stage: 'given', burnedBySelf: true, givenAt: date })
    expect(reducer(s, actions.undoCandle({ id: 'S-0001', date })).candles['S-0001'].stage).toBe('ready')
  })
  it('editing changes the record, not the stage or stock', () => {
    const s = add()
    const e = reducer(s, actions.editCandle({ id: 'S-0001', details: { name: 'Новая' }, pour: { ...pour!, comment: 'x' } }))
    expect(e.candles['S-0001']).toMatchObject({ name: 'Новая', stage: 'ready' })
    expect(e.pours['W-0001'].comment).toBe('x')
    expect(e.pours['W-0001'].candleIds).toHaveLength(2)
    expect(e.materials).toBe(s.materials)
    const h = reducer(s, actions.editHolder({ id: 'P-0001', details: { comment: 'y' } }))
    expect(h.holders['P-0001']).toMatchObject({ comment: 'y', stage: 'candle' })
  })
  it('a ready candle with no pour gets one when the wax becomes known', () => {
    const s = reducer(base, actions.addReadyCandles({ items: [{ moldId: 'M-002', count: 1 }], date, name: '', decor: [], holder: {} }))
    const e = reducer(s, actions.editCandle({ id: 'S-0001', details: {}, pour }))
    expect(e.candles['S-0001'].pourId).toBe('W-0001')
    expect(e.pours['W-0001'].candleIds).toEqual(['S-0001'])
  })
})
