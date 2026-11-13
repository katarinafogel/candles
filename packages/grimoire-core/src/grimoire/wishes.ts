// The chest's search, filters and order: one pure function, so the page and the tests agree.
import { daysBetween } from './days.ts'
import { priorities } from './selectors.ts'
import type { DayKey, Wish } from './types.ts'

/** «Актуально до»: any, has one, within 30 days, already past, none. */
export type WishDeadline = 'has' | 'soon' | 'overdue' | 'none'
export type WishSort = 'priority' | 'deadline' | 'age' | 'priceAsc' | 'priceDesc'

export interface WishFilter {
  q?: string
  /** Any of these tags. */
  tags?: string[]
  deadline?: WishDeadline
  priceFrom?: number
  priceTo?: number
  sort?: WishSort
}

export const wishSorts: { value: WishSort; label: string }[] = [
  { value: 'priority', label: 'по приоритету' },
  { value: 'deadline', label: 'по дедлайну' },
  { value: 'age', label: 'давние сверху' },
  { value: 'priceAsc', label: 'дешёвые сверху' },
  { value: 'priceDesc', label: 'дорогие сверху' },
]

export const wishDeadlines: { value: WishDeadline; label: string }[] = [
  { value: 'has', label: 'с дедлайном' },
  { value: 'soon', label: 'в ближайшие 30 дней' },
  { value: 'overdue', label: 'просрочен' },
  { value: 'none', label: 'без дедлайна' },
]

/** True when the filter narrows anything (the order alone doesn't). */
export const isFiltering = (f: WishFilter) => !!(f.q?.trim() || f.tags?.length || f.deadline || f.priceFrom != null || f.priceTo != null)

function fitsDeadline(w: Wish, d: WishDeadline | undefined, today: DayKey) {
  if (!d) return true
  if (d === 'none') return !w.relevantUntil
  if (!w.relevantUntil) return false
  const left = daysBetween(today, w.relevantUntil)
  if (d === 'soon') return left >= 0 && left <= 30
  if (d === 'overdue') return left < 0
  return true
}

/** The wishes that fit, in the chosen order. A price range hides wishes without a price. */
export function filterWishes(list: Wish[], f: WishFilter, today: DayKey): Wish[] {
  const q = f.q?.trim().toLowerCase()
  const rank = (w: Wish) => priorities.indexOf(w.priority ?? 'medium')
  const newest = (a: Wish, b: Wish) => b.createdAt.localeCompare(a.createdAt)
  const out = list.filter(
    (w) =>
      (!q || `${w.title} ${w.description ?? ''}`.toLowerCase().includes(q)) &&
      (!f.tags?.length || w.tags.some((t) => f.tags!.includes(t))) &&
      fitsDeadline(w, f.deadline, today) &&
      (f.priceFrom == null || (w.price != null && w.price >= f.priceFrom)) &&
      (f.priceTo == null || (w.price != null && w.price <= f.priceTo)),
  )
  const sort = f.sort ?? 'priority'
  // Wishes without the value being sorted on go last, in the usual order.
  const last = (v: unknown) => (v == null ? 1 : 0)
  return out.sort((a, b) => {
    switch (sort) {
      case 'deadline':
        return last(a.relevantUntil) - last(b.relevantUntil) || (a.relevantUntil ?? '').localeCompare(b.relevantUntil ?? '') || rank(a) - rank(b) || newest(a, b)
      case 'age':
        return a.createdAt.localeCompare(b.createdAt)
      case 'priceAsc':
        return last(a.price) - last(b.price) || (a.price ?? 0) - (b.price ?? 0) || newest(a, b)
      case 'priceDesc':
        return last(a.price) - last(b.price) || (b.price ?? 0) - (a.price ?? 0) || newest(a, b)
      default:
        return rank(a) - rank(b) || newest(a, b)
    }
  })
}
