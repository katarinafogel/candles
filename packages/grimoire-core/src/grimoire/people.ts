// The bestiary's arithmetic: the next birthday and other dates, live scars, and the balance of the
// last twelve months — what she did for a person, what they did for her, where they hurt her.
import { addDays, daysBetween } from './days.ts'
import type { DayKey, GrimoireState, PersonLine, PersonNotes } from './types.ts'

const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

/** The next day (today included) a yearly «MM-DD» or «YYYY-MM-DD» falls on; 29 February → 28th in other years. */
export function nextOccurrence(date: string, today: DayKey): DayKey {
  const md = date.length > 5 ? date.slice(5) : date
  const y = +today.slice(0, 4)
  const on = (year: number) => (md === '02-29' && !leap(year) ? `${year}-02-28` : `${year}-${md}`)
  return on(y) >= today ? on(y) : on(y + 1)
}

export interface PersonDate {
  personId: string
  label: string
  day: DayKey
  inDays: number
  /** How old they turn, when the birth year is known. */
  age?: number
}

/** Birthdays and other dates within `within` days, nearest first. */
export function upcomingDates(notes: Record<string, PersonNotes>, today: DayKey, within = 14): PersonDate[] {
  const out: PersonDate[] = []
  for (const n of Object.values(notes)) {
    const all = [...(n.birthday ? [{ label: 'день рождения', date: n.birthday }] : []), ...(n.dates ?? [])]
    for (const d of all) {
      if (!/^(\d{4}-)?\d{2}-\d{2}$/.test(d.date)) continue
      const day = nextOccurrence(d.date, today)
      const inDays = daysBetween(today, day)
      if (inDays > within) continue
      const age = d.label === 'день рождения' && d.date.length > 5 ? +day.slice(0, 4) - +d.date.slice(0, 4) : undefined
      out.push({ personId: n.id, label: d.label, day, inDays, age })
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays)
}

/** Scars not let go, newest first: the ones a deed for this person quietly reminds of. */
export const liveScars = (n?: PersonNotes): PersonLine[] => (n?.scars ?? []).filter((x) => !x.released).sort((a, b) => b.day.localeCompare(a.day))

/** The last twelve months: done deeds tied to the person, their kindnesses, their scars. */
export function personBalance(g: Pick<GrimoireState, 'tasks' | 'personNotes'>, personId: string, today: DayKey) {
  const from = addDays(today, -365)
  const n = g.personNotes[personId]
  const inYear = (xs?: PersonLine[]) => (xs ?? []).filter((x) => x.day >= from).length
  return {
    forThem: Object.values(g.tasks).filter((t) => t.status === 'done' && t.personIds?.includes(personId) && (t.doneDay ?? '') >= from).length,
    kindness: inYear(n?.kindness),
    scars: inYear(n?.scars),
  }
}

/** «12 марта», for a scar's warning. */
export const monthDay = (day: DayKey) => new Date(`${day}T12:00:00`).toLocaleDateString('ru', { day: 'numeric', month: 'long' })
