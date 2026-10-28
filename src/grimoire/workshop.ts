// Deeds of the workshop: a quest «Расписать подсвечники» with one step per item. A step is never
// ticked by hand — it is ticked when the item takes that step in the workshop (from the grimoire or
// right there), so the stock, the stage history and the coins all go one way.
import { holderStageOrder } from '../lib/labels'
import { nextHolderStage } from '../store/dataSlice'
import type { Candle, CandleStage, DataState, Holder } from '../types'
import { addDays } from './days'
import type { DayKey, Task, WorkshopKind, WorkshopLink } from './types'

const candleOrder: CandleStage[] = ['wicked', 'curing', 'decorated', 'ready', 'given']
/** A candle's step → the stage it reaches. */
const candleTarget: Record<string, CandleStage> = { pour: 'curing', decorated: 'decorated', ready: 'ready', given: 'given' }

export const stepTitles: Record<WorkshopKind, Record<string, { todo: string; done: string }>> = {
  holder: {
    dried: { todo: 'Проверить, высохли ли', done: 'Проверила сушку' },
    varnishIn: { todo: 'Покрыть лаком внутри', done: 'Покрыла лаком внутри' },
    painted: { todo: 'Расписать', done: 'Расписала' },
    varnishOut: { todo: 'Покрыть лаком снаружи', done: 'Покрыла лаком снаружи' },
    dampers: { todo: 'Приклеить демпферы', done: 'Приклеила демпферы' },
    done: { todo: 'Отметить готовыми', done: 'Отметила готовыми' },
    wicked: { todo: 'Приклеить фитили', done: 'Приклеила фитили' },
  },
  candle: {
    pour: { todo: 'Залить', done: 'Залила' },
    decorated: { todo: 'Украсить', done: 'Украсила' },
    ready: { todo: 'Отметить готовыми', done: 'Отметила готовыми' },
    given: { todo: 'Подарить', done: 'Подарила' },
  },
}

/** The step an item waits for now, or none (done, given, a defect, a holder that became a candle). */
export function nextStep(d: DataState, kind: WorkshopKind, id: string): string | undefined {
  if (kind === 'holder') {
    const h = d.holders[id]
    if (!h || h.candleId) return undefined
    return nextHolderStage(h)
  }
  const c = d.candles[id]
  if (!c) return undefined
  return { wicked: 'pour', curing: 'decorated', decorated: 'ready', ready: 'given' }[c.stage as string]
}

export type ItemState = 'open' | 'done' | 'defect' | 'gone'

/** Where an item stands against a step: not yet, past it, a defect, or deleted. */
export function itemState(d: DataState, link: WorkshopLink): ItemState {
  if (link.kind === 'holder') {
    const h: Holder | undefined = d.holders[link.id]
    if (!h) return 'gone'
    if (h.stage === 'defect') return 'defect'
    return holderStageOrder.indexOf(h.stage) >= holderStageOrder.indexOf(link.step as Holder['stage']) ? 'done' : 'open'
  }
  const c: Candle | undefined = d.candles[link.id]
  if (!c) return 'gone'
  if (c.stage === 'defect') return 'defect'
  return candleOrder.indexOf(c.stage) >= candleOrder.indexOf(candleTarget[link.step]) ? 'done' : 'open'
}

/** Can the item's step be taken back from here: only when it is the item's last one. */
export function canUndo(d: DataState, link: WorkshopLink) {
  const item = link.kind === 'holder' ? d.holders[link.id] : d.candles[link.id]
  const last = item?.history[item.history.length - 1]?.stage
  return link.kind === 'holder' ? last === link.step : last === candleTarget[link.step]
}

export function itemLabel(d: DataState, kind: WorkshopKind, id: string) {
  if (kind === 'holder') {
    const h = d.holders[id]
    return `${id} ${h ? (d.molds[h.moldId]?.name ?? '') : ''}`.trim()
  }
  return `${id} ${d.candles[id]?.name ?? ''}`.trim()
}

const nouns: Record<WorkshopKind, [string, string, string]> = { holder: ['подсвечник', 'подсвечника', 'подсвечников'], candle: ['свеча', 'свечи', 'свечей'] }
const plural = (n: number, [one, few, many]: [string, string, string]) => {
  const m10 = n % 10
  const m100 = n % 100
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many
}

export const questTitle = (kind: WorkshopKind, step: string, n: number) => `${stepTitles[kind][step]?.todo ?? step} · ${n} ${plural(n, nouns[kind])}`
export const doneTitle = (kind: WorkshopKind, step: string, n: number) => `${stepTitles[kind][step]?.done ?? step} ${n}`

/**
 * «Когда делать» for steps that wait: a holder is checked once it has dried, a candle decorated
 * once the wax has cured. Other steps go to the backlog.
 */
