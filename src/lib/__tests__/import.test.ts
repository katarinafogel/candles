import { describe, expect, it } from 'vitest'
import reducer, { actions, initialData } from '../../store/dataSlice'
import { applyCandleRows, matchCandles, parseCandles, parseFragrances, parseMolds } from '../importSheets'

const forms = `Название,Крышка,Копии,Объём (вода),% воды,% красителя,% пластификатора,Гипс,Пеногаситель
Книжка,FALSE,1,250,35,5,1,"295,75","0,3"
Шкатулка с цветочной крышкой,TRUE,2,"180,5",25,5,1,1,1
Кит,FALSE,1,120,25,5,1,1,"0,08"
,,,,,,,,
Краситель:,,,,,,,,
Текущая заливка:,,,,,,,,
`
const candles = `Название,Фитиль (см),Ёмкость (г),% отдушки,Фитиль,Кол-во фит,Комментарий
Книжка,12,120,7,ЭКО-6,2,
Шкатулка с цветами,10,"90",7,,,"на полуторном горит 16 ч, сильно греется"
`
const frags = `,Название,Прозводитель,Сезон,Ноты,Оценка,Наличие,Купить еще,Отзывы
1,Тыквенные специи,Indiana Candle Supplies,"Зима, Осень","Пряный, Гурманский, Сладкий",★★★★★,TRUE,FALSE,Пахнет за версту
16,Вишневый нуар,SCENT MEMORY,Универсальный,"Ягодный/Фруктовый, Пряный",★★★★☆,FALSE,TRUE,
129,,,,,☆☆☆☆☆,TRUE,FALSE,
`

describe('sheet import', () => {
  it('reads molds, skipping service rows, with decimal commas and TRUE/FALSE', () => {
    const m = parseMolds(forms, initialData, 7)
    expect(m.map((x) => x.name)).toEqual(['Книжка', 'Шкатулка с цветочной крышкой', 'Кит'])
    expect(m[1]).toMatchObject({ hasLid: true, copies: 2, waterVolumeMl: 180.5, waterPct: 25, purpose: 'holder' })
  })
  it('matches «Свечи» by name and leaves mismatches for manual mapping', () => {
    const m = parseMolds(forms, initialData, 7)
    const rows = matchCandles(m, parseCandles(candles))
    expect(rows.map((r) => r.moldIndex)).toEqual([0, null])
    rows[1].moldIndex = 1
    const out = applyCandleRows(m, rows)
    expect(out[0].defaultWick).toEqual({ scheme: 'double05', lengthCm: 12 })
    expect(out[1]).toMatchObject({ waxCapacityG: 90, comment: 'на полуторном горит 16 ч, сильно греется' })
  })
  it('reads fragrances: stock 10 g if in stock, «Купить еще», notes with a slash', () => {
    const f = parseFragrances(frags, initialData)
    expect(f).toHaveLength(2)
    expect(f[0]).toMatchObject({ isNew: true, stockG: 10 })
    expect(f[0].material).toMatchObject({ name: 'Тыквенные специи', maker: 'Indiana Candle Supplies', seasons: ['зима', 'осень'], rating: 5, review: 'Пахнет за версту' })
    expect(f[0].material.toBuy).toBeUndefined()
    expect(f[1]).toMatchObject({ stockG: 0 })
    expect(f[1].material).toMatchObject({ notes: ['ягодный/фруктовый', 'пряный'], rating: 4, toBuy: true })
  })
  it('re-import updates the same fragrance and sets its stock by inventory', () => {
    let s = initialData
    for (const r of parseFragrances(frags, s)) {
      s = reducer(s, actions.upsertMaterial(r.material))
      s = reducer(s, actions.inventory({ materialId: r.material.id, date: '2026-10-26T10:00:00.000Z', actual: r.stockG! }))
    }
    const again = parseFragrances(frags.replace('TRUE,FALSE,Пахнет', 'FALSE,FALSE,Пахнет'), s)
    expect(again[0]).toMatchObject({ isNew: false, stockG: 0 })
    s = reducer(s, actions.inventory({ materialId: again[0].material.id, date: '2026-10-26T11:00:00.000Z', actual: 0 }))
    const m = s.materials[again[0].material.id]
    expect(m.movements.reduce((a, x) => a + x.qty, 0)).toBe(0)
    expect(Object.keys(s.materials)).toHaveLength(2)
  })
})
