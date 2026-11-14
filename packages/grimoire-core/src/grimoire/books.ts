// The reading shelf's filters and order: one pure function, so the page and the tests agree.
import { priorities } from './selectors.ts'
import type { Book, BookFormat, BookStatus } from './types.ts'

export type BookSort = 'queue' | 'priorityHigh' | 'priorityLow' | 'new' | 'old' | 'finished'

export interface BookFilter {
  q?: string
  /** Any of these tags. */
  tags?: string[]
  format?: BookFormat
  bought?: 'yes' | 'no'
  sort?: BookSort
}

export const bookFormats: { value: BookFormat; label: string }[] = [
  { value: 'paper', label: 'бумажная' },
  { value: 'ebook', label: 'электронная' },
  { value: 'print', label: 'распечатка' },
]

const sortLabels: Record<BookSort, string> = {
  queue: 'по очереди',
  priorityHigh: 'высокий приоритет',
  priorityLow: 'низкий приоритет',
  new: 'новые сверху',
  old: 'давние сверху',
  finished: 'по дате прочтения',
}

/** The orders a shelf offers: the queue only for «хочу прочесть», the reading date only for «прочитано». */
export function bookSorts(status: BookStatus): { value: BookSort; label: string }[] {
  const keys: BookSort[] = status === 'want' ? ['queue', 'priorityHigh', 'priorityLow', 'new', 'old'] : status === 'read' ? ['finished', 'priorityHigh', 'priorityLow', 'new', 'old'] : ['new', 'old', 'priorityHigh', 'priorityLow']
  return keys.map((value) => ({ value, label: sortLabels[value] }))
}

export const defaultBookSort = (status: BookStatus): BookSort => (status === 'want' ? 'queue' : status === 'read' ? 'finished' : 'new')

/** True when the filter narrows anything (the order alone doesn't). */
export const isFilteringBooks = (f: BookFilter) => !!(f.q?.trim() || f.tags?.length || f.format || f.bought)

/** The queue's order: numbered ones by number, the rest after them, the oldest first. */
export const byQueue = (a: Book, b: Book) =>
  (a.queue == null ? 1 : 0) - (b.queue == null ? 1 : 0) || (a.queue ?? 0) - (b.queue ?? 0) || a.createdAt.localeCompare(b.createdAt)

/** One shelf's books that fit, in the chosen order. */
export function filterBooks(list: Book[], status: BookStatus, f: BookFilter): Book[] {
  const q = f.q?.trim().toLowerCase()
  const rank = (b: Book) => priorities.indexOf(b.priority ?? 'medium')
  const newest = (a: Book, b: Book) => b.createdAt.localeCompare(a.createdAt)
  const out = list.filter(
    (b) =>
      b.status === status &&
      (!q || `${b.title} ${b.author ?? ''}`.toLowerCase().includes(q)) &&
      (!f.tags?.length || b.tags.some((t) => f.tags!.includes(t))) &&
      (!f.format || b.format === f.format) &&
      (!f.bought || (f.bought === 'yes') === !!b.bought),
  )
  const sort = f.sort && bookSorts(status).some((s) => s.value === f.sort) ? f.sort : defaultBookSort(status)
  return out.sort((a, b) => {
    switch (sort) {
      case 'queue':
        return byQueue(a, b)
      case 'priorityHigh':
        return rank(a) - rank(b) || newest(a, b)
      case 'priorityLow':
        return rank(b) - rank(a) || newest(a, b)
      case 'old':
        return a.createdAt.localeCompare(b.createdAt)
      case 'finished':
        return (b.finishedOn ?? '').localeCompare(a.finishedOn ?? '') || newest(a, b)
      default:
        return newest(a, b)
    }
  })
}

/**
 * The «хочу прочесть» queue after a book moves one place up (-1) or down (+1): every book gets its
 * place number, so old books without one are numbered too.
 */
export function moveInQueue(list: Book[], id: string, by: -1 | 1): Record<string, number> {
  const queue = list.filter((b) => b.status === 'want').sort(byQueue)
  const i = queue.findIndex((b) => b.id === id)
  const j = i + by
  if (i >= 0 && j >= 0 && j < queue.length) [queue[i], queue[j]] = [queue[j], queue[i]]
  return Object.fromEntries(queue.map((b, n) => [b.id, n + 1]))
}
