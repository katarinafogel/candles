import { describe, expect, it } from 'vitest'
import { initialData } from '../../store/dataSlice'
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
const frags = `Название,Производитель,Сезон,Ноты,Оценка,Наличие,Отзывы
Сандал,Аромат-М,"осень, зима","древесные, пряные",★★★★,TRUE,Держит аромат
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
  it('reads fragrances with seasons, notes and stars', () => {
    const f = parseFragrances(frags, initialData)
    expect(f[0]).toMatchObject({ name: 'Сандал', maker: 'Аромат-М', seasons: ['осень', 'зима'], notes: ['древесные', 'пряные'], rating: 4 })
  })
})
