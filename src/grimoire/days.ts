// Grimoire days. A day lasts until the boundary hour (4:00 by default), so a late evening still counts
// as «today». Day keys are plain YYYY-MM-DD strings; arithmetic on them goes through UTC noon so that
// daylight saving shifts never move a day.
import type { DayKey, Repeat } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

/** The grimoire day a moment belongs to, in the device's time zone. */
export function dayKey(at: Date = new Date(), boundaryHour = 4): DayKey {
  const d = new Date(at.getTime() - boundaryHour * 3600_000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const toUtc = (day: DayKey) => {
  const [y, m, d] = day.split('-').map(Number)
  return Date.UTC(y, m - 1, d, 12)
}

const fromUtc = (t: number): DayKey => {
  const d = new Date(t)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export const addDays = (day: DayKey, n: number): DayKey => fromUtc(toUtc(day) + n * 86_400_000)

/** Whole days from a to b (b − a). */
export const daysBetween = (a: DayKey, b: DayKey) => Math.round((toUtc(b) - toUtc(a)) / 86_400_000)

/** 1 = Monday … 7 = Sunday. */
export const weekday = (day: DayKey) => {
  const w = new Date(toUtc(day)).getUTCDay()
  return w === 0 ? 7 : w
}

/** Monday of the week the day is in. */
export const weekStart = (day: DayKey) => addDays(day, 1 - weekday(day))

export const isDayKey = (s: unknown): s is DayKey => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

/** The date part of a deadline («2026-11-03» or «2026-11-03T18:00»). */
export const dueDay = (dueAt?: string): DayKey | undefined => (dueAt ? dueAt.slice(0, 10) : undefined)

const weekdayShort = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
const monthsGen = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

/** «сегодня», «завтра», «до четверга»-style human day, relative to `today`. */
export function humanDay(day: DayKey, today: DayKey): string {
  const n = daysBetween(today, day)
  if (n === 0) return 'сегодня'
  if (n === 1) return 'завтра'
  if (n === -1) return 'вчера'
  if (n === 2) return 'послезавтра'
  const [, m, d] = day.split('-').map(Number)
  const date = `${d} ${monthsGen[m - 1]}`
  if (n > 2 && n < 7) return `${weekdayShort[weekday(day) - 1]}, ${date}`
  return date
}

/** «3 дня», «1 год 2 месяца 5 дней». */
export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`
  return `${n} ${many}`
}

export const days = (n: number) => plural(n, 'день', 'дня', 'дней')

/** The next day a repeating deed comes back, counted from the day it was done. */
export function nextRepeat(day: DayKey, r: Repeat): DayKey {
  switch (r.kind) {
    case 'daily':
      return addDays(day, 1)
    case 'everyN':
      return addDays(day, Math.max(1, r.n))
    case 'weekdays': {
      const set = r.days.length ? r.days : [weekday(day)]
      for (let i = 1; i <= 7; i++) if (set.includes(weekday(addDays(day, i)))) return addDays(day, i)
      return addDays(day, 7)
    }
    case 'monthly': {
      const [y, m, d] = day.split('-').map(Number)
      const ny = m === 12 ? y + 1 : y
      const nm = m === 12 ? 1 : m + 1
      // The 31st falls back to the last day of a shorter month.
      const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
      return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
    }
  }
}
