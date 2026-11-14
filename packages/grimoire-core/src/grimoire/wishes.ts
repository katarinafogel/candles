// The chest's search, filters and order: one pure function, so the page and the tests agree.
import { daysBetween } from './days.ts'
import { priorities } from './selectors.ts'
import type { DayKey, Wish } from './types.ts'

/** «Актуально до»: has one or has none. Nothing chosen — both. */
export type WishDeadline = 'has' | 'none'
/** Within «с дедлайном»: how close it is. */
export type WishWithin = 'twoWeeks' | 'month' | 'overdue'
export type WishSort = 'urgent' | 'later' | 'priorityHigh' | 'priorityLow' | 'old' | 'new' | 'priceAsc' | 'priceDesc'

export interface WishFilter {
  q?: string
  /** Any of these tags. */
  tags?: string[]
  deadline?: WishDeadline
  /** Counts only with `deadline: 'has'`. */
  within?: WishWithin
  priceFrom?: number
  priceTo?: number
  sort?: WishSort
}

export const defaultWishSort: WishSort = 'priorityHigh'

export const wishSorts: { value: WishSort; label: string }[] = [
  { value: 'priorityHigh', label: 'высокий приоритет' },
  { value: 'priorityLow', label: 'низкий приоритет' },
  { value: 'urgent', label: 'срочные сверху' },
  { value: 'later', label: 'несрочные сверху' },
  { value: 'old', label: 'давние сверху' },
  { value: 'new', label: 'новые сверху' },
  { value: 'priceAsc', label: 'дешёвые сверху' },
  { value: 'priceDesc', label: 'дорогие сверху' },
]

export const wishDeadlines: { value: WishDeadline; label: string }[] = [
  { value: 'has', label: 'с дедлайном' },
  { value: 'none', label: 'без дедлайна' },
]

export const wishWithins: { value: WishWithin; label: string }[] = [
  { value: 'twoWeeks', label: 'ближайшие 2 недели' },
  { value: 'month', label: 'ближайший месяц' },
  { value: 'overdue', label: 'просрочен' },
]

/** True when the filter narrows anything (the order alone doesn't). */
export const isFiltering = (f: WishFilter) => !!(f.q?.trim() || f.tags?.length || f.deadline || f.priceFrom != null || f.priceTo != null)

function fitsDeadline(w: Wish, f: WishFilter, today: DayKey) {
  if (!f.deadline) return true
  if (f.deadline === 'none') return !w.relevantUntil
  if (!w.relevantUntil) return false
  const left = daysBetween(today, w.relevantUntil)
  if (f.within === 'twoWeeks') return left >= 0 && left <= 14
  if (f.within === 'month') return left >= 0 && left <= 31
  if (f.within === 'overdue') return left < 0
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
      fitsDeadline(w, f, today) &&
      (f.priceFrom == null || (w.price != null && w.price >= f.priceFrom)) &&
      (f.priceTo == null || (w.price != null && w.price <= f.priceTo)),
  )
  const sort = f.sort ?? defaultWishSort
  // Wishes without the value being sorted on go last, in the usual order.
  const last = (v: unknown) => (v == null ? 1 : 0)
  return out.sort((a, b) => {
    switch (sort) {
      case 'urgent':
        return last(a.relevantUntil) - last(b.relevantUntil) || (a.relevantUntil ?? '').localeCompare(b.relevantUntil ?? '') || rank(a) - rank(b) || newest(a, b)
      case 'later':
        return last(a.relevantUntil) - last(b.relevantUntil) || (b.relevantUntil ?? '').localeCompare(a.relevantUntil ?? '') || rank(a) - rank(b) || newest(a, b)
      case 'old':
        return a.createdAt.localeCompare(b.createdAt)
      case 'new':
        return newest(a, b)
      case 'priceAsc':
        return last(a.price) - last(b.price) || (a.price ?? 0) - (b.price ?? 0) || newest(a, b)
      case 'priceDesc':
        return last(a.price) - last(b.price) || (b.price ?? 0) - (a.price ?? 0) || newest(a, b)
      case 'priorityLow':
        return rank(b) - rank(a) || newest(a, b)
      default:
        return rank(a) - rank(b) || newest(a, b)
    }
  })
}
