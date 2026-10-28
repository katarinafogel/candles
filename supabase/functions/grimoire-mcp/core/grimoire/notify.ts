// GENERATED from src/grimoire/notify.ts by scripts/sync-agent-core.mjs — edit the original, then run: node scripts/sync-agent-core.mjs
// What the grimoire says by push, and when: the server calls this every quarter of an hour with the
// owner's local time and what was already sent today. Each kind goes once a day, in a three-hour
// window from its time (a phone asleep at 9:00 still gets the morning at 9:15). Nothing in the навь.
import { addDays } from './days.ts'
import { isDone, isScheduled, habitLogId } from './habits.ts'
import { dayPlan, deadlinesSoon } from './selectors.ts'
import type { DayKey, GrimoireState } from './types.ts'
import { sabbatDays, sabbats } from './wheel.ts'

export type NotifyKind = 'morning' | 'afternoon' | 'evening'

export interface PushMessage {
  kind: NotifyKind
  title: string
  body: string
  /** Where a tap leads, inside the app (hash route). */
  url: string
}

const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** Is `now` (HH:MM) within three hours after `at`; past midnight counts while the day lasts. */
const due = (at: string, now: string) => {
  if (!at) return false
  let d = mins(now) - mins(at)
  if (d < 0) d += 24 * 60
  return d < 180
}

const list = (xs: string[], n = 3) => xs.slice(0, n).join(', ') + (xs.length > n ? ` и ещё ${xs.length - n}` : '')

export function morningMessage(g: GrimoireState, today: DayKey): PushMessage | undefined {
  const n = g.meta.notify
  const plan = dayPlan(g, today)
  const open = plan.all.filter((t) => t.status !== 'done')
  const parts: string[] = []
  const main = open.find((t) => (t.slot ?? 'extra') === 'main')
  if (open.length) parts.push(`В плане ${open.length}${main ? `, главное — ${main.title}` : ''}.`)
  else parts.push('План пуст — можно выбрать одно дело из бэклога или просто пожить.')
  if (n.deadlines) {
    const dl = deadlinesSoon(g, today, today).map((t) => t.title)
    if (dl.length) parts.push(`Срок сегодня: ${list(dl)}.`)
  }
  if (n.sabbats) {
    const y = +today.slice(0, 4)
    const tomorrow = addDays(today, 1)
    for (const days of [sabbatDays(y, g.meta.hemisphere), sabbatDays(y + 1, g.meta.hemisphere)])
      for (const [k, d] of Object.entries(days)) {
        if (d === today) parts.push(`Сегодня ${sabbats[k as keyof typeof sabbats].name}.`)
        else if (d === tomorrow) parts.push(`Завтра ${sabbats[k as keyof typeof sabbats].name}.`)
      }
  }
  return { kind: 'morning', title: 'Свиток дня', body: parts.join(' '), url: '#/g' }
}

export function afternoonMessage(g: GrimoireState, today: DayKey): PushMessage | undefined {
  const plan = dayPlan(g, today)
  const done = plan.all.filter((t) => t.status === 'done').length
  const left = plan.all.filter((t) => t.status !== 'done')
  if (!plan.all.length) return undefined
  return {
    kind: 'afternoon',
    title: 'Как идёт день?',
    body: left.length ? `Сделано ${done} из ${plan.all.length}. Что-то можно уменьшить или отпустить — без штрафа.` : `Всё из плана сделано: ${done}. Остальное — по желанию.`,
    url: '#/g',
  }
}

export function eveningMessage(g: GrimoireState, today: DayKey): PushMessage | undefined {
  const written = Object.values(g.journal).some((e) => e.day === today && e.type === 'evening')
  const rituals = Object.values(g.habits)
    .filter((h) => h.status === 'active' && isScheduled(h, today) && !isDone(h, g.habitLogs[habitLogId(h.id, today)]))
    .map((h) => h.title)
  if (written && !rituals.length) return undefined
  const parts = [!written && 'Вечерняя страница ждёт: пара слов о дне.', rituals.length && `Ритуалы: ${list(rituals)}.`].filter(Boolean)
  return { kind: 'evening', title: 'Вечер', body: parts.join(' '), url: written ? '#/g/rituals' : '#/g/mirror/evening' }
}

/**
 * The messages due now. `now` is the owner's local HH:MM, `today` her grimoire day, `sent` the kinds
 * already sent today.
 */
export function dueMessages(g: GrimoireState, today: DayKey, now: string, sent: NotifyKind[]): PushMessage[] {
  if (g.meta.nav.active) return []
  const n = g.meta.notify
  const out: (PushMessage | undefined)[] = []
  if (!sent.includes('morning') && due(n.morning, now)) out.push(morningMessage(g, today))
  if (!sent.includes('afternoon') && due(n.afternoon, now)) out.push(afternoonMessage(g, today))
  if (!sent.includes('evening') && n.evening && due(g.meta.eveningAt, now)) out.push(eveningMessage(g, today))
  return out.filter((x): x is PushMessage => !!x)
}
