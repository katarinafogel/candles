// The agent's tools: what an assistant may read and do in the grimoire, as plain functions over the
// grimoire state. Every change goes through the same reducer as the app (coins, streaks, chains,
// repeats), so the assistant can't skip a rule by writing rows directly. The server
// (supabase/functions/grimoire-mcp) only loads the state, runs a tool and saves what changed.
import { nanoid } from '@reduxjs/toolkit'
import reducer, { grimoireActions as A } from '../store/grimoireSlice.ts'
import { balance, dayCoins, isFrog, taskCoins } from './coins.ts'
import { addDays, dayKeyIn, isDayKey } from './days.ts'
import { habitLogId, habitTaskId, isDone, isScheduled, navTest, streak } from './habits.ts'
import { parseQuickAdd } from './parse.ts'
import {
  backlog,
  chainOf,
  dayPlan,
  dayStars,
  deadlinesSoon,
  evenInNav,
  isBlocked,
  isOpenTask,
  isStuck,
  isWaiting,
  joysAhead,
  overLimit,
  slotCounts,
  stepsOf,
  toReview,
} from './selectors.ts'
import type { DayKey, GrimoireState, PostponeReason, Task, TaskSlot } from './types.ts'
import { sabbatOrder, sabbats, segmentOf, wheelNow } from './wheel.ts'

export class AgentError extends Error {}

export interface AgentContext {
  state: GrimoireState
  now: Date
  /** Workshop people (the bestiary shares them), for names on tasks. Read only. */
  people?: Record<string, { id: string; name: string }>
}

export interface ToolOutcome {
  state: GrimoireState
  result: unknown
}

interface JsonSchema {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
  additionalProperties?: boolean
}

export interface ToolDef {
  name: string
  description: string
  inputSchema: JsonSchema
  /** Changes the grimoire (the server saves after it). */
  writes: boolean
  /** MCP hint: undoing is possible, nothing is destroyed. */
  destructive?: boolean
}

// ---------- shared bits ----------

type Args = Record<string, unknown>
type Run = (args: Args, c: Ctx) => unknown

interface Ctx extends AgentContext {
  /** The grimoire day now, in the owner's time zone. */
  today: DayKey
  at: string
  /** Applies a grimoire action to the working state. */
  apply: (type: string, payload: unknown) => void
  get: () => GrimoireState
}

const day = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'день YYYY-MM-DD (день гримуара с учётом границы дня)' }
const slot = { type: 'string', enum: ['main', 'extra', 'optional'], description: 'главное / дополнительное / необязательное' }
const reasons: PostponeReason[] = ['unclear', 'tooBig', 'unpleasant', 'hardToDecide', 'needTalk', 'noPlace', 'noEnergy', 'dontKnow']

const str = (a: Args, k: string, required = false): string | undefined => {
  const v = a[k]
  if (v == null || v === '') {
    if (required) throw new AgentError(`нужен параметр ${k}`)
    return undefined
  }
  if (typeof v !== 'string') throw new AgentError(`${k} должен быть строкой`)
  return v
}
const dayArg = (a: Args, k: string, required = false): DayKey | undefined => {
  const v = str(a, k, required)
  if (v != null && !isDayKey(v)) throw new AgentError(`${k}: ожидается дата YYYY-MM-DD`)
  return v
}
const int = (a: Args, k: string, lo: number, hi: number): number | undefined => {
  const v = a[k]
  if (v == null) return undefined
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new AgentError(`${k} должен быть числом`)
  return Math.max(lo, Math.min(hi, Math.round(v)))
}
const strs = (a: Args, k: string): string[] | undefined => {
  const v = a[k]
  if (v == null) return undefined
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new AgentError(`${k} должен быть списком строк`)
  return (v as string[]).map((x) => x.trim()).filter(Boolean)
}
const oneOf = <T extends string>(a: Args, k: string, values: readonly T[]): T | undefined => {
  const v = str(a, k)
  if (v != null && !values.includes(v as T)) throw new AgentError(`${k}: одно из ${values.join(', ')}`)
  return v as T | undefined
}

function task(c: Ctx, id: unknown): Task {
  if (typeof id !== 'string') throw new AgentError('нужен id дела')
  const t = c.get().tasks[id]
  if (!t) throw new AgentError(`нет дела с id ${id}`)
  return t
}

