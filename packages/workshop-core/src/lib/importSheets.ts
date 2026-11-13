// One-off import of the old Google Sheets tabs (spec 8.2).
import { nanoid } from '@reduxjs/toolkit'
import type { DataState, Material, Mold } from '../types'
import { bool, isServiceRow, num, sameName, stars, table } from './csv'

export type MoldDraft = Omit<Mold, 'id'> & { id?: string }

export interface CandleRow {
  name: string
  wickCm?: number
  capacityG?: number
  fragrancePct?: number
  comment: string
}

export interface ImportPlan {
  molds: MoldDraft[]
  candleRows: { row: CandleRow; moldIndex: number | null }[]
  fragrances: FragranceRow[]
}

export function parseMolds(text: string, d: DataState, fragrancePct: number): MoldDraft[] {
  const t = table(text)
  const c = {
    name: t.col('Название', 'Форма'),
    lid: t.col('Крышка'),
    copies: t.col('Копии', 'Кол-во копий', 'Количество'),
    volume: t.col('Объём (вода)', 'Объем (вода)', 'Объём', 'Объем'),
    water: t.col('% воды', 'Вода %'),
    dye: t.col('% красителя'),
    plasticizer: t.col('% пластификатора'),
  }
  const out: MoldDraft[] = []
  for (const r of t.rows) {
    const name = (r[c.name] ?? '').trim()
    // Service rows at the bottom ("Краситель:", "Текущая заливка:") and calculated grams are skipped.
    if (isServiceRow(name)) continue
    const existing = Object.values(d.molds).find((m) => sameName(m.name, name))
    const waterPct = num(r[c.water])
    out.push({
      ...(existing ?? {
        purpose: guessPurpose(name, c.lid >= 0 ? bool(r[c.lid]) : undefined),
        waxCapacityG: 0,
        fragrancePct,
        comment: '',
      }),
      id: existing?.id,
      name,
      copies: Math.max(1, Math.round(num(r[c.copies]) ?? existing?.copies ?? 1)),
      waterVolumeMl: num(r[c.volume]) ?? existing?.waterVolumeMl ?? 0,
      // A share like 0,35 is read as 35%.
      waterPct: waterPct != null ? (waterPct <= 1 ? waterPct * 100 : waterPct) : existing?.waterPct ?? 25,
      dyePct: num(r[c.dye]),
      plasticizerPct: num(r[c.plasticizer]),
    } as MoldDraft)
  }
  return out
}

/**
 * Type of a new plaster mold: dishes go by name; a mold without a lid cannot hold a candle
 * (the scent would fade), so it is a figurine.
 */
function guessPurpose(name: string, hasLid: boolean | undefined): Mold['purpose'] {
  if (/тарел|миск|блюд|поднос/i.test(name)) return 'dish'
  return hasLid === false ? 'figurine' : 'holder'
}

export function parseCandles(text: string): CandleRow[] {
  const t = table(text)
  const c = {
    name: t.col('Название', 'Форма', 'Свеча'),
    wick: t.col('Фитиль (см)', 'Фитиль, см'),
    cap: t.col('Ёмкость (г)', 'Емкость (г)', 'Ёмкость', 'Емкость'),
    frag: t.col('% отдушки', 'Отдушка %'),
    comment: t.col('Комментарий', 'Комментарии'),
  }
  return t.rows
    .map((r) => ({
      name: (r[c.name] ?? '').trim(),
      wickCm: num(r[c.wick]),
      capacityG: num(r[c.cap]),
      fragrancePct: num(r[c.frag]),
      comment: (r[c.comment] ?? '').trim(),
    }))
    .filter((r) => !isServiceRow(r.name))
}

/** A fragrance in the sheet: «Наличие» TRUE means 10 g on the shelf, «Купить еще» marks it to be bought. */
export const FRAGRANCE_IN_STOCK_G = 10

export interface FragranceRow {
  material: Omit<Material, 'movements'>
  isNew: boolean
  /** Stock to set by inventory; undefined when the sheet has no «Наличие» column. */
  stockG?: number
}

export function parseFragrances(text: string, d: DataState): FragranceRow[] {
  const t = table(text)
  const c = {
    name: t.col('Название'),
    maker: t.col('Производитель', 'Прозводитель', 'Бренд'),
    season: t.col('Сезон', 'Сезоны'),
    notes: t.col('Ноты'),
    rating: t.col('Оценка'),
    stock: t.col('Наличие', 'В наличии'),
    toBuy: t.col('Купить еще', 'Купить ещё', 'Купить', 'Докупить'),
    review: t.col('Отзывы', 'Отзыв'),
  }
  // Notes like «Ягодный/Фруктовый» are one note, so only commas and semicolons separate them.
  const list = (v?: string) =>
    (v ?? '')
      .split(/[,;]+/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
  return t.rows
    .filter((r) => (r[c.name] ?? '').trim())
    .map((r) => {
      const name = r[c.name].trim()
      const existing = Object.values(d.materials).find((m) => m.category === 'fragrance' && sameName(m.name, name))
      const { movements, ...prev } = existing ?? ({} as Partial<Material>)
      void movements
      const review = (r[c.review] ?? '').trim()
      return {
        isNew: !existing,
        stockG: c.stock >= 0 ? (bool(r[c.stock]) ? FRAGRANCE_IN_STOCK_G : 0) : undefined,
        material: {
          ...prev,
          id: existing?.id ?? nanoid(8),
          category: 'fragrance' as const,
          name,
          maker: (r[c.maker] ?? '').trim() || prev.maker || '',
          unit: 'g' as const,
          seasons: list(r[c.season]),
          notes: list(r[c.notes]),
          rating: stars(r[c.rating]),
          review: review || prev.review || '',
          toBuy: c.toBuy >= 0 ? bool(r[c.toBuy]) || undefined : prev.toBuy,
        },
      }
    })
}

/** Joins «Свечи» rows to molds by name; unmatched rows are left for manual mapping. */
export function matchCandles(molds: MoldDraft[], rows: CandleRow[]): ImportPlan['candleRows'] {
  return rows.map((row) => {
    const i = molds.findIndex((m) => sameName(m.name, row.name))
    return { row, moldIndex: i >= 0 ? i : null }
  })
}

export function applyCandleRows(molds: MoldDraft[], rows: ImportPlan['candleRows']): MoldDraft[] {
  const out = molds.map((m) => ({ ...m }))
  for (const { row, moldIndex } of rows) {
    if (moldIndex == null || !out[moldIndex]) continue
    const m = out[moldIndex]
    if (row.wickCm != null) m.defaultWick = { scheme: m.defaultWick?.scheme ?? 'double05', lengthCm: row.wickCm }
    if (row.capacityG != null) m.waxCapacityG = row.capacityG
    if (row.fragrancePct != null) m.fragrancePct = row.fragrancePct
    if (row.comment) m.comment = m.comment ? `${m.comment}\n${row.comment}` : row.comment
  }
  return out
}
