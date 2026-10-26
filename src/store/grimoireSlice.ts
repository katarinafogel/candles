// All grimoire operations. Business rules live here, like the workshop's in dataSlice: the database
// only stores the result. Every action that depends on «now» carries the moment and the grimoire day
// in its payload (filled in by `prepare`), so the reducers stay pure and testable.
import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import { defaultCoinRules, taskCoins } from '../grimoire/coins.ts'
import { dayKey, nextRepeat } from '../grimoire/days.ts'
import { habitLogId, habitTaskId, isDone, isScheduled, navTest, newMilestones, streak } from '../grimoire/habits.ts'
import type {
  CoinTx,
  DayKey,
  GrimoireMeta,
  GrimoireState,
  Habit,
  JournalEntry,
  Wish,
  PostponeReason,
  Project,
  Task,
  TaskSlot,
  WheelPractice,
} from '../grimoire/types.ts'

export const defaultMeta: GrimoireMeta = {
  coins: defaultCoinRules,
  dayBoundaryHour: 4,
  hemisphere: 'north',
  planLimit: { main: 1, extra: 0, optional: 1 },
  streaksOn: true,
  timersOn: false,
  gameWords: true,
  zones: ['кухня', 'ванная', 'спальня', 'шкаф', 'балкон', 'мастерская'],
  tagColors: {},
  emotions: ['тревога', 'радость', 'усталость', 'злость', 'спокойствие', 'грусть', 'вдохновение'],
  factors: ['сон', 'работа', 'люди', 'погода', 'тело', 'деньги'],
  sabbatNotes: {},
  nav: { active: false, history: [] },
}

export const initialGrimoire: GrimoireState = {
  tasks: {},
  projects: {},
  habits: {},
  habitLogs: {},
  wishes: {},
  practices: {},
  journal: {},
  jars: {},
  jarTxs: {},
  coinTxs: {},
  meta: defaultMeta,
}

/** Fills in fields added after the data was saved; safe to run again on fresh data. */
export function migrateGrimoire(input: Partial<GrimoireState> | undefined): GrimoireState {
  const m = (input?.meta ?? {}) as Partial<GrimoireMeta>
  return {
    ...initialGrimoire,
    ...input,
    meta: {
      ...defaultMeta,
      ...m,
      coins: { ...defaultCoinRules, ...m.coins },
      planLimit: { ...defaultMeta.planLimit, ...m.planLimit },
      nav: { ...defaultMeta.nav, ...m.nav },
    },
  }
}

// ---------- helpers on the draft ----------

type S = GrimoireState

const isOpen = (t: Task) => t.status !== 'done' && t.status !== 'cancelled'

function pay(s: S, at: string, day: DayKey, amount: number, tx: Omit<CoinTx, 'id' | 'at' | 'day' | 'amount'>) {
  if (!amount) return
  const id = nanoid()
  s.coinTxs[id] = { id, at, day, amount, ...tx }
}

/** Coins standing for closing a task (everything except the «начать понемногу» coins). */
const completionNet = (s: S, taskId: string) =>
  Object.values(s.coinTxs).reduce((sum, x) => (x.refId === taskId && x.tag !== 'started' ? sum + x.amount : sum), 0)

/** Brings the coins paid for a task to `target`, writing a payment or a reversal. */
function settle(s: S, t: Task, at: string, day: DayKey, target: number, tag: CoinTx['tag'], reason: string) {
  const diff = target - completionNet(s, t.id)
  if (!diff) return
  pay(s, at, day, diff, { reason: diff < 0 ? `отмена: ${t.title}` : reason, tag: diff < 0 ? 'undo' : tag, refKind: 'task', refId: t.id })
}

const boundaryDay = (s: S) => (iso: string) => dayKey(new Date(iso), s.meta.dayBoundaryHour)

/** A quest closes itself once every step is done, and reopens when a step is undone. */
function syncParent(s: S, parentId: string | undefined, at: string, day: DayKey) {
  const parent = parentId ? s.tasks[parentId] : undefined
  if (!parent) return
  const steps = Object.values(s.tasks).filter((t) => t.parentId === parent.id && t.status !== 'cancelled')
  const allDone = steps.length > 0 && steps.every((t) => t.status === 'done')
  if (allDone && parent.status !== 'done') {
    parent.status = 'done'
    parent.doneAt = at
    parent.doneDay = day
    settle(s, parent, at, day, s.meta.coins.complexBonus, 'complex', `квест завершён: ${parent.title}`)
  } else if (!allDone && parent.status === 'done') {
    parent.status = 'open'
    delete parent.doneAt
    delete parent.doneDay
    settle(s, parent, at, day, 0, 'undo', '')
  }
}