/** A deed as the assistant sees it: short, with what matters for planning. */
function view(t: Task, c: Ctx, full = false) {
  const g = c.get()
  const blockers = (t.blockedBy ?? []).map((id) => g.tasks[id]).filter((x) => x && isOpenTask(x))
  const out: Record<string, unknown> = {
    id: t.id,
    title: t.title,
    status: t.status,
    ...(t.type === 'joy' ? { type: 'joy' } : {}),
    ...(t.doOn ? { doOn: t.doOn } : {}),
    ...(t.slot && t.doOn ? { slot: t.slot } : {}),
    ...(t.dueAt ? { dueAt: t.dueAt } : {}),
    stars: t.stars,
    dread: t.dread,
    ...(t.tags.length ? { tags: t.tags } : {}),
    ...(t.habitId ? { habitId: t.habitId } : {}),
    ...(t.parentId ? { parentId: t.parentId } : {}),
    ...(blockers.length ? { waitsFor: blockers.map((b) => ({ id: b!.id, title: b!.title })) } : {}),
    ...(t.status === 'waiting' && t.waitUntil ? { waitUntil: t.waitUntil } : {}),
    ...(t.postponements.length ? { postponed: t.postponements.length } : {}),
    ...(isStuck(t) ? { stuck: true } : {}),
    ...(isFrog(t) ? { frog: true } : {}),
    ...(t.eatOn ? { eatOn: t.eatOn } : {}),
    ...(t.projectId && g.projects[t.projectId] ? { project: g.projects[t.projectId].title } : {}),
    ...(t.personIds?.length && c.people ? { people: t.personIds.map((id) => c.people![id]?.name).filter(Boolean) } : {}),
    ...(isOpenTask(t) ? { coins: taskCoins(t, c.today, g.meta.coins).total } : {}),
  }
  if (!full) return out
  return {
    ...out,
    ...Object.fromEntries(
      (['note', 'want', 'ownerKind', 'why', 'whyText', 'costs', 'enough', 'stopAt', 'ifStuck', 'prep', 'wrapUp', 'estimateMin', 'zone', 'rewardText', 'repeat', 'partialNote', 'source', 'createdAt', 'doneAt', 'spawnedFrom'] as const)
        .filter((k) => t[k] != null && !(Array.isArray(t[k]) && !(t[k] as unknown[]).length))
        .map((k) => [k, t[k]]),
    ),
    postponements: t.postponements,
    steps: stepsOf(g, t.id).map((s) => ({ id: s.id, title: s.title, status: s.status, doOn: s.doOn })),
    chain: chainOf(g, t.id).map((s) => ({ id: s.id, title: s.title, status: s.status })),
  }
}

/** Fields the assistant may set on a deed (ids, statuses and coins go through actions). */
const taskFieldSchema = {
  title: { type: 'string', maxLength: 200 },
  note: { type: 'string' },
  type: { type: 'string', enum: ['deed', 'joy'], description: 'дело или радость (радость не просрочивается)' },
  stars: { type: 'integer', minimum: 1, maximum: 3, description: 'сложность 1–3' },
  dread: { type: 'integer', minimum: 0, maximum: 3, description: 'нехотение: 0 норм, 1 лень, 2 не хочу, 3 чудовище' },
  dueAt: { type: 'string', description: 'реальный дедлайн YYYY-MM-DD или YYYY-MM-DDTHH:mm; пустая строка убирает' },
  tags: { type: 'array', items: { type: 'string' } },
  want: { type: 'string', enum: ['want', 'need', 'unsure'] },
  ownerKind: { type: 'string', enum: ['mine', 'person', 'work', 'other'] },
  enough: { type: 'string', description: 'достаточный результат' },
  stopAt: { type: 'string', description: 'где остановиться' },
  ifStuck: { type: 'string', description: 'что делать, если упрётся' },
  estimateMin: { type: 'integer', minimum: 1 },
  zone: { type: 'string' },
  rewardText: { type: 'string', description: 'своя настоящая награда' },
  evenInNav: { type: 'boolean', description: 'напоминать даже в нави (реальная дата, которую нельзя пропустить)' },
}

