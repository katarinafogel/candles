import { describe, expect, it } from 'vitest'
import reducer, { actions, initialData } from '../../store/dataSlice'
import { sortMolds } from '../selectors'

const mold = (name: string, rating?: number) =>
  actions.upsertMold({ name, rating, purpose: 'holder', copies: 1, waterVolumeMl: 100, waterPct: 25, waxCapacityG: 50, fragrancePct: 7, comment: '' })

describe('sortMolds', () => {
  it('puts more stars first, then the most used, then by name', () => {
    let s = initialData
    for (const a of [mold('Вишня'), mold('Абрикос'), mold('Кит', 3), mold('Шкатулка', 5), mold('Книжка', 3)]) s = reducer(s, a)
    // «Книжка» (M-005) was cast twice, «Абрикос» (M-002) once.
    const part = { pct: 0, calcG: 0, factG: 0 }
    const mix = { plaster: part, water: part, plasticizer: part, defoamer: part, dye: part, density: 1.82, comment: '' }
    s = reducer(s, actions.createMix({ date: '2026-10-25T10:00:00.000Z', moldIds: ['M-005', 'M-005', 'M-002'], mix }))
    expect(sortMolds(s, Object.values(s.molds)).map((m) => m.name)).toEqual(['Шкатулка', 'Книжка', 'Кит', 'Абрикос', 'Вишня'])
  })
})

describe('lowMaterials', () => {
  it('lists only materials marked to buy that ran out or are below threshold', async () => {
    const { lowMaterials } = await import('../selectors')
    let s = initialData
    const add = (id: string, toBuy: boolean, qty: number) =>
      (s = reducer(s, actions.upsertMaterial({ id, category: 'fragrance', name: id, maker: '', unit: 'g', review: '', toBuy, initialQty: qty })))
    add('liked-empty', true, 0)
    add('liked-full', true, 500)
    add('disliked-empty', false, 0)
    expect(lowMaterials(s).map((m) => m.id)).toEqual(['liked-empty'])
  })
})