function markHabit(s: S, t: Task, at: string, day: DayKey, done: boolean) {
  const h = t.habitId ? s.habits[t.habitId] : undefined
  if (!h || !t.doOn) return
  const id = habitLogId(h.id, t.doOn)
  if (!done) {
    delete s.habitLogs[id]
    return
  }
  s.habitLogs[id] = { id, habitId: h.id, date: t.doOn, value: h.mark.kind === 'count' ? h.mark.goal : 1 }
  payStreak(s, h, at, day)
}

/** Pays streak milestones (7 / 30 / 100 days); a broken streak can earn them again. */
function payStreak(s: S, h: Habit, at: string, day: DayKey) {
  if (!s.meta.streaksOn) return
  const { current } = streak(h, s.habitLogs, day, navTest(s.meta, boundaryDay(s)))
  const kept = (h.paidMilestones ?? []).filter((m) => m <= current)
  for (const m of newMilestones({ ...h, paidMilestones: kept }, current, s.meta.coins.streakBonus)) {
    pay(s, at, day, m.coins, { reason: `серия ${m.days} дней: ${h.title}`, tag: 'streak', refKind: 'habit', refId: h.id })
    kept.push(m.days)
  }
  h.paidMilestones = kept.sort((a, b) => a - b)
}

/** A wish made real by a task goes to the hall of fame when the task is done, and back if undone. */
function syncWish(s: S, t: Task, at: string, day: DayKey, done: boolean) {
  const w = t.wishId ? s.wishes[t.wishId] : undefined
  if (!w) return
  const net = Object.values(s.coinTxs).reduce((sum, x) => (x.refId === w.id ? sum + x.amount : sum), 0)
  if (done && w.status !== 'fulfilled') {
    w.status = 'fulfilled'
    w.fulfilledAt = at
    pay(s, at, day, s.meta.coins.wishBonus - net, { reason: `мечта сбылась: ${w.title}`, tag: 'wish', refKind: 'wish', refId: w.id })
  } else if (!done && w.status === 'fulfilled') {
    w.status = 'inProgress'
    delete w.fulfilledAt
    pay(s, at, day, -net, { reason: `отмена: ${w.title}`, tag: 'undo', refKind: 'wish', refId: w.id })
  }
}

/** A repeating deed comes back once it is done: one next copy, never two (the id says which day). */
function spawnRepeat(s: S, t: Task, at: string, day: DayKey) {
  if (!t.repeat || t.habitId) return
  const next = nextRepeat(t.doOn && t.doOn > day ? t.doOn : day, t.repeat)
  const root = t.repeatOf ?? t.id
  const id = `${root}@${next}`.slice(0, 64)
  if (s.tasks[id]) return
  s.tasks[id] = newTask(
    {
      ...t,
      id,
      repeatOf: root,
      doOn: next,
      status: 'open',
      postponements: [],
      doneAt: undefined,
      doneDay: undefined,
      startedPaid: undefined,
      partialNote: undefined,
      createdAt: at,
      dueAt: undefined,
    },
    at,
  )
}

function newTask(fields: Partial<Task> & { title: string }, at: string): Task {
  return {
    type: 'deed',
    stars: 1,
    dread: 0,
    tags: [],
    status: 'open',
    source: 'manual',
    postponements: [],
    ...fields,
    id: fields.id ?? nanoid(),
    title: fields.title.trim().slice(0, 200),
    createdAt: fields.createdAt ?? at,
  }
}

// ---------- payloads ----------

interface When {
  at: string
  day: DayKey
}

// The day boundary from the settings, kept in step by the store (see store/index.ts), so that the
// action creators can stamp the right grimoire day without every caller passing it.
let boundaryHour = defaultMeta.dayBoundaryHour
export const setDayBoundary = (h: number) => {
  boundaryHour = h
}
/** Today in the grimoire's terms, with the current day boundary. */
export const today = (at: Date = new Date()) => dayKey(at, boundaryHour)

/** Adds `at` and `day` to a payload. */
const when = <P extends object>(p: P & { boundary?: number; at?: string; day?: DayKey }): P & When => {
  const at = p.at ?? new Date().toISOString()
  return { ...p, at, day: p.day ?? dayKey(new Date(at), p.boundary ?? boundaryHour) }
}