function taskFields(a: Args): Partial<Task> {
  const f: Partial<Task> = {}
  const title = str(a, 'title')
  if (title != null) f.title = title.trim().slice(0, 200)
  for (const k of ['note', 'enough', 'stopAt', 'ifStuck', 'zone', 'rewardText'] as const) {
    if (k in a) f[k] = str(a, k) ?? undefined
  }
  const type = oneOf(a, 'type', ['deed', 'joy'] as const)
  if (type) f.type = type
  const stars = int(a, 'stars', 1, 3)
  if (stars != null) f.stars = stars as Task['stars']
  const dread = int(a, 'dread', 0, 3)
  if (dread != null) f.dread = dread as Task['dread']
  if ('dueAt' in a) {
    const d = str(a, 'dueAt')
    if (d != null && !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(d)) throw new AgentError('dueAt: YYYY-MM-DD или YYYY-MM-DDTHH:mm')
    f.dueAt = d
  }
  const tags = strs(a, 'tags')
  if (tags) f.tags = tags.map((t) => t.replace(/^#/, '').toLowerCase())
  const want = oneOf(a, 'want', ['want', 'need', 'unsure'] as const)
  if (want) f.want = want
  const ownerKind = oneOf(a, 'ownerKind', ['mine', 'person', 'work', 'other'] as const)
  if (ownerKind) f.ownerKind = ownerKind
  if (typeof a.evenInNav === 'boolean') f.evenInNav = a.evenInNav || undefined
  const est = int(a, 'estimateMin', 1, 24 * 60)
  if (est != null) f.estimateMin = est
  return f
}

/** What is over if a deed of `stars` joins `day` in `slot`: the slot's limit, the day's stars, or nothing. */
function planWarning(c: Ctx, day: DayKey, slot: TaskSlot, stars: number) {
  const g = c.get()
  const parts: string[] = []
  if (overLimit(g.meta, slotCounts(g, day), slot)) parts.push(`на ${day} уже набран лимит для «${slot}»`)
  const st = dayStars(g, day)
  if (st.limit > 0 && st.total + stars > st.limit) parts.push(`звёзд в плане станет ${st.total + stars} при лимите ${st.limit}`)
  return parts.length ? parts.join('; ') : undefined
}

const navNote = (c: Ctx) => {
  const nav = c.get().meta.nav
  if (!nav.active) return undefined
  return nav.agent === 'silent'
    ? 'Хозяйка в нави и просила тишины: ничего не присылай сам, отвечай только на её прямой вопрос. Исключение — дела из evenInNav.'
    : 'Хозяйка в нави: никаких планов и проверок, только мягкое «я тут» или тишина. Напомнить можно только о делах из evenInNav.'
}

// ---------- the tools ----------

const tools: (ToolDef & { run: Run })[] = [
  {
    name: 'grimoire_today',
    description:
      'Сегодняшний свиток: план (главное → дополнительное → необязательное → ритуалы), что осталось со вчера для утреннего разбора, радости впереди, сроки рядом, буксующие, монеты, колесо года, состояние нави. Вызывай первым в каждой сводке. Если хозяйка в нави (nav.active) — не предлагай план и не проверяй дела.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    writes: true,
    run: (_a, c) => {
      const g0 = c.get()
      // The same daily chore the app does when opened: today's ritual tasks appear, yesterday's leave as skips.
      if (!g0.meta.nav.active && g0.meta.habitsGeneratedFor !== c.today) c.apply(A.generateHabitTasks.type, { at: c.at, day: c.today })
      const g = c.get()
      const plan = dayPlan(g, c.today)
      const v = (t: Task) => view(t, c)
      const wheel = wheelNow(c.today, g.meta.hemisphere)
      const energy = Object.values(g.journal)
        .filter((e) => e.energy)
        .sort((a, b) => b.at.localeCompare(a.at))[0]
      return {
        day: c.today,
        timeZone: g.meta.timeZone ?? null,
        nav: { active: g.meta.nav.active, since: g.meta.nav.since ?? null, note: navNote(c) ?? null, agent: g.meta.nav.agent ?? 'hello' },
        evenInNav: evenInNav(g, addDays(c.today, 3)).map(v),
        coins: { balance: balance(g.coinTxs), today: dayCoins(g.coinTxs, c.today) },
        planLimit: g.meta.planLimit,
        dayStars: (() => {
          const st = dayStars(g, c.today)
          return { inPlan: st.total, joys: st.joy, limit: st.limit, over: st.over }
        })(),
        plan: { main: plan.main.map(v), extra: plan.extra.map(v), optional: plan.optional.map(v), rituals: plan.habits.map(v) },
        morningReview: g.meta.reviewedDay === c.today || g.meta.nav.active ? [] : toReview(g, c.today).map(v),
        joysAhead: joysAhead(g, c.today).slice(0, 5).map(v),
        deadlinesSoon: deadlinesSoon(g, c.today, addDays(c.today, 3)).map(v),
        stuck: Object.values(g.tasks).filter(isStuck).map(v),
        backlogSize: backlog(g, c.today).length,
        lastEnergy: energy ? { value: energy.energy, day: energy.day } : null,
        wheel: {
          now: sabbats[wheel.current.sabbat].name,
          next: sabbats[wheel.next.sabbat].name,
          nextDay: wheel.next.day,
          daysToNext: wheel.daysToNext,
        },
      }
    },
  },
  {
    name: 'grimoire_day_summary',
    description: 'Итог дня: что сделано, что перенесено и почему, сколько монет, хвосты, записи зеркала. Для вечерней сводки.',
    inputSchema: { type: 'object', properties: { day: { ...day, description: 'по умолчанию сегодня' } }, additionalProperties: false },
    writes: false,
    run: (a, c) => {
      const d = dayArg(a, 'day') ?? c.today
      const g = c.get()
      const all = Object.values(g.tasks)
      return {
        day: d,
        done: all.filter((t) => t.status === 'done' && t.doneDay === d).map((t) => view(t, c)),
        partial: all.filter((t) => t.status === 'partial' && t.doOn === d).map((t) => view(t, c)),
        leftInPlan: all.filter((t) => t.doOn === d && isOpenTask(t) && !t.habitId).map((t) => view(t, c)),
        postponed: all.flatMap((t) => t.postponements.filter((p) => p.day === d).map((p) => ({ id: t.id, title: t.title, to: p.to ?? 'бэклог', reason: p.reason ?? null }))),
        tailsGrown: all.filter((t) => t.spawnedFrom && t.createdAt.slice(0, 10) === d).map((t) => ({ id: t.id, title: t.title, from: g.tasks[t.spawnedFrom!]?.title })),
        coins: dayCoins(g.coinTxs, d),
        journal: Object.values(g.journal).filter((e) => e.day === d),
      }
    },
  },
  {
    name: 'grimoire_list_tasks',
    description: 'Дела по виду: backlog (не выбраны на день), planned (в плане на любые дни), waiting (ждут ответа или другого дела), stuck (буксуют, 3+ переноса), done (сделанные, новые сверху), all. Фильтры по тегу и тексту.',
    inputSchema: {
      type: 'object',
      properties: {
        view: { type: 'string', enum: ['backlog', 'planned', 'waiting', 'stuck', 'done', 'all'] },
        tag: { type: 'string' },
        search: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'по умолчанию 50' },
      },
      required: ['view'],
      additionalProperties: false,
    },
    writes: false,
    run: (a, c) => {
      const g = c.get()
      const mode = oneOf(a, 'view', ['backlog', 'planned', 'waiting', 'stuck', 'done', 'all'] as const) ?? 'backlog'
      const all = Object.values(g.tasks).filter((t) => !t.habitId)
      let xs =
        mode === 'backlog'
          ? backlog(g, c.today)
          : mode === 'planned'
            ? all.filter((t) => t.doOn && isOpenTask(t))
            : mode === 'waiting'
              ? all.filter((t) => isOpenTask(t) && (isWaiting(t, c.today) || isBlocked(t, g.tasks)))
              : mode === 'stuck'
                ? all.filter(isStuck)
                : mode === 'done'
                  ? all.filter((t) => t.status === 'done').sort((x, y) => (y.doneAt ?? '').localeCompare(x.doneAt ?? ''))
                  : all
      const tag = str(a, 'tag')?.replace(/^#/, '').toLowerCase()
      const q = str(a, 'search')?.toLowerCase()
      xs = xs.filter((t) => (!tag || t.tags.includes(tag)) && (!q || t.title.toLowerCase().includes(q) || (t.note ?? '').toLowerCase().includes(q)))
      if (mode !== 'done') xs = [...xs].sort((x, y) => (x.dueAt ?? '9999').localeCompare(y.dueAt ?? '9999') || x.createdAt.localeCompare(y.createdAt))
      const limit = int(a, 'limit', 1, 200) ?? 50
      return { total: xs.length, tasks: xs.slice(0, limit).map((t) => view(t, c)) }
    },
  },
  {
    name: 'grimoire_get_task',
    description: 'Одно дело целиком: все поля, переносы с причинами, шаги квеста и цепочка «потянуло за собой».',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
    writes: false,
    run: (a, c) => view(task(c, a.id), c, true),
  },
  {
    name: 'grimoire_add_task',
    description:
      'Новое дело. Можно строкой как в быстром добавлении (line: «помыть окна **☠☠ #дом !пт», «кино +радость», «+главное», «+завтра») или полями. Без doOn дело уходит в бэклог. Если на день уже набран лимит плана, дело всё равно добавится, но вернётся warning — тогда спроси, что убрать.',
    inputSchema: {
      type: 'object',
      properties: {
        line: { type: 'string', description: 'строка быстрого добавления' },
        ...taskFieldSchema,
        doOn: { ...day, description: 'на какой день поставить в план' },
        slot,
        steps: { type: 'array', items: { type: 'string' }, description: 'сразу расколоть на шаги (в план пойдёт первый)' },
      },
      additionalProperties: false,
    },
    writes: true,
    run: (a, c) => {
      const line = str(a, 'line')
      const parsed = line ? parseQuickAdd(line, c.today) : undefined
      const fields: Partial<Task> = {
        ...(parsed
          ? { title: parsed.title, stars: parsed.stars, dread: parsed.dread, tags: parsed.tags, type: parsed.type, dueAt: parsed.dueAt, doOn: parsed.doOn, slot: parsed.slot }
          : {}),
        ...taskFields(a),
      }
      const doOn = dayArg(a, 'doOn') ?? fields.doOn
      const s = oneOf(a, 'slot', ['main', 'extra', 'optional'] as const) ?? fields.slot
      if (!fields.title) throw new AgentError('нужно название (title или line)')
      const id = nanoid()
      const slotFinal: TaskSlot | undefined = doOn ? (s ?? 'extra') : undefined
      const warning = doOn && slotFinal ? planWarning(c, doOn, slotFinal, fields.stars ?? 1) : undefined
      c.apply(A.addTask.type, { fields: { ...fields, title: fields.title, id, doOn, slot: slotFinal }, at: c.at, day: c.today })
      const steps = strs(a, 'steps')
      if (steps?.length) c.apply(A.splitTask.type, { id, steps, at: c.at, day: c.today })
      return { task: view(c.get().tasks[id], c), ...(warning ? { warning } : {}) }
    },
  },
  {
    name: 'grimoire_update_task',
    description: 'Поменять поля дела (название, сложность, нехотение, срок, теги, заметки и т. п.). День в плане меняется через grimoire_plan_task, статус — через свои инструменты.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, ...taskFieldSchema }, required: ['id'], additionalProperties: false },
    writes: true,
    run: (a, c) => {
      const t = task(c, a.id)
      c.apply(A.updateTask.type, { ...taskFields(a), id: t.id })
      return view(c.get().tasks[t.id], c, true)
    },
  },
  {
    name: 'grimoire_complete_task',
    description: 'Отметить дело сделанным (монеты по формуле, бонус в срок, квест и мечта закроются сами, повтор вернётся). partial — сделана часть, половина монет. Делай это только когда хозяйка сказала, что сделала.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, partial: { type: 'boolean' }, note: { type: 'string', description: 'что именно сделано (для части)' } },
      required: ['id'],
      additionalProperties: false,
    },
    writes: true,
    run: (a, c) => {
      const t = task(c, a.id)
      const before = balance(c.get().coinTxs)
      c.apply(A.completeTask.type, { id: t.id, partial: !!a.partial, note: str(a, 'note'), at: c.at, day: c.today })
      return { task: view(c.get().tasks[t.id], c), coins: balance(c.get().coinTxs) - before, reward: t.rewardText ?? null }
    },
  },
  {
    name: 'grimoire_reopen_task',
    description: 'Вернуть сделанное (или частично сделанное) дело в работу; монеты списываются обратной записью.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
    writes: true,
    run: (a, c) => {
      const t = task(c, a.id)
      c.apply(A.reopenTask.type, { id: t.id, at: c.at, day: c.today })
      return view(c.get().tasks[t.id], c)
    },
  },
  {
    name: 'grimoire_start_task',
    description: '«Начать понемногу»: честно начатое дело приносит немного монет один раз, даже если не доделано.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
    writes: true,
    run: (a, c) => {
      const t = task(c, a.id)
      c.apply(A.startTask.type, { id: t.id, at: c.at, day: c.today })
      return view(c.get().tasks[t.id], c)
    },
  },
  {
    name: 'grimoire_plan_task',
    description: 'Поставить дело в план на день со слотом (главное / дополнительное / необязательное) или убрать из плана в бэклог (day не передан). Это выбор, а не перенос: перенос — grimoire_postpone_task.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, day, slot }, required: ['id'], additionalProperties: false },
    writes: true,
    run: (a, c) => {
      const t = task(c, a.id)
      const d = dayArg(a, 'day')
      const s = oneOf(a, 'slot', ['main', 'extra', 'optional'] as const)
      const warning = d && t.doOn !== d ? planWarning(c, d, s ?? t.slot ?? 'extra', t.stars) : undefined
      if (d && isBlocked(t, c.get().tasks)) throw new AgentError('дело ждёт другое дело (waitsFor), его нельзя поставить в план')
      c.apply(A.planTask.type, { id: t.id, day: d, slot: s })
      return { task: view(c.get().tasks[t.id], c), ...(warning ? { warning } : {}) }
    },
  },
  {
    name: 'grimoire_postpone_task',
    description: `Перенести дело на другой день (to) или в бэклог (без to). Перенос запоминается с днём и причиной, без осуждения; после трёх дело получает пометку «буксует». Причины: ${reasons.join(', ')}.`,
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, to: day, reason: { type: 'string', enum: reasons } }, required: ['id'], additionalProperties: false },
    writes: true,
    run: (a, c) => {
      const t = task(c, a.id)
      c.apply(A.postponeTask.type, { id: t.id, to: dayArg(a, 'to'), reason: oneOf(a, 'reason', reasons), at: c.at, day: c.today })
      return view(c.get().tasks[t.id], c)
    },
  },
  {
    name: 'grimoire_to_backlog',
    description: 'Отправить дела в бэклог без штрафа и без записи переноса: «всё в бэклог» на утреннем разборе или «на сегодня всё».',
    inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'], additionalProperties: false },
    writes: true,
    run: (a, c) => {
      const ids = strs(a, 'ids') ?? []
      ids.forEach((id) => task(c, id))
      c.apply(A.toBacklog.type, ids)
      return { moved: ids.length }
    },
  },
  {
    name: 'grimoire_finish_morning_review',
    description:
      'Закрыть утренний разбор на сегодня. allToBacklog — сначала отправить все вчерашние хвосты в бэклог (считается переносом). cleanSlate — «чистый лист» после долгого отсутствия: все хвосты одной пачкой «разобрать потом», без счёта переносов.',
    inputSchema: { type: 'object', properties: { allToBacklog: { type: 'boolean' }, cleanSlate: { type: 'boolean' } }, additionalProperties: false },
    writes: true,
    run: (a, c) => {
      const left = toReview(c.get(), c.today)
      if (a.cleanSlate) c.apply(A.clearSlate.type, { ids: left.map((t) => t.id), day: c.today })
      else if (a.allToBacklog) c.apply(A.reviewToBacklog.type, left.map((t) => t.id))
      c.apply(A.markReviewed.type, c.today)
      return { reviewed: c.today, movedToBacklog: a.allToBacklog || a.cleanSlate ? left.length : 0 }
    },
  },
  {
    name: 'grimoire_cancel_task',
    description: 'Отпустить дело как ненужное: без монет и без штрафа.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
    writes: true,
    destructive: true,
    run: (a, c) => {
      const t = task(c, a.id)
      c.apply(A.cancelTask.type, { id: t.id, at: c.at, day: c.today })
      return view(c.get().tasks[t.id], c)
    },
  },
  {
    name: 'grimoire_set_waiting',
    description: 'Дело ждёт ответа или события до дня until; до него не попадает в план.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, until: day, note: { type: 'string', description: 'чего ждём' } }, required: ['id'], additionalProperties: false },
    writes: true,
    run: (a, c) => {
      const t = task(c, a.id)
      c.apply(A.setWaiting.type, { id: t.id, until: dayArg(a, 'until'), note: str(a, 'note') })
      return view(c.get().tasks[t.id], c)
    },
  },
  {
    name: 'grimoire_wait_for',
    description: '«Ждёт другое дело»: дело id не встанет в план, пока не закрыто дело blockerId (on=false снимает связь). Связь, которая замкнула бы круг, не ставится.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, blockerId: { type: 'string' }, on: { type: 'boolean', description: 'по умолчанию true' } }, required: ['id', 'blockerId'], additionalProperties: false },
    writes: true,
    run: (a, c) => {
      const t = task(c, a.id)
      const b = task(c, a.blockerId)
      const on = a.on !== false
      c.apply(A.linkBlock.type, { id: t.id, blockerId: b.id, on })
      const linked = !!c.get().tasks[t.id].blockedBy?.includes(b.id)
      if (on && !linked) throw new AgentError('эта связь замкнула бы круг: дело уже само ждёт это')
      return view(c.get().tasks[t.id], c)
    },
  },
  {
    name: 'grimoire_spawn_task',
    description: '«Потянуло за собой»: из дела выросло новое. Новое звено занимает его место в плане, исходное ждёт, пока хвост не закроется. Монеты за каждое звено отдельно.',
    inputSchema: { type: 'object', properties: { fromId: { type: 'string' }, title: { type: 'string' } }, required: ['fromId', 'title'], additionalProperties: false },
    writes: true,
    run: (a, c) => {
      const from = task(c, a.fromId)
      const id = nanoid()
      c.apply(A.spawnTask.type, { fromId: from.id, fields: { id, title: str(a, 'title', true)! }, at: c.at, day: c.today })
      return { tail: view(c.get().tasks[id], c), origin: view(c.get().tasks[from.id], c) }
    },
  },
  {
    name: 'grimoire_split_task',
    description: '«Расколоть» большое или буксующее дело на шаги (решить / подготовить / сделать / связаться / ждать / найти информацию / купить). В план идёт только первый шаг; когда закрыт последний, квест закрывается сам с бонусом.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, steps: { type: 'array', items: { type: 'string' }, minItems: 1 } }, required: ['id', 'steps'], additionalProperties: false },
    writes: true,
    run: (a, c) => {
      const t = task(c, a.id)
      const steps = strs(a, 'steps') ?? []
      if (!steps.length) throw new AgentError('нужен хотя бы один шаг')
      c.apply(A.splitTask.type, { id: t.id, steps, at: c.at, day: c.today })
      return view(c.get().tasks[t.id], c, true)
    },
  },
  {
    name: 'grimoire_habits',
    description: 'Ритуалы (привычки): расписание, серия, лучшая серия, процент за 30 дней, нужно ли сегодня и отмечено ли.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    writes: false,
    run: (_a, c) => {
      const g = c.get()
      const inNav = navTest(g.meta, (iso) => dayKeyIn(new Date(iso), g.meta.dayBoundaryHour, g.meta.timeZone))
      return Object.values(g.habits)
        .filter((h) => h.status !== 'archived')
        .map((h) => {
          const st = streak(h, g.habitLogs, c.today, inNav)
          const log = g.habitLogs[habitLogId(h.id, c.today)]
          return {
            id: h.id,
            title: h.title,
            status: h.status,
            schedule: h.schedule,
            mark: h.mark,
            todayScheduled: isScheduled(h, c.today),
            todayDone: isDone(h, log),
            todayValue: log?.value ?? 0,
            streak: st.current,
            best: st.best,
            last30: Math.round(st.last30 * 100),
          }
        })
    },
  },
  {
    name: 'grimoire_mark_habit',
    description: 'Отметить ритуал за день (по умолчанию сегодня): done для да/нет, value для количества (8 стаканов). done=false или value=0 снимает отметку.',
    inputSchema: {
      type: 'object',
      properties: { habitId: { type: 'string' }, day, done: { type: 'boolean' }, value: { type: 'number', minimum: 0 } },
      required: ['habitId'],
      additionalProperties: false,
    },
    writes: true,
    run: (a, c) => {
      const h = c.get().habits[str(a, 'habitId', true)!]
      if (!h) throw new AgentError('нет такого ритуала')
      const d = dayArg(a, 'day') ?? c.today
      const value = typeof a.value === 'number' ? Math.max(0, a.value) : a.done === false ? 0 : h.mark.kind === 'count' ? h.mark.goal : 1
      c.apply(A.setHabitValue.type, { habitId: h.id, date: d, value, at: c.at, day: c.today })
      const g = c.get()
      return { habitId: h.id, day: d, value, done: isDone(h, g.habitLogs[habitLogId(h.id, d)]), task: g.tasks[habitTaskId(h.id, d)]?.status ?? null }
    },
  },
  {
    name: 'grimoire_add_journal',
    description: 'Запись в зеркало (дневник): настроение и энергия 1–5, эмоции, факторы, текст. type evening — вечерняя страница (что получилось, что отложила и почему, за что благодарна). Записывай только то, что хозяйка сказала сама.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['entry', 'evening'] },
        mood: { type: 'integer', minimum: 1, maximum: 5 },
        energy: { type: 'integer', minimum: 1, maximum: 5 },
        emotions: { type: 'array', items: { type: 'string' } },
        factors: { type: 'array', items: { type: 'string' } },
        text: { type: 'string' },
        wentWell: { type: 'string' },
        putOff: { type: 'string' },
        grateful: { type: 'string' },
      },
      additionalProperties: false,
    },
    writes: true,
    run: (a, c) => {
      const entry = {
        id: nanoid(),
        type: oneOf(a, 'type', ['entry', 'evening'] as const) ?? 'entry',
        mood: int(a, 'mood', 1, 5),
        energy: int(a, 'energy', 1, 5),
        emotions: strs(a, 'emotions'),
        factors: strs(a, 'factors'),
        text: str(a, 'text'),
        wentWell: str(a, 'wentWell'),
        putOff: str(a, 'putOff'),
        grateful: str(a, 'grateful'),
      }
      const clean = Object.fromEntries(Object.entries(entry).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)))
      if (Object.keys(clean).length <= 2) throw new AgentError('запись пустая')
      c.apply(A.addJournal.type, { entry: clean, at: c.at, day: c.today })
      return c.get().journal[entry.id]
    },
  },
  {
    name: 'grimoire_set_nav',
    description: 'Уйти в навь (active=true) или вернуться в явь. Только по прямой просьбе хозяйки: в нави серии заморожены, привычки молчат, план пуст.',
    inputSchema: { type: 'object', properties: { active: { type: 'boolean' } }, required: ['active'], additionalProperties: false },
    writes: true,
    run: (a, c) => {
      if (typeof a.active !== 'boolean') throw new AgentError('нужен active: true или false')
      c.apply(A.setNav.type, { active: a.active, at: c.at, day: c.today })
      return c.get().meta.nav
    },
  },
  {
    name: 'grimoire_wheel',
    description: 'Колесо года: текущий отрезок или указанный саббат, его даты и практики (сначала отмеченные «хочу», особенно если отрезок скоро закончится).',
    inputSchema: { type: 'object', properties: { sabbat: { type: 'string', enum: sabbatOrder } }, additionalProperties: false },
    writes: false,
    run: (a, c) => {
      const g = c.get()
      const now = wheelNow(c.today, g.meta.hemisphere)
      const s = oneOf(a, 'sabbat', sabbatOrder) ?? now.current.sabbat
      const seg = segmentOf(s, c.today, g.meta.hemisphere)
      const wanted = new Set(Object.values(g.wishes).filter((w) => w.practiceId && (w.status === 'dream' || w.status === 'inProgress')).map((w) => w.practiceId))
      return {
        sabbat: sabbats[s].name,
        theme: sabbats[s].theme,
        from: seg.from,
        to: seg.to,
        notes: g.meta.sabbatNotes[s] ?? null,
        practices: Object.values(g.practices)
          .filter((p) => p.sabbat === s && !p.hidden)
          .sort((x, y) => Number(wanted.has(y.id)) - Number(wanted.has(x.id)))
          .map((p) => ({ id: p.id, title: p.title, mode: p.mode, seasonal: !!p.seasonal, want: wanted.has(p.id) })),
      }
    },
  },
  {
    name: 'grimoire_practice_to_task',
    description: 'Превратить практику колеса года в дело: в бэклог или на день (doOn).',
    inputSchema: { type: 'object', properties: { practiceId: { type: 'string' }, doOn: day }, required: ['practiceId'], additionalProperties: false },
    writes: true,
    run: (a, c) => {
      const id = str(a, 'practiceId', true)!
      if (!c.get().practices[id]) throw new AgentError('нет такой практики')
      const taskId = nanoid()
      c.apply(A.practiceToTask.type, { practiceId: id, doOn: dayArg(a, 'doOn'), taskId, at: c.at, day: c.today })
      return view(c.get().tasks[taskId], c)
    },
  },
]