export function plannedDay(d: DataState, kind: WorkshopKind, step: string, ids: string[], today: DayKey): DayKey | undefined {
  const days = ids
    .map((id) => {
      if (kind === 'holder' && step === 'dried') {
        const h = d.holders[id]
        return h ? addDays(h.dryStart.slice(0, 10), d.settings.dryDays ?? 3) : undefined
      }
      if (kind === 'candle' && step === 'decorated') {
        const c = d.candles[id]
        return c?.pouredAt ? addDays(c.pouredAt.slice(0, 10), d.settings.cureDays ?? 14) : undefined
      }
      return undefined
    })
    .filter((x): x is DayKey => !!x)
  if (!days.length) return undefined
  const last = days.sort().at(-1)!
  return last > today ? last : today
}

/** Items ready for a step, for the «Из мастерской» picker: every step with what waits for it. */
export function readySteps(d: DataState) {
  const out: { kind: WorkshopKind; step: string; ids: string[] }[] = []
  const push = (kind: WorkshopKind, id: string) => {
    const step = nextStep(d, kind, id)
    if (!step) return
    const g = out.find((x) => x.kind === kind && x.step === step)
    if (g) g.ids.push(id)
    else out.push({ kind, step, ids: [id] })
  }
  for (const h of Object.values(d.holders)) push('holder', h.id)
  for (const c of Object.values(d.candles)) push('candle', c.id)
  const order = (k: WorkshopKind, s: string) => (k === 'holder' ? Object.keys(stepTitles.holder).indexOf(s) : 10 + Object.keys(stepTitles.candle).indexOf(s))
  for (const g of out) g.ids.sort((a, b) => a.localeCompare(b, 'ru', { numeric: true }))
  return out.sort((a, b) => order(a.kind, a.step) - order(b.kind, b.step))
}

/** Items still open on a workshop step (no open deed) — so the same item doesn't land in two deeds. */
export const inOpenDeed = (tasks: Record<string, Task>) =>
  new Set(Object.values(tasks).filter((t) => t.workshop && t.status !== 'done' && t.status !== 'cancelled').map((t) => `${t.workshop!.kind}:${t.workshop!.id}:${t.workshop!.step}`))

/**
 * The next deed after a closed one: its items (no defects) grouped by the step they wait for now,
 * the biggest group first — «Расписала 5 — завести «Покрыть лаком снаружи»?».
 */
export function nextOffer(d: DataState, tasks: Record<string, Task>, quest: Task) {
  if (!quest.workshopStep) return undefined
  const kind = quest.workshopStep.kind
  const steps = Object.values(tasks).filter((t) => t.parentId === quest.id && t.workshop)
  const done = steps.filter((t) => t.status === 'done')
  const groups = new Map<string, { kind: WorkshopKind; ids: string[] }>()
  for (const t of done) {
    // A holder that got its wick goes on as its candle.
    const h = kind === 'holder' ? d.holders[t.workshop!.id] : undefined
    const [k, id]: [WorkshopKind, string] = h?.candleId ? ['candle', h.candleId] : [kind, t.workshop!.id]
    const step = nextStep(d, k, id)
    if (!step) continue
    const key = `${k}:${step}`
    groups.set(key, { kind: k, ids: [...(groups.get(key)?.ids ?? []), id] })
  }
  const best = [...groups.entries()].sort((a, b) => b[1].ids.length - a[1].ids.length)[0]
  if (!best) return undefined
  return { kind: best[1].kind, step: best[0].split(':')[1], ids: best[1].ids, done: done.length }
}

/**
 * What the grimoire should do with a workshop step so it matches the workshop: tick it, open it
 * again (the step was undone there), or let it go (a defect, a deleted item).
 */
export function syncActions(d: DataState, tasks: Record<string, Task>) {
  const out: { id: string; to: 'done' | 'open' | 'cancelled' }[] = []
  // Before the workshop is loaded every item looks deleted: nothing is let go then.
  const loaded = Object.keys(d.holders).length > 0 || Object.keys(d.candles).length > 0
  for (const t of Object.values(tasks)) {
    if (!t.workshop) continue
    const st = itemState(d, t.workshop)
    const open = t.status !== 'done' && t.status !== 'cancelled'
    if (open && st === 'done') out.push({ id: t.id, to: 'done' })
    else if (open && (st === 'defect' || (st === 'gone' && loaded))) out.push({ id: t.id, to: 'cancelled' })
    else if (t.status === 'done' && st === 'open') out.push({ id: t.id, to: 'open' })
    else if (t.status === 'cancelled' && st === 'open' && t.workshop.lost) out.push({ id: t.id, to: 'open' })
  }
  return out
}
