// Rituals (habit trackers). An active habit puts a task into the day scroll on each scheduled day;
// ticking the task is the mark in the tracker. Streaks follow the schedule, not calendar days:
// one skip a week is forgiven («оберег»), extra shields can be bought, and days in «навь» freeze
// the streak instead of breaking it.
import { addDays, daysBetween, weekStart, weekday } from './days'
import type { DayKey, GrimoireMeta, Habit, HabitLog } from './types'

export const habitLogId = (habitId: string, day: DayKey) => `${habitId}:${day}`
/** One task per habit and day on every device, so two phones never create a duplicate. */
export const habitTaskId = (habitId: string, day: DayKey) => `h:${habitId}:${day}`

export function isActiveOn(h: Habit, day: DayKey) {
  if (h.status !== 'active') return false
  if (h.activeFrom && day < h.activeFrom) return false
  if (h.activeTo && day > h.activeTo) return false
  return true
}

/** Does the schedule ask for the habit on this day. «N times a week» is offered every day. */
export function isScheduled(h: Habit, day: DayKey) {
  if (!isActiveOn(h, day)) return false
  const s = h.schedule
  if (s.kind === 'weekdays') return s.days.includes(weekday(day))
  return true
}

export function isDone(h: Habit, log: HabitLog | undefined) {
  if (!log || log.skipped) return false
  return h.mark.kind === 'count' ? log.value >= h.mark.goal : log.value >= 1
}

/** Days spent in «навь», as a test. */
export function navTest(meta: Pick<GrimoireMeta, 'nav'>, boundaryDay: (iso: string) => DayKey) {
  const periods = meta.nav.history.map((p) => ({ from: boundaryDay(p.from), to: p.to ? boundaryDay(p.to) : undefined }))
  if (meta.nav.active && meta.nav.since) periods.push({ from: boundaryDay(meta.nav.since), to: undefined })
  return (day: DayKey) => periods.some((p) => day >= p.from && (!p.to || day <= p.to))
}

export interface StreakInfo {
  current: number
  best: number
  /** Share of scheduled days done over the last 30 days, 0–1. */
  last30: number
}

/**
 * Streak over the logs up to `today`. Today not done yet does not break anything: the streak is
 * what stands as of yesterday plus today if it is already done.
 */
export function streak(h: Habit, logs: Record<string, HabitLog>, today: DayKey, inNav: (d: DayKey) => boolean = () => false): StreakInfo {
  const done = (d: DayKey) => isDone(h, logs[habitLogId(h.id, d)])
  const start = h.activeFrom ?? h.createdAt.slice(0, 10)
  const span = Math.max(0, daysBetween(start, today))

  // Walk forward once, keeping the running streak; it gives the current and the best one.
  let run = 0
  let best = 0
  let freeUsedWeek: string | undefined
  let bought = h.shields
  if (h.schedule.kind === 'timesPerWeek') {
    const n = h.schedule.n
    let week = weekStart(start)
    while (week <= today) {
      let count = 0
      let navAll = true
      for (let i = 0; i < 7; i++) {
        const d = addDays(week, i)
        if (d < start || d > today) continue
        if (!inNav(d)) navAll = false
        if (done(d)) count++
      }
      const current = week === weekStart(today)
      if (count >= n || current || navAll) run += count
      else run = 0
      best = Math.max(best, run)
      week = addDays(week, 7)
    }
  } else {
    for (let i = 0; i <= span; i++) {
      const d = addDays(start, i)
      if (!isScheduled(h, d) || inNav(d)) continue
      if (done(d)) {
        run++
      } else if (d === today) {
        // still possible today
      } else if (freeUsedWeek !== weekStart(d)) {
        freeUsedWeek = weekStart(d)
      } else if (bought > 0) {
        bought--
      } else {
        run = 0
      }
      best = Math.max(best, run)
    }
  }

  let due = 0
  let made = 0
  for (let i = 0; i < 30; i++) {
    const d = addDays(today, -i)
    if (d < start || !isScheduled(h, d) || inNav(d)) continue
    if (d === today && !done(d)) continue
    due++
    if (done(d)) made++
  }
  if (h.schedule.kind === 'timesPerWeek') due = Math.min(due, Math.round((30 / 7) * h.schedule.n))
  return { current: run, best, last30: due ? Math.min(1, made / due) : 0 }
}

/** Milestones (7, 30, 100 days…) reached by a streak and not paid yet. */
export function newMilestones(h: Habit, current: number, rules: { days: number; coins: number }[]) {
  return rules.filter((m) => current >= m.days && !(h.paidMilestones ?? []).includes(m.days))
}