const slice = createSlice({
  name: 'grimoire',
  initialState: initialGrimoire,
  reducers: {
    replaceAll: (_s, a: PayloadAction<GrimoireState>) => a.payload,
    /** «Отменить»: puts back the state from before a step. */
    restore: (_s, a: PayloadAction<GrimoireState>) => a.payload,

    updateMeta(s, a: PayloadAction<Partial<GrimoireMeta>>) {
      Object.assign(s.meta, a.payload)
    },

    // ----- tasks -----
    addTask: {
      reducer(s, a: PayloadAction<{ fields: Partial<Task> & { title: string } } & When>) {
        const t = newTask(a.payload.fields, a.payload.at)
        s.tasks[t.id] = t
      },
      prepare: (p: { fields: Partial<Task> & { title: string }; boundary?: number }) => ({
        payload: when({ ...p, fields: { ...p.fields, id: p.fields.id ?? nanoid() } }),
      }),
    },
    updateTask(s, a: PayloadAction<Partial<Task> & { id: string }>) {
      const t = s.tasks[a.payload.id]
      if (!t) return
      Object.assign(t, a.payload)
      if (t.title) t.title = t.title.trim().slice(0, 200)
    },
    deleteTask(s, a: PayloadAction<string>) {
      const t = s.tasks[a.payload]
      if (!t) return
      delete s.tasks[a.payload]
      for (const o of Object.values(s.tasks)) {
        if (o.blockedBy?.includes(t.id)) o.blockedBy = o.blockedBy.filter((x) => x !== t.id)
        if (o.parentId === t.id) delete o.parentId
      }
    },

    completeTask: {
      reducer(s, a: PayloadAction<{ id: string; partial?: boolean; note?: string } & When>) {
        const { id, partial, note, at, day } = a.payload
        const t = s.tasks[id]
        if (!t) return
        const coins = taskCoins(t, day, s.meta.coins, partial)
        if (partial) {
          t.status = 'partial'
          if (note) t.partialNote = note
          settle(s, t, at, day, coins.total, 'partial', `часть дела: ${t.title}`)
          return
        }
        t.status = 'done'
        t.doneAt = at
        t.doneDay = day
        settle(s, t, at, day, coins.total, 'done', t.title)
        markHabit(s, t, at, day, true)
        syncParent(s, t.parentId, at, day)
        syncWish(s, t, at, day, true)
        spawnRepeat(s, t, at, day)
      },
      prepare: (p: { id: string; partial?: boolean; note?: string; boundary?: number }) => ({ payload: when(p) }),
    },
    /** Takes a done (or partly done) task back: the coins go back with a reverse entry. */
    reopenTask: {
      reducer(s, a: PayloadAction<{ id: string } & When>) {
        const { id, at, day } = a.payload
        const t = s.tasks[id]
        if (!t) return
        const wasDone = t.status === 'done'
        t.status = 'open'
        delete t.doneAt
        delete t.doneDay
        settle(s, t, at, day, 0, 'undo', '')
        if (wasDone) {
          markHabit(s, t, at, day, false)
          syncParent(s, t.parentId, at, day)
          syncWish(s, t, at, day, false)
        }
      },
      prepare: (p: { id: string; boundary?: number }) => ({ payload: when(p) }),
    },
    /** «Начать понемногу»: an honestly started deed earns a little even if it isn't finished. */
    startTask: {
      reducer(s, a: PayloadAction<{ id: string } & When>) {
        const { id, at, day } = a.payload
        const t = s.tasks[id]
        if (!t || !isOpen(t)) return
        t.status = 'inProgress'
        if (!t.startedPaid) {
          t.startedPaid = true
          pay(s, at, day, s.meta.coins.startedCoins, { reason: `начато: ${t.title}`, tag: 'started', refKind: 'task', refId: t.id })
        }
      },
      prepare: (p: { id: string; boundary?: number }) => ({ payload: when(p) }),
    },
    cancelTask(s, a: PayloadAction<string>) {
      const t = s.tasks[a.payload]
      if (t && isOpen(t)) t.status = 'cancelled'
    },
    setWaiting(s, a: PayloadAction<{ id: string; until?: DayKey; note?: string }>) {
      const t = s.tasks[a.payload.id]
      if (!t) return
      t.status = 'waiting'
      t.waitUntil = a.payload.until
      if (a.payload.note) t.partialNote = a.payload.note
      delete t.doOn
    },

    /** Chooses a task for a day (or sends it back to the backlog with `day` empty). */
    planTask(s, a: PayloadAction<{ id: string; day?: DayKey; slot?: TaskSlot }>) {
      const t = s.tasks[a.payload.id]
      if (!t) return
      if (a.payload.day) {
        t.doOn = a.payload.day
        t.slot = a.payload.slot ?? t.slot ?? 'extra'
        if (t.status === 'waiting') t.status = 'open'
      } else {
        delete t.doOn
      }
    },
    /** A postponement is remembered with its day and optional reason, without judgement. */
    postponeTask: {
      reducer(s, a: PayloadAction<{ id: string; to?: DayKey; reason?: PostponeReason } & When>) {
        const { id, to, reason, at, day } = a.payload
        const t = s.tasks[id]
        if (!t) return
        t.postponements.push({ at, day: t.doOn ?? day, ...(to ? { to } : {}), ...(reason ? { reason } : {}) })
        if (to) t.doOn = to
        else delete t.doOn
      },
      prepare: (p: { id: string; to?: DayKey; reason?: PostponeReason; boundary?: number }) => ({ payload: when(p) }),
    },
    /** Morning review «всё в бэклог» and «на сегодня всё»: no penalty, no questions. */
    toBacklog(s, a: PayloadAction<string[]>) {
      for (const id of a.payload) {
        const t = s.tasks[id]
        if (t && isOpen(t)) delete t.doOn
      }
    },
    markReviewed(s, a: PayloadAction<DayKey>) {
      s.meta.reviewedDay = a.payload
    },
    /** «Потянуло за собой…»: a new task grows out of this one and blocks it until done. */
    spawnTask: {
      reducer(s, a: PayloadAction<{ fromId: string; fields: Partial<Task> & { title: string } } & When>) {
        const from = s.tasks[a.payload.fromId]
        if (!from) return
        const t = newTask(
          {
            stars: from.stars,
            dread: from.dread,
            tags: [...from.tags],
            personIds: from.personIds,
            doOn: from.doOn,
            slot: from.slot,
            ...a.payload.fields,
            spawnedFrom: from.id,
          },
          a.payload.at,
        )
        s.tasks[t.id] = t
        from.blockedBy = [...(from.blockedBy ?? []), t.id]
        // The origin waits for its tail; the tail takes its place in today's plan.
        delete from.doOn
      },
      prepare: (p: { fromId: string; fields: Partial<Task> & { title: string }; boundary?: number }) => ({
        payload: when({ ...p, fields: { ...p.fields, id: p.fields.id ?? nanoid() } }),
      }),
    },
    /** «Расколоть»: turns a task into a quest with steps; only the first step goes into the plan. */
    splitTask: {
      reducer(s, a: PayloadAction<{ id: string; steps: string[] } & When>) {
        const t = s.tasks[a.payload.id]
        if (!t) return
        a.payload.steps.forEach((title, i) => {
          const step = newTask(
            { title, stars: t.stars, dread: t.dread, tags: [...t.tags], parentId: t.id, projectId: t.projectId, order: i, source: t.source, ...(i === 0 && t.doOn ? { doOn: t.doOn, slot: t.slot } : {}) },
            a.payload.at,
          )
          s.tasks[step.id] = step
        })
        delete t.doOn
      },
      prepare: (p: { id: string; steps: string[]; boundary?: number }) => ({ payload: when(p) }),
    },

    // ----- «уйти в навь» -----
    setNav: {
      reducer(s, a: PayloadAction<{ active: boolean } & When>) {
        const nav = s.meta.nav
        if (a.payload.active === nav.active) return
        if (a.payload.active) {
          nav.active = true
          nav.since = a.payload.at
        } else {
          nav.history.push({ from: nav.since ?? a.payload.at, to: a.payload.at })
          nav.active = false
          delete nav.since
        }
      },
      prepare: (p: { active: boolean }) => ({ payload: when(p) }),
    },

    // ----- coins -----
    addCoins: {
      reducer(s, a: PayloadAction<{ amount: number; reason: string } & When>) {
        pay(s, a.payload.at, a.payload.day, Math.round(a.payload.amount), { reason: a.payload.reason, tag: 'manual', refKind: 'manual' })
      },
      prepare: (p: { amount: number; reason: string; boundary?: number }) => ({ payload: when(p) }),
    },

    // ----- habits -----
    upsertHabit: {
      reducer(s, a: PayloadAction<{ habit: Omit<Habit, 'id' | 'createdAt' | 'shields'> & Partial<Pick<Habit, 'id' | 'createdAt' | 'shields'>> } & When>) {
        const { habit, at, day } = a.payload
        const id = habit.id ?? nanoid()
        const prev = s.habits[id]
        const h: Habit = { ...prev, ...habit, id, shields: habit.shields ?? prev?.shields ?? 0, createdAt: prev?.createdAt ?? habit.createdAt ?? at }
        s.habits[id] = h
        // Today's task follows the habit at once: created, renamed or dropped.
        const tid = habitTaskId(id, day)
        const t = s.tasks[tid]
        if (isScheduled(h, day) && !s.meta.nav.active) {
          if (!t) s.tasks[tid] = newTask({ id: tid, title: h.title, stars: h.stars, dread: h.dread, habitId: id, source: 'habit', doOn: day }, at)
          else if (isOpen(t)) Object.assign(t, { title: h.title, stars: h.stars, dread: h.dread })
        } else if (t && isOpen(t)) {
          delete s.tasks[tid]
        }
      },
      prepare: (p: { habit: Omit<Habit, 'id' | 'createdAt' | 'shields'> & Partial<Pick<Habit, 'id' | 'createdAt' | 'shields'>>; boundary?: number }) => ({
        payload: when({ ...p, habit: { ...p.habit, id: p.habit.id ?? nanoid() } }),
      }),
    },
    deleteHabit(s, a: PayloadAction<string>) {
      delete s.habits[a.payload]
      for (const t of Object.values(s.tasks)) if (t.habitId === a.payload && isOpen(t)) delete s.tasks[t.id]
    },
    /** A count habit (8 glasses, 20 pages): the day's value; reaching the goal closes the task. */
    setHabitValue: {
      reducer(s, a: PayloadAction<{ habitId: string; date: DayKey; value: number } & When>) {
        const { habitId, date, value, at, day } = a.payload
        const h = s.habits[habitId]
        if (!h) return
        const id = habitLogId(habitId, date)
        if (value <= 0) delete s.habitLogs[id]
        else s.habitLogs[id] = { id, habitId, date, value }
        const t = s.tasks[habitTaskId(habitId, date)]
        const done = isDone(h, s.habitLogs[id])
        if (t && done && t.status !== 'done') {
          t.status = 'done'
          t.doneAt = at
          t.doneDay = day
          settle(s, t, at, day, taskCoins(t, day, s.meta.coins).total, 'done', t.title)
          payStreak(s, h, at, day)
        } else if (t && !done && t.status === 'done') {
          t.status = 'open'
          delete t.doneAt
          delete t.doneDay
          settle(s, t, at, day, 0, 'undo', '')
        }
      },
      prepare: (p: { habitId: string; date: DayKey; value: number; boundary?: number }) => ({ payload: when(p) }),
    },
    /** Once a day: yesterday's unticked habit tasks quietly leave the scroll as skips, today's appear. */
    generateHabitTasks: {
      reducer(s, a: PayloadAction<When>) {
        const { at, day } = a.payload
        // In «навь» habits make no tasks and write no skips.
        if (s.meta.nav.active) return
        for (const t of Object.values(s.tasks)) {
          if (!t.habitId || !t.doOn || t.doOn >= day || !isOpen(t)) continue
          const id = habitLogId(t.habitId, t.doOn)
          if (!s.habitLogs[id] && s.habits[t.habitId]) s.habitLogs[id] = { id, habitId: t.habitId, date: t.doOn, value: 0, skipped: true }
          delete s.tasks[t.id]
        }
        for (const h of Object.values(s.habits)) {
          if (!isScheduled(h, day)) continue
          if (h.schedule.kind === 'timesPerWeek') {
            // Offered every day until the week's count is reached.
            const ws = new Date(`${day}T12:00:00Z`)
            const monday = new Date(ws.getTime() - (((ws.getUTCDay() + 6) % 7) * 86_400_000)).toISOString().slice(0, 10)
            const doneThisWeek = Object.values(s.habitLogs).filter((l) => l.habitId === h.id && l.date >= monday && l.date < day && isDone(h, l)).length
            if (doneThisWeek >= h.schedule.n) continue
          }
          const tid = habitTaskId(h.id, day)
          if (s.tasks[tid] || isDone(h, s.habitLogs[habitLogId(h.id, day)])) continue
          s.tasks[tid] = newTask({ id: tid, title: h.title, stars: h.stars, dread: h.dread, habitId: h.id, source: 'habit', doOn: day }, at)
        }
        s.meta.habitsGeneratedFor = day
      },
      prepare: (p: { boundary?: number } = {}) => ({ payload: when(p) }),
    },
    buyShield: {
      reducer(s, a: PayloadAction<{ habitId: string; price: number } & When>) {
        const h = s.habits[a.payload.habitId]
        if (!h) return
        h.shields += 1
        pay(s, a.payload.at, a.payload.day, -Math.abs(a.payload.price), { reason: `оберег: ${h.title}`, tag: 'manual', refKind: 'habit', refId: h.id })
      },
      prepare: (p: { habitId: string; price: number; boundary?: number }) => ({ payload: when(p) }),
    },

    // ----- projects -----
    upsertProject: {
      reducer(s, a: PayloadAction<{ project: Omit<Project, 'id' | 'createdAt'> & { id?: string } } & When>) {
        const id = a.payload.project.id ?? nanoid()
        s.projects[id] = { ...s.projects[id], ...a.payload.project, id, createdAt: s.projects[id]?.createdAt ?? a.payload.at }
      },
      prepare: (p: { project: Omit<Project, 'id' | 'createdAt'> & { id?: string } }) => ({
        payload: when({ ...p, project: { ...p.project, id: p.project.id ?? nanoid() } }),
      }),
    },

    // ----- journal («Зеркало») -----
    /**
     * A journal entry: a mood mark, a text, or both. +2 coins for the day's first entry, +1 for a
     * «как далось?» feedback. The marks themselves never pay, so there is no reason to prettify them.
     */
    addJournal: {
      reducer(s, a: PayloadAction<{ entry: Omit<JournalEntry, 'at' | 'day'> } & When>) {
        const { entry, at, day } = a.payload
        const e: JournalEntry = { ...entry, at, day }
        s.journal[e.id] = e
        if (e.type === 'taskFeedback') {
          pay(s, at, day, 1, { reason: 'отклик на дело', tag: 'journal', refKind: 'journal', refId: e.id })
        } else if (!Object.values(s.coinTxs).some((x) => x.tag === 'journal' && x.day === day && x.reason === 'запись в зеркале')) {
          pay(s, at, day, 2, { reason: 'запись в зеркале', tag: 'journal', refKind: 'journal', refId: e.id })
        }
      },
      prepare: (p: { entry: Omit<JournalEntry, 'at' | 'day' | 'id'> & { id?: string }; at?: string }) => ({
        payload: when({ ...p, entry: { ...p.entry, id: p.entry.id ?? nanoid() } }),
      }),
    },
    updateJournal(s, a: PayloadAction<Partial<JournalEntry> & { id: string }>) {
      const e = s.journal[a.payload.id]
      if (e) Object.assign(e, a.payload)
    },
    deleteJournal(s, a: PayloadAction<string>) {
      delete s.journal[a.payload]
    },

    // ----- wishes -----
    upsertWish: {
      reducer(s, a: PayloadAction<{ wish: Omit<Wish, 'createdAt' | 'status'> & Partial<Pick<Wish, 'createdAt' | 'status'>> } & When>) {
        const w = a.payload.wish
        const prev = s.wishes[w.id]
        s.wishes[w.id] = { ...prev, ...w, status: w.status ?? prev?.status ?? 'dream', createdAt: prev?.createdAt ?? w.createdAt ?? a.payload.at }
      },
      prepare: (p: { wish: Omit<Wish, 'id' | 'createdAt' | 'status'> & Partial<Pick<Wish, 'id' | 'createdAt' | 'status'>> }) => ({
        payload: when({ ...p, wish: { ...p.wish, id: p.wish.id ?? nanoid() } }),
      }),
    },
    deleteWish(s, a: PayloadAction<string>) {
      delete s.wishes[a.payload]
      for (const t of Object.values(s.tasks)) if (t.wishId === a.payload) delete t.wishId
    },
    /** «Воплотить»: the wish becomes a deed; when the deed is done the wish goes to the hall of fame. */
    wishToTask: {
      reducer(s, a: PayloadAction<{ wishId: string; taskId: string; fields: Partial<Task> } & When>) {
        const w = s.wishes[a.payload.wishId]
        if (!w) return
        const t = newTask({ title: w.title, tags: [...w.tags], source: 'wish', want: 'want', ...a.payload.fields, id: a.payload.taskId, wishId: w.id }, a.payload.at)
        s.tasks[t.id] = t
        w.status = 'inProgress'
        w.taskId = t.id
      },
      prepare: (p: { wishId: string; fields?: Partial<Task> }) => ({ payload: when({ ...p, fields: p.fields ?? {}, taskId: nanoid() }) }),
    },
    /** Came true by itself, or by hand: into the hall of fame with a photo-less note. */
    fulfillWish: {
      reducer(s, a: PayloadAction<{ id: string; note?: string } & When>) {
        const w = s.wishes[a.payload.id]
        if (!w || w.status === 'fulfilled') return
        w.status = 'fulfilled'
        w.fulfilledAt = a.payload.at
        if (a.payload.note) w.fulfilledNote = a.payload.note
        pay(s, a.payload.at, a.payload.day, s.meta.coins.wishBonus, { reason: `мечта сбылась: ${w.title}`, tag: 'wish', refKind: 'wish', refId: w.id })
      },
      prepare: (p: { id: string; note?: string }) => ({ payload: when(p) }),
    },
    releaseWish(s, a: PayloadAction<string>) {
      const w = s.wishes[a.payload]
      if (w && w.status !== 'fulfilled') w.status = 'released'
    },

    // ----- wheel of the year -----
    seedPractices(s, a: PayloadAction<WheelPractice[]>) {
      if (s.meta.practicesSeeded) return
      for (const p of a.payload) if (!s.practices[p.id]) s.practices[p.id] = p
      s.meta.practicesSeeded = true
    },
    upsertPractice(s, a: PayloadAction<Omit<WheelPractice, 'id'> & { id?: string }>) {
      const id = a.payload.id ?? nanoid()
      s.practices[id] = { ...a.payload, id }
    },
    deletePractice(s, a: PayloadAction<string>) {
      delete s.practices[a.payload]
    },
    /** «Хочу»: the practice becomes a wish tied to its segment; it comes back each turn of the wheel. */
    wantPractice: {
      reducer(s, a: PayloadAction<{ practiceId: string } & When>) {
        const p = s.practices[a.payload.practiceId]
        if (!p) return
        if (Object.values(s.wishes).some((w) => w.practiceId === p.id && (w.status === 'dream' || w.status === 'inProgress'))) return
        const id = nanoid()
        s.wishes[id] = { id, title: p.title, tags: [], status: 'dream', createdAt: a.payload.at, practiceId: p.id, sabbat: p.sabbat }
      },
      prepare: (p: { practiceId: string }) => ({ payload: when(p) }),
    },
    unwantPractice(s, a: PayloadAction<string>) {
      for (const w of Object.values(s.wishes)) if (w.practiceId === a.payload && w.status === 'dream') delete s.wishes[w.id]
    },
    /** «В дела»: a task made from a practice, into the backlog or onto a day. */
    practiceToTask: {
      reducer(s, a: PayloadAction<{ practiceId: string; doOn?: DayKey; taskId: string } & When>) {
        const p = s.practices[a.payload.practiceId]
        if (!p) return
        const wish = Object.values(s.wishes).find((w) => w.practiceId === p.id && w.status === 'dream')
        const t = newTask(
          {
            id: a.payload.taskId,
            title: p.title,
            note: [p.description, ...(p.steps ?? []).map((x, i) => `${i + 1}. ${x}`)].filter(Boolean).join('\n') || undefined,
            source: 'wheel',
            practiceId: p.id,
            tags: [p.seasonal ? 'сезонное' : 'колесо'],
            doOn: a.payload.doOn,
            ...(a.payload.doOn ? { slot: 'optional' as const } : {}),
            ...(wish ? { want: 'want' as const, wishId: wish.id } : {}),
          },
          a.payload.at,
        )
        s.tasks[t.id] = t
        if (wish) {
          wish.status = 'inProgress'
          wish.taskId = t.id
        }
      },
      prepare: (p: { practiceId: string; doOn?: DayKey }) => ({ payload: when({ ...p, taskId: nanoid() }) }),
    },
  },
})

export const grimoireActions = slice.actions
export default slice.reducer
