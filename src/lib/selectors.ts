import type { Candle, DataState, Holder, Material, MaterialCategory, Mold, Review } from '../types'
import { calcPlaster, calcWax, isLow, stockOf } from './calc'

export const byId = <T extends { id: string }>(r: Record<string, T>) =>
  Object.values(r).sort((a, b) => b.id.localeCompare(a.id, 'ru', { numeric: true }))

export const moldOfCandle = (d: DataState, c: Candle): Mold | undefined => {
  const mid = c.holderId ? d.holders[c.holderId]?.moldId : c.moldId
  return mid ? d.molds[mid] : undefined
}

export const capacityOf = (d: DataState, c: Candle) => moldOfCandle(d, c)?.waxCapacityG ?? 0

export const reviewsOf = (d: DataState, candleId: string): Review[] =>
  Object.values(d.reviews)
    .filter((r) => r.candleId === candleId)
    .sort((a, b) => b.date.localeCompare(a.date))

export const avg = (xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => x != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined
}

export const candleRating = (d: DataState, candleId: string) => {
  const rs = reviewsOf(d, candleId)
  // The latest review of a candle wins over intermediate ones.
  return rs[0]?.overall
}

export const sootShare = (d: DataState, candleId: string) => {
  const rs = reviewsOf(d, candleId)
  if (!rs.length) return undefined
  return rs.filter((r) => r.soot && r.soot !== 'no').length / rs.length
}

export function moldStats(d: DataState, moldId: string) {
  const holders = Object.values(d.holders).filter((h) => h.moldId === moldId)
  const candles = Object.values(d.candles).filter((c) => (c.holderId ? d.holders[c.holderId]?.moldId === moldId : c.moldId === moldId))
  const defects = holders.filter((h) => h.stage === 'defect').length + candles.filter((c) => c.stage === 'defect').length
  const total = holders.length + candles.filter((c) => !c.holderId).length
  return {
    holders,
    candles,
    defectPct: total ? (defects / total) * 100 : undefined,
    avgOverall: avg(candles.map((c) => candleRating(d, c.id))),
    avgDesign: avg(candles.map((c) => reviewsOf(d, c.id)[0]?.design)),
  }
}

const plasterCats: MaterialCategory[] = ['plaster', 'plasticizer', 'defoamer', 'plasterDye']
const waxCats: MaterialCategory[] = ['wax', 'fragrance', 'waxDye']

/** Spec 5.4: with no history yet, the threshold is based on the use for the most used mold. */
export function fallbackUse(d: DataState, m: Material): number | undefined {
  const counts = new Map<string, number>()
  for (const h of Object.values(d.holders)) counts.set(h.moldId, (counts.get(h.moldId) ?? 0) + 1)
  const molds = Object.values(d.molds).filter((x) => !x.archived)
  const top =
    [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => d.molds[id])[0] ??
    molds.find((x) => x.purpose === 'holder') ??
    molds[0]
  if (!top) return undefined
  const s = d.settings
  if (plasterCats.includes(m.category)) {
    const r = calcPlaster(top.waterVolumeMl, {
      density: s.plasterDensity,
      waterPct: top.waterPct,
      plasticizerPct: s.plasticizerPct,
      dyePct: s.plasterDyePct,
      defoamerPct: s.defoamerPct,
    })
    return { plaster: r.plasterG, plasticizer: r.plasticizerG, defoamer: r.defoamerG, plasterDye: r.dyeG }[
      m.category as 'plaster'
    ]
  }
  if (waxCats.includes(m.category) && top.waxCapacityG) {
    const r = calcWax(top.waxCapacityG, { lossPct: s.waxLossPct, fragrancePct: top.fragrancePct, dyePct: s.waxDyePct, shares: [100] })
    return { wax: r.waxG, fragrance: r.fragranceG, waxDye: r.dyeG }[m.category as 'wax']
  }
  if (m.category === 'varnishIn' || m.category === 'varnishOut') return s.varnishMlPerLayer * 2
  if (m.category === 'wick') return (top.defaultWick?.lengthCm ?? 10) * 2
  if (m.category === 'cork') return 3
  return undefined
}

/**
 * Running out matters only for what the master buys again: a material marked «купить»
 * that is used up or below its threshold. Tried-and-dropped materials never nag.
 */
export const needsRestock = (d: DataState, m: Material) =>
  !!m.toBuy && !m.archived && (stockOf(m) <= 0 || isLow(m, fallbackUse(d, m)))

export const lowMaterials = (d: DataState) => Object.values(d.materials).filter((m) => needsRestock(d, m))

export const materialsOf = (d: DataState, ...cats: MaterialCategory[]) =>
  Object.values(d.materials)
    .filter((m) => !m.archived && cats.includes(m.category))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

export const materialOptions = (d: DataState, ...cats: MaterialCategory[]) =>
  materialsOf(d, ...cats).map((m) => ({ value: m.id, label: `${m.name}${m.maker ? ` · ${m.maker}` : ''} (ост. ${stockOf(m)})` }))

export const holderTitle = (d: DataState, h: Holder) => `${h.id} · ${d.molds[h.moldId]?.name ?? 'форма?'}`

export const unreadReviews = (d: DataState) => Object.values(d.reviews).filter((r) => !r.read)

export const orphanReviews = (d: DataState) => Object.values(d.reviews).filter((r) => !d.candles[r.candleId])

/** How many times a mold was used: cast holders plus molded candles. */
export function moldUses(d: DataState): Map<string, number> {
  const uses = new Map<string, number>()
  const bump = (id?: string) => id && uses.set(id, (uses.get(id) ?? 0) + 1)
  for (const h of Object.values(d.holders)) bump(h.moldId)
  for (const c of Object.values(d.candles)) if (!c.holderId) bump(c.moldId)
  return uses
}

/** More stars first, then the most used, then by name. */
export function sortMolds(d: DataState, molds: Mold[]): Mold[] {
  const uses = moldUses(d)
  return [...molds].sort(
    (a, b) =>
      (b.rating ?? 0) - (a.rating ?? 0) ||
      (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) ||
      a.name.localeCompare(b.name, 'ru'),
  )
}