export const agentTools: ToolDef[] = tools.map(({ name, description, inputSchema, writes, destructive }) => ({ name, description, inputSchema, writes, destructive }))

/** Runs one tool. Throws AgentError for bad arguments; the state is returned unchanged then. */
export function runTool(name: string, args: Args | undefined, ctx: AgentContext): ToolOutcome {
  const tool = tools.find((t) => t.name === name)
  if (!tool) throw new AgentError(`нет инструмента ${name}`)
  let state = ctx.state
  const meta = state.meta
  const c: Ctx = {
    ...ctx,
    today: dayKeyIn(ctx.now, meta.dayBoundaryHour, meta.timeZone),
    at: ctx.now.toISOString(),
    get: () => state,
    apply: (type, payload) => {
      state = reducer(state, { type, payload })
    },
  }
  const result = tool.run(args ?? {}, c)
  return { state, result }
}

/** Shown to the assistant when it connects (MCP `instructions`). */
export const agentInstructions = `Это «Гримуар дел» — личный планировщик ведьмы. Задача гримуара не управлять делами, а снизить сопротивление: противное дело делать выгодно и немного смешно.

Как работать:
- Каждую сводку начинай с grimoire_today. Если nav.active — хозяйка в нави: никаких планов, проверок и напоминаний; nav.agent = hello — только мягкое «я тут», silent — ничего. Единственное исключение — дела из evenInNav.
- Дни считаются по границе дня хозяйки (часовой пояс и час в настройках); даты — YYYY-MM-DD.
- Не штрафуй и не дави: просрочек нет, невыполненное уходит на утренний разбор или в бэклог. Предлагай, а не требуй. План дня маленький: по умолчанию одно главное и одно необязательное, а звёзд сложности — не больше dayStars.limit; при превышении любого лимита (warning) спроси, что убрать.
- Меняй дела только по словам хозяйки: «сделала», «перенеси», «добавь». Не отмечай выполненным то, о чём она не сказала.
- Буксующее дело (stuck) — повод расколоть, уменьшить, отпустить или свериться с «хочу / надо» и «чья обязанность», а не напомнить ещё раз.
- Чудовища (dread 3) сами в план не лезут: предлагай их только когда хозяйка готова.
- Жаба (frog) — дело, которое очень не хочется или которое откладывали 3+ раза; платит в полтора раза больше. Когда энергии хватает, можно предложить одну жабу на день, без стыда и без списка «позора».
- Монеты начисляются сами по формуле; руками их не считай.`

