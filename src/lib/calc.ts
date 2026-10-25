// Calculations from spec section 5.
import type { Consumption, DataState, Material, Movement } from '../types'

export const round2 = (n: number) => Math.round(n * 100) / 100

export interface PlasterCalc {
  totalG: number
  waterG: number
  plasterG: number
  plasticizerG: number
  dyeG: number
  defoamerG: number
}

/** M = ΣV × density; water = M × water%; plaster = M − water; additives are % of plaster. */
export function calcPlaster(
  volumeMl: number,
  p: { density: number; waterPct: number; plasticizerPct: number; dyePct: number; defoamerPct: number },
): PlasterCalc {
  const totalG = volumeMl * p.density
  const waterG = (totalG * p.waterPct) / 100
  const plasterG = totalG - waterG
  return {
    totalG: round2(totalG),
    waterG: round2(waterG),
    plasterG: round2(plasterG),
    plasticizerG: round2((plasterG * p.plasticizerPct) / 100),
    dyeG: round2((plasterG * p.dyePct) / 100),
    defoamerG: round2((plasterG * p.defoamerPct) / 100),
  }
}

export interface WaxCalc {
  totalG: number
  waxG: number
  waxByPart: number[]
  fragranceG: number
  dyeG: number
}

/** Total = Σcapacity × (1 + loss); fragrance = total × %; wax = total − fragrance; dye = wax × %. */
export function calcWax(
  capacityG: number,
  p: { lossPct: number; fragrancePct: number; dyePct: number; shares: number[] },
): WaxCalc {
  const totalG = capacityG * (1 + p.lossPct / 100)
  const fragranceG = (totalG * p.fragrancePct) / 100
  const waxG = totalG - fragranceG
  const shareSum = p.shares.reduce((a, b) => a + b, 0) || 1
  return {
    totalG: round2(totalG),
    waxG: round2(waxG),
    waxByPart: p.shares.map((s) => round2((waxG * s) / shareSum)),
    fragranceG: round2(fragranceG),
    dyeG: round2((waxG * p.dyePct) / 100),
  }
}

export const stockOf = (m: Material) => round2(m.movements.reduce((a, mv) => a + mv.qty, 0))

/** Uses of a material grouped by event, newest last. */
function useEvents(m: Material): number[] {
  const byEvent = new Map<string, { date: string; qty: number }>()
  for (const mv of m.movements) {
    if (mv.kind !== 'use' && mv.kind !== 'return') continue
    const key = mv.eventId ?? mv.id
    const e = byEvent.get(key) ?? { date: mv.date, qty: 0 }
    e.qty += -mv.qty
    byEvent.set(key, e)
  }
  return [...byEvent.values()]
    .filter((e) => e.qty > 0.0001)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => e.qty)
}

/** Average use over the last 5 events × 3; fallback is the per-event use for the most used mold. */
export function thresholdOf(m: Material, fallback?: number): number | undefined {
  if (m.thresholdOverride != null) return m.thresholdOverride
  const ev = useEvents(m).slice(-5)
  if (ev.length) return round2((ev.reduce((a, b) => a + b, 0) / ev.length) * 3)
  return fallback != null ? round2(fallback * 3) : undefined
}

export function avgUse(m: Material): number | undefined {
  const ev = useEvents(m).slice(-5)
  return ev.length ? ev.reduce((a, b) => a + b, 0) / ev.length : undefined
}

export function isLow(m: Material, fallback?: number) {
  const t = thresholdOf(m, fallback)
  return t != null && stockOf(m) < t
}

/** Weighted average unit price over purchases with a price. */
export function unitPrice(m: Material): number | undefined {
  let qty = 0
  let sum = 0
  for (const mv of m.movements as Movement[]) {
    if (mv.kind === 'purchase' && mv.price != null && mv.qty > 0) {
      qty += mv.qty
      sum += mv.price
    }
  }
  return qty ? sum / qty : undefined
}

export interface Cost {
  total: number
  complete: boolean
}

export function costOf(data: DataState, items: Consumption[]): Cost {
  let total = 0
  let complete = true
  for (const c of items) {
    if (c.materialId) {
      const m = data.materials[c.materialId]
      const p = m && unitPrice(m)
      if (p == null) complete = false
      else total += p * c.qty
    } else if (c.decorId) {
      const d = data.decor[c.decorId]
      if (!d || !d.qty) {
        complete = false
        continue
      }
      const batch = costOf(data, d.consumption)
      if (!batch.complete || !d.consumption.length) complete = false
      total += (batch.total / d.qty) * c.qty
    }
  }
  return { total: round2(total), complete }
}

export function candleCost(data: DataState, candleId: string): Cost {
  const c = data.candles[candleId]
  if (!c) return { total: 0, complete: false }
  const items: Consumption[] = c.history.flatMap((h) => h.consumption)
  const h = c.holderId ? data.holders[c.holderId] : undefined
  if (h) items.push(...h.history.flatMap((e) => e.consumption))
  return costOf(data, items)
}

/** Parses "27,3" as well as "27.3". */
export function parseNum(v: string | number | undefined | null): number | undefined {
  if (v == null) return undefined
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  const s = v.replace(/\s/g, '').replace(',', '.').replace('%', '')
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

export const fmt = (n: number | undefined, digits = 2) =>
  n == null ? '—' : n.toLocaleString('ru-RU', { maximumFractionDigits: digits })

export const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('ru-RU') : '—')
export const fmtDateTime = (d?: string) =>
  d ? new Date(d).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export function daysBetween(a?: string, b?: string) {
  if (!a || !b) return undefined
  return round2((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}
