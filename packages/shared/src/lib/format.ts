// Numbers and dates the Russian way — shared by every app.

export const round2 = (n: number) => Math.round(n * 100) / 100

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
