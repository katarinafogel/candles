// GENERATED from src/grimoire/selectors.ts by scripts/sync-agent-core.mjs — edit the original, then run: node scripts/sync-agent-core.mjs
import { dueDay } from './days.ts'
import type { DayKey, GrimoireMeta, GrimoireState, Task, TaskSlot } from './types.ts'

export const isOpenTask = (t: Task) => t.status !== 'done' && t.status !== 'cancelled'

/** Waits for another task that isn't closed yet. */
export const isBlocked = (t: Task, tasks: Record<string, Task>) => (t.blockedBy ?? []).some((id) => tasks[id] && isOpenTask(tasks[id]))

/** Postponed three times or more: time to split it, shrink it or let it go. */
export const isStuck = (t: Task) => isOpenTask(t) && t.postponements.length >= 3

/** Waiting for an answer or an event until a day; before it the task stays out of the plan. */
export const isWaiting = (t: Task, today: DayKey) => t.status === 'waiting' && (!t.waitUntil || t.waitUntil > today)

const slotRank: Record<TaskSlot, number> = { main: 0, extra: 1, optional: 2 }

export const byPlanOrder = (a: Task, b: Task) =>
  slotRank[a.slot ?? 'extra'] - slotRank[b.slot ?? 'extra'] || (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt)

/** Tasks chosen for a day (open and done that day), habits apart. */
export function dayPlan(g: GrimoireState, day: DayKey) {
  const all = Object.values(g.tasks).filter((t) => t.doOn === day && t.status !== 'cancelled')
  // Done ones go to the end of their part of the plan.
  const doneLast = (a: Task, b: Task) => Number(a.status === 'done') - Number(b.status === 'done')
  const habits = all.filter((t) => t.habitId)
  const deeds = all.filter((t) => !t.habitId).sort((a, b) => doneLast(a, b) || byPlanOrder(a, b))
  return {
    main: deeds.filter((t) => (t.slot ?? 'extra') === 'main'),
    extra: deeds.filter((t) => (t.slot ?? 'extra') === 'extra'),
    optional: deeds.filter((t) => t.slot === 'optional'),
    habits: habits.sort((a, b) => doneLast(a, b) || a.title.localeCompare(b.title)),
    all: deeds,
  }
}

/** How many open deeds of each slot a day already has, for the soft plan limit. */
export function slotCounts(g: GrimoireState, day: DayKey) {
  const c: Record<TaskSlot, number> = { main: 0, extra: 0, optional: 0 }
  for (const t of Object.values(g.tasks)) if (t.doOn === day && !t.habitId && isOpenTask(t)) c[t.slot ?? 'extra']++
  return c
}

export const overLimit = (meta: GrimoireMeta, counts: Record<TaskSlot, number>, slot: TaskSlot) => {
  const limit = meta.planLimit[slot]
  // A limit of 0 for «extra» means «not limited separately».
  return limit > 0 && counts[slot] >= limit
}

/** Yesterday's (and older) unfinished deeds for the morning review. Habits leave on their own. */
export const toReview = (g: GrimoireState, today: DayKey) =>
  Object.values(g.tasks)
    .filter((t) => !t.habitId && t.doOn && t.doOn < today && isOpenTask(t) && t.status !== 'waiting')
    .sort(byPlanOrder)

/** The backlog: open tasks with no day chosen. It is storage, not a list of debts. */
export const backlog = (g: GrimoireState, today: DayKey) =>
  Object.values(g.tasks).filter((t) => !t.habitId && !t.doOn && isOpenTask(t) && !isWaiting(t, today) && !t.parentId)

/** Joys ahead: nearest first. */
export const joysAhead = (g: GrimoireState, today: DayKey) =>
  Object.values(g.tasks)
    .filter((t) => t.type === 'joy' && isOpenTask(t) && (t.doOn ?? dueDay(t.dueAt) ?? today) >= today)
    .sort((a, b) => (a.doOn ?? dueDay(a.dueAt) ?? '9999').localeCompare(b.doOn ?? dueDay(b.dueAt) ?? '9999'))

/** Real deadlines coming up within `days`, for the calm reminder. */
export const deadlinesSoon = (g: GrimoireState, today: DayKey, horizon: DayKey) =>
  Object.values(g.tasks)
    .filter((t) => isOpenTask(t) && t.type === 'deed' && t.dueAt && dueDay(t.dueAt)! <= horizon)
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))

export const allTags = (g: GrimoireState) => [...new Set(Object.values(g.tasks).flatMap((t) => t.tags))].sort()

/**
 * The colour of a deed's card; the first that fits wins: frog → joy → the hardest (3 stars) → needed.
 * A hard joy stays nacre (its three stars show on the card).
 */
export const cardTone = (t: Task): 'swamp' | 'nacre' | 'wine' | 'silver' =>
  t.frog === 'auto' || t.frog === 'manual' ? 'swamp' : t.type === 'joy' ? 'nacre' : t.stars === 3 ? 'wine' : 'silver'

/** Steps of a quest, in order. */
export const stepsOf = (g: GrimoireState, id: string) =>
  Object.values(g.tasks)
    .filter((t) => t.parentId === id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

/** The chain a task grew («лампочка: 4 звена, 9 дней»): every task spawned from it, transitively. */
export function chainOf(g: GrimoireState, id: string): Task[] {
  const out: Task[] = []
  const walk = (from: string) => {
    for (const t of Object.values(g.tasks)) if (t.spawnedFrom === from) {
      out.push(t)
      walk(t.id)
    }
  }
  walk(id)
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Game words or plain ones, as chosen in the settings. */
export function words(meta: Pick<GrimoireMeta, 'gameWords'>) {
  return meta.gameWords
    ? { scroll: 'Свиток дня', book: 'Книга дел', rituals: 'Ритуалы', ritual: 'ритуал', quest: 'квест', wheel: 'Колесо года', treasury: 'Сокровищница', projects: 'Великие деяния' }
    : { scroll: 'Сегодня', book: 'Все дела', rituals: 'Привычки', ritual: 'привычка', quest: 'задача с шагами', wheel: 'Колесо года', treasury: 'Монеты', projects: 'Проекты' }
}

/**
 * A project's own deeds: simple ones and quests (their steps count inside the quest), not cancelled.
 * In the book's order; done ones go to the last pages.
 */
export const projectTasks = (g: Pick<GrimoireState, 'tasks'>, projectId: string) =>
  Object.values(g.tasks)
    .filter((t) => t.projectId === projectId && !t.parentId && t.status !== 'cancelled')
    .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || (a.order ?? 1e9) - (b.order ?? 1e9) || a.createdAt.localeCompare(b.createdAt))

/** Share of a project's deeds that are done, 0…1 (0 for an empty book). */
export function projectProgress(g: Pick<GrimoireState, 'tasks'>, projectId: string) {
  const all = projectTasks(g, projectId)
  return all.length ? all.filter((t) => t.status === 'done').length / all.length : 0
}
