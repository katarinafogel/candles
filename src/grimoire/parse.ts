// Quick add: one line becomes a task.
//   «помыть окна **☠☠ #дом !пт»  → 2 stars, dread 2, tag «дом», deadline on Friday
//   «кино с @аня +радость»       → a joy linked to the person «Аня»
// Tokens: * stars (1–3), ☠ dread (0–3), #tag, !deadline (пн…вс, сегодня, завтра, послезавтра,
// 12.11, 12.11.2026, 2026-11-12), @person, +радость, +главное / +доп / +необяз (slot, puts it in today's
// plan), +сегодня / +завтра (the day to do it).
import { addDays, weekday } from './days.ts'
import type { DayKey, TaskSlot, TaskType } from './types.ts'

export interface ParsedTask {
  title: string
  stars: 1 | 2 | 3
  dread: 0 | 1 | 2 | 3
  tags: string[]
  dueAt?: DayKey
  doOn?: DayKey
  slot?: TaskSlot
  type: TaskType
  /** Names after @, as typed. */
  people: string[]
}

const weekdays: Record<string, number> = { пн: 1, вт: 2, ср: 3, чт: 4, пт: 5, сб: 6, вс: 7 }
const slots: Record<string, TaskSlot> = { главное: 'main', доп: 'extra', дополнительное: 'extra', необяз: 'optional', необязательное: 'optional' }

/** A day word or date relative to `today`; undefined when it is not one. */
export function parseDay(word: string, today: DayKey): DayKey | undefined {
  const w = word.toLowerCase()
  if (w === 'сегодня') return today
  if (w === 'завтра') return addDays(today, 1)
  if (w === 'послезавтра') return addDays(today, 2)
  if (w in weekdays) return addDays(today, (weekdays[w] - weekday(today) + 7) % 7)
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(w)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{2}|\d{4}))?$/.exec(w)
  if (m) {
    const [, d, mo, y] = m
    const year = y ? (y.length === 2 ? 2000 + +y : +y) : +today.slice(0, 4)
    let day = valid(year, +mo, +d)
    // «12.01» typed in December means next January.
    if (day && !y && day < today) day = valid(year + 1, +mo, +d)
    return day
  }
  return undefined
}

function valid(y: number, m: number, d: number): DayKey | undefined {
  const t = new Date(Date.UTC(y, m - 1, d))
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return undefined
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const clamp = <T extends number>(n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n)) as T

export function parseQuickAdd(line: string, today: DayKey): ParsedTask {
  const out: ParsedTask = { title: '', stars: 1, dread: 0, tags: [], type: 'deed', people: [] }
  const words: string[] = []
  let stars = 0
  let dread = 0
  // Stars and skulls may be glued together and to words: «**☠☠».
  const tokens = line.replace(/️/g, '').trim().split(/\s+/).filter(Boolean)
  for (const raw of tokens) {
    let tok = raw
    const marks = /^([*☠]+)(.*)$/.exec(tok) ?? /^(.*?)([*☠]+)$/.exec(tok)
    if (marks) {
      const sym = /^[*☠]+$/.test(marks[1]) ? marks[1] : marks[2]
      stars += [...sym].filter((c) => c === '*').length
      dread += [...sym].filter((c) => c === '☠').length
      tok = /^[*☠]+$/.test(marks[1]) ? marks[2] : marks[1]
      if (!tok) continue
    }
    if (tok.startsWith('#') && tok.length > 1) {
      const tag = tok.slice(1).toLowerCase()
      if (!out.tags.includes(tag)) out.tags.push(tag)
    } else if (tok.startsWith('!') && tok.length > 1 && parseDay(tok.slice(1), today)) {
      out.dueAt = parseDay(tok.slice(1), today)
    } else if (tok.startsWith('@') && tok.length > 1) {
      const name = tok.slice(1)
      out.people.push(name)
      words.push(name)
    } else if (tok.startsWith('+') && tok.length > 1) {
      const w = tok.slice(1).toLowerCase()
      if (w === 'радость') out.type = 'joy'
      else if (w in slots) {
        out.slot = slots[w]
        out.doOn ??= today
      } else if (parseDay(w, today)) out.doOn = parseDay(w, today)
      else words.push(tok)
    } else {
      words.push(tok)
    }
  }
  out.title = words.join(' ').trim()
  out.stars = clamp(stars || 1, 1, 3)
  out.dread = clamp(dread, 0, 3)
  return out
}
