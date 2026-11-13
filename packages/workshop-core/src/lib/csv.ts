// Import of the Google Sheets tabs «Формы», «Свечи», «Отдушки» exported as CSV (spec 8.2).
import { parseNum } from './calc'

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  const delim = detectDelimiter(text)
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else q = false
      } else cell += ch
    } else if (ch === '"') q = true
    else if (ch === delim) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

function detectDelimiter(text: string) {
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const count = (c: string) => first.split(c).length
  return count(';') > count(',') ? ';' : count('\t') > count(',') ? '\t' : ','
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9%]+/g, ' ').trim()

/** Rows as objects keyed by header; `pick` finds a column by any of several header spellings. */
export function table(text: string) {
  const [head = [], ...rows] = parseCsv(text)
  const headers = head.map(norm)
  const col = (...names: string[]) => {
    for (const n of names.map(norm)) {
      const exact = headers.indexOf(n)
      if (exact >= 0) return exact
    }
    for (const n of names.map(norm)) {
      const i = headers.findIndex((h) => h.startsWith(n) || h.includes(n))
      if (i >= 0) return i
    }
    return -1
  }
  return { headers: head, rows, col }
}

export const bool = (v?: string) => /^(true|да|1|yes|истина)$/i.test((v ?? '').trim())
export const num = (v?: string) => parseNum(v ?? '')
export const sameName = (a: string, b: string) => norm(a) === norm(b)
export const splitList = (v?: string) =>
  (v ?? '')
    .split(/[,;/]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)

/** Service rows at the bottom of «Формы» like «Краситель:» or «Текущая заливка:». */
export const isServiceRow = (name: string) => !name.trim() || /:\s*$/.test(name.trim())

export function stars(v?: string) {
  if (!v) return undefined
  const n = num(v)
  if (n != null) return Math.max(1, Math.min(5, Math.round(n)))
  const s = (v.match(/[★⭐*]/g) ?? []).length
  return s ? Math.min(5, s) : undefined
}
