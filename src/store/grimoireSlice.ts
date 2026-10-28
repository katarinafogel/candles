// All grimoire operations. Business rules live here, like the workshop's in dataSlice: the database
// only stores the result. Every action that depends on «now» carries the moment and the grimoire day
// in its payload (filled in by `prepare`), so the reducers stay pure and testable.
import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import { defaultCoinRules, taskCoins } from '../grimoire/coins.ts'
import { cleanWords } from '../grimoire/emotions.ts'
import { dayKey, nextRepeat } from '../grimoire/days.ts'
import { habitLogId, habitTaskId, isDone, isScheduled, navTest, newMilestones, streak } from '../grimoire/habits.ts'
import type {
  CoinTx,
  DayKey,
  GrimoireMeta,
  GrimoireState,
  Habit,
  Jar,
  JournalEntry,
  Wish,
  PostponeReason,
  Project,
  Task,
  TaskSlot,
  WheelPractice,
  PersonLine,
  PersonList,
  PersonNotes,
  WorkshopKind,
  CycleEntry,
} from '../grimoire/types.ts'

export const defaultMeta: GrimoireMeta = {
  coins: defaultCoinRules,
  dayBoundaryHour: 4,
  hemisphere: 'north',
  planLimit: { main: 1, extra: 0, optional: 1 },
  dayStars: 6,
  streaksOn: true,
  timersOn: false,
  gameWords: true,
  zones: ['кухня', 'ванная', 'спальня', 'шкаф', 'балкон', 'мастерская'],
  tagColors: {},
  frogPostpones: 3,
  emotionAsk: 'hard',
  eveningAt: '21:00',
  spells: [],
  circles: ['семья', 'друзья', 'работа', 'ковен', 'знакомые'],
  cycleToAgent: true,
  notify: { morning: '09:00', afternoon: '', evening: true, deadlines: true, sabbats: true },
  tone: { praise: 'normal', motion: 'soft' },
  sabbatNotes: {},
  sabbatCards: {},
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
  personNotes: {},
  cycles: {},
  meta: defaultMeta,
}

/** Fills in fields added after the data was saved; safe to run again on fresh data. */
export function migrateGrimoire(input: Partial<GrimoireState> | undefined): GrimoireState {
  const m = (input?.meta ?? {}) as Partial<GrimoireMeta>
  const meta0 = { ...defaultMeta, ...m }
  // Deeds saved before frogs existed become frogs by the same rules, once.
  const tasks = Object.fromEntries(
    Object.entries(input?.tasks ?? {}).map(([id, t]) => {
      if (t.frog !== undefined || !isOpen(t)) return [id, t]
      const count = t.postponeCount ?? t.postponements?.length ?? 0
      return [id, { ...t, postponeCount: count, ...(t.dread === 3 || count >= meta0.frogPostpones ? { frog: 'auto' as const } : {}) }]
    }),
  )
  return {
    ...initialGrimoire,
    ...input,
    tasks,
    meta: {
      ...defaultMeta,
      ...m,
      coins: { ...defaultCoinRules, ...m.coins },
      planLimit: { ...defaultMeta.planLimit, ...m.planLimit },
      tone: { ...defaultMeta.tone, ...m.tone },
      nav: { ...defaultMeta.nav, ...m.nav },
      notify: { ...defaultMeta.notify, ...m.notify },
    },
  }
}

// ---------- helpers on the draft ----------

type S = GrimoireState

const isOpen = (t: Task) => t.status !== 'done' && t.status !== 'cancelled'

/**
 * Makes a deed a frog when it qualifies: dread 3 (unless the frog was taken off by hand) or enough
 * postponements (that one wins even over «off»: she put it off again since). Never takes one off.
 */
function frogUp(s: S, t: Task) {
  if (!isOpen(t) || t.frog === 'auto' || t.frog === 'manual') return
  if ((t.frog !== 'off' && t.dread === 3) || (t.postponeCount ?? 0) >= s.meta.frogPostpones) t.frog = 'auto'
}

/** Does `from` wait for `target`, directly or down a chain of «ждёт другое дело»? */
function waitsFor(s: S, from: string, target: string, seen = new Set<string>()): boolean {
  if (seen.has(from)) return false
  seen.add(from)
  return (s.tasks[from]?.blockedBy ?? []).some((b) => b === target || waitsFor(s, b, target, seen))
}

/** One more postponement for the frog count. */
function countPostpone(s: S, t: Task) {
  t.postponeCount = (t.postponeCount ?? 0) + 1
  frogUp(s, t)
}

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
    syncWish(s, parent, at, day, true)
  } else if (!allDone && parent.status === 'done') {
    parent.status = 'open'
    delete parent.doneAt
    delete parent.doneDay
    settle(s, parent, at, day, 0, 'undo', '')
    syncWish(s, parent, at, day, false)
  }
}

/**
 * A book closes itself when its last deed is done (+projectBonus once) and opens again when a deed is
 * undone (`undo`: the bonus goes back). A deed added to a read book reopens it but keeps the bonus.
 */
function syncProject(s: S, projectId: string | undefined, at: string, day: DayKey, undo = false) {
  const p = projectId ? s.projects[projectId] : undefined
  if (!p || p.status === 'archived') return
  const deeds = Object.values(s.tasks).filter((t) => t.projectId === p.id && !t.parentId && t.status !== 'cancelled')
  const allDone = deeds.length > 0 && deeds.every((t) => t.status === 'done')
  const net = Object.values(s.coinTxs).reduce((sum, x) => (x.refKind === 'project' && x.refId === p.id ? sum + x.amount : sum), 0)
  if (allDone && p.status !== 'done') {
    p.status = 'done'
    p.doneAt = at
    pay(s, at, day, s.meta.coins.projectBonus - net, { reason: `книга прочитана: ${p.title}`, tag: 'project', refKind: 'project', refId: p.id })
    fulfillLinked(s, Object.values(s.wishes).find((w) => w.projectId === p.id), at, day, true)
  } else if (!allDone && p.status === 'done') {
    p.status = 'active'
    delete p.doneAt
    if (undo) pay(s, at, day, -net, { reason: `отмена: ${p.title}`, tag: 'undo', refKind: 'project', refId: p.id })
    if (undo) fulfillLinked(s, Object.values(s.wishes).find((w) => w.projectId === p.id), at, day, false)
  }
}

function markHabit(s: S, t: Task, at: string, day: DayKey, done: boolean) {
  const h = t.habitId ? s.habits[t.habitId] : undefined
  if (!h || !t.doOn) return
  const id = habitLogId(h.id, t.doOn)
  if (!done) {
    delete s.habitLogs[id]
    habitToJar(s, h, id, at, day, false)
    return
  }
  s.habitLogs[id] = { id, habitId: h.id, date: t.doOn, value: h.mark.kind === 'count' ? h.mark.goal : 1 }
  habitToJar(s, h, id, at, day, true)
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

/** Coins for a jar half and fully filled, once each. */
export const jarMilestones = [
  { pct: 50, coins: 25 },
  { pct: 100, coins: 100 },
]

export const jarBalance = (s: Pick<S, 'jarTxs'>, jarId: string) => Object.values(s.jarTxs).reduce((sum, x) => (x.jarId === jarId ? sum + x.amount : sum), 0)

/** After money moves: a full jar is «собрана», a milestone pays once; a jar no longer full saves again. */
function syncJar(s: S, jarId: string, at: string, day: DayKey) {
  const j = s.jars[jarId]
  if (!j || j.goal <= 0) return
  const pct = (jarBalance(s, jarId) / j.goal) * 100
  const paid = new Set(j.paidMilestones ?? [])
  for (const m of jarMilestones)
    if (pct >= m.pct && !paid.has(m.pct)) {
      pay(s, at, day, m.coins, { reason: `копилка ${m.pct === 100 ? 'собрана' : 'наполовину'}: ${j.title}`, tag: 'jar', refKind: 'jar', refId: j.id })
      paid.add(m.pct)
    }
  j.paidMilestones = [...paid].sort((a, b) => a - b)
  if (pct >= 100 && j.status === 'saving') j.status = 'collected'
  else if (pct < 100 && j.status === 'collected') j.status = 'saving'
}

/** «Отложить 1000 ₽»: a ticked ritual puts its sum into its jar; unticked, takes it back. */
function habitToJar(s: S, h: Habit, logId: string, at: string, day: DayKey, done: boolean) {
  if (!h.jarId || !h.jarAmount || !s.jars[h.jarId]) return
  const id = `habit:${logId}`
  if (done && !s.jarTxs[id]) s.jarTxs[id] = { id, jarId: h.jarId, at, amount: h.jarAmount, note: h.title, habitLogId: logId }
  else if (!done && s.jarTxs[id]) delete s.jarTxs[id]
  else return
  syncJar(s, h.jarId, at, day)
}

/** A wish made real by a project or a jar comes true when the book is read or the money spent. */
function fulfillLinked(s: S, w: Wish | undefined, at: string, day: DayKey, done: boolean) {
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
      postponeCount: undefined,
      frog: undefined,
      eatOn: undefined,
    },
    at,
  )
  frogUp(s, s.tasks[id])
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
        frogUp(s, t)
        if (!t.parentId) syncProject(s, t.projectId, a.payload.at, a.payload.day)
      },
      prepare: (p: { fields: Partial<Task> & { title: string }; boundary?: number }) => ({
        payload: when({ ...p, fields: { ...p.fields, id: p.fields.id ?? nanoid() } }),
      }),
    },
    updateTask(s, a: PayloadAction<Partial<Task> & { id: string }>) {
      const t = s.tasks[a.payload.id]
      if (!t) return
      const wasIn = t.projectId
      Object.assign(t, a.payload)
      if (t.title) t.title = t.title.trim().slice(0, 200)
      frogUp(s, t)
      if (wasIn !== t.projectId && !t.parentId) {
        // Steps follow their quest into another book.
        for (const st of Object.values(s.tasks)) if (st.parentId === t.id) st.projectId = t.projectId
        const at = new Date().toISOString()
        syncProject(s, wasIn, at, dayKey(new Date(at), s.meta.dayBoundaryHour))
        syncProject(s, t.projectId, at, dayKey(new Date(at), s.meta.dayBoundaryHour))
      }
    },
    /**
     * «Ждёт другое дело» by hand: `id` waits until `blockerId` is closed (or stops waiting). A link that
     * would close a circle (the blocker already waits for this deed, directly or down a chain) is ignored.
     */
    linkBlock(s, a: PayloadAction<{ id: string; blockerId: string; on: boolean }>) {
      const { id, blockerId, on } = a.payload
      const t = s.tasks[id]
      if (!t || !s.tasks[blockerId] || id === blockerId) return
      if (!on) {
        t.blockedBy = (t.blockedBy ?? []).filter((x) => x !== blockerId)
        if (!t.blockedBy.length) delete t.blockedBy
        return
      }
      if (t.blockedBy?.includes(blockerId) || waitsFor(s, blockerId, id)) return
      t.blockedBy = [...(t.blockedBy ?? []), blockerId]
    },
    /** The order of deeds inside a book, as dragged. */
    reorderTasks(s, a: PayloadAction<string[]>) {
      a.payload.forEach((id, i) => {
        if (s.tasks[id]) s.tasks[id].order = i
      })
    },
    /** By hand: make a deed a frog, or take the frog off (the postponement count starts over). */
    setFrog(s, a: PayloadAction<{ id: string; frog: boolean }>) {
      const t = s.tasks[a.payload.id]
      if (!t) return
      if (a.payload.frog) t.frog = 'manual'
      else {
        t.frog = 'off'
        t.postponeCount = 0
        delete t.eatOn
      }
    },
    /** «Съесть сегодня»: a frog promised for a day (or the promise taken back). */
    eatFrog(s, a: PayloadAction<{ id: string; day?: DayKey }>) {
      const t = s.tasks[a.payload.id]
      if (!t) return
      if (a.payload.day) {
        t.eatOn = a.payload.day
        t.doOn = a.payload.day
        t.slot = t.slot ?? 'main'
      } else delete t.eatOn
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
        syncProject(s, t.projectId ?? (t.parentId ? s.tasks[t.parentId]?.projectId : undefined), at, day)
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
          syncProject(s, t.projectId ?? (t.parentId ? s.tasks[t.parentId]?.projectId : undefined), at, day, true)
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
    cancelTask: {
      reducer(s, a: PayloadAction<{ id: string } & When>) {
        const t = s.tasks[a.payload.id]
        if (!t || !isOpen(t)) return
        t.status = 'cancelled'
        // Letting the last open step go closes the quest; the last open deed, the book.
        if (t.parentId) syncParent(s, t.parentId, a.payload.at, a.payload.day)
        else syncProject(s, t.projectId, a.payload.at, a.payload.day)
      },
      prepare: (id: string) => ({ payload: when({ id }) }),
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
        delete t.later
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
        const from = t.doOn ?? day
        t.postponements.push({ at, day: from, ...(to ? { to } : {}), ...(reason ? { reason } : {}) })
        // Only putting it off counts for the frog: to a later day or back to the backlog.
        if (!to || to > from) countPostpone(s, t)
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
    /** Morning review «всё в бэклог»: the same, but it counts as putting off for the frog. */
    reviewToBacklog(s, a: PayloadAction<string[]>) {
      for (const id of a.payload) {
        const t = s.tasks[id]
        if (t && isOpen(t)) {
          delete t.doOn
          countPostpone(s, t)
        }
      }
    },
    /**
     * «Чистый лист» after a long absence: every leftover goes into one «разобрать потом» pack in the
     * backlog — not a postponement, no frog counting, no shame — and the morning review is closed.
     */
    clearSlate(s, a: PayloadAction<{ ids: string[]; day: DayKey }>) {
      for (const id of a.payload.ids) {
        const t = s.tasks[id]
        if (!t || !isOpen(t)) continue
        delete t.doOn
        t.later = a.payload.day
      }
      s.meta.reviewedDay = a.payload.day
      s.meta.welcomedDay = a.payload.day
    },
    /** The «разобрать потом» pack opened: its deeds become ordinary backlog. */
    unpackLater(s, a: PayloadAction<string[]>) {
      for (const id of a.payload) if (s.tasks[id]) delete s.tasks[id].later
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

    // ----- jars: real money, only counted -----
    upsertJar: {
      reducer(s, a: PayloadAction<{ jar: Omit<Jar, 'status'> & Partial<Pick<Jar, 'status'>> } & When>) {
        const { jar, at, day } = a.payload
        const prev = s.jars[jar.id]
        s.jars[jar.id] = { ...prev, ...jar, status: jar.status ?? prev?.status ?? 'saving', createdAt: prev?.createdAt ?? at }
        syncJar(s, jar.id, at, day)
      },
      prepare: (p: { jar: Omit<Jar, 'id' | 'status'> & Partial<Pick<Jar, 'id' | 'status'>> }) => ({ payload: when({ jar: { ...p.jar, id: p.jar.id ?? nanoid() } }) }),
    },
    deleteJar(s, a: PayloadAction<string>) {
      delete s.jars[a.payload]
      for (const x of Object.values(s.jarTxs)) if (x.jarId === a.payload) delete s.jarTxs[x.id]
      for (const h of Object.values(s.habits)) if (h.jarId === a.payload) delete h.jarId
      for (const w of Object.values(s.wishes)) if (w.jarId === a.payload) delete w.jarId
    },
    /** + put in, − taken out. */
    addJarTx: {
      reducer(s, a: PayloadAction<{ jarId: string; amount: number; note?: string; txId: string } & When>) {
        const { jarId, amount, note, txId, at, day } = a.payload
        if (!s.jars[jarId] || !amount) return
        s.jarTxs[txId] = { id: txId, jarId, at, amount, ...(note?.trim() ? { note: note.trim().slice(0, 200) } : {}) }
        syncJar(s, jarId, at, day)
      },
      prepare: (p: { jarId: string; amount: number; note?: string; at?: string }) => ({ payload: when({ ...p, txId: nanoid() }) }),
    },
    deleteJarTx: {
      reducer(s, a: PayloadAction<{ id: string } & When>) {
        const x = s.jarTxs[a.payload.id]
        if (!x) return
        delete s.jarTxs[x.id]
        syncJar(s, x.jarId, a.payload.at, a.payload.day)
      },
      prepare: (id: string) => ({ payload: when({ id }) }),
    },
    /** «Потрачена» makes its wish come true; «закрыта» just puts the jar away. */
    setJarStatus: {
      reducer(s, a: PayloadAction<{ id: string; status: Jar['status'] } & When>) {
        const { id, status, at, day } = a.payload
        const j = s.jars[id]
        if (!j) return
        const was = j.status
        j.status = status
        const wish = j.wishId ? s.wishes[j.wishId] : undefined
        if (status === 'spent') fulfillLinked(s, wish, at, day, true)
        else if (was === 'spent') fulfillLinked(s, wish, at, day, false)
        if (status === 'saving' || status === 'collected') syncJar(s, id, at, day)
      },
      prepare: (p: { id: string; status: Jar['status'] }) => ({ payload: when(p) }),
    },
    /** «Воплотить» into a book: the wish comes true when the book is read. */
    wishToProject: {
      reducer(s, a: PayloadAction<{ wishId: string; projectId: string } & When>) {
        const w = s.wishes[a.payload.wishId]
        if (!w) return
        s.projects[a.payload.projectId] = { id: a.payload.projectId, title: w.title, description: w.description, status: 'active', createdAt: a.payload.at }
        w.status = 'inProgress'
        w.projectId = a.payload.projectId
      },
      prepare: (p: { wishId: string }) => ({ payload: when({ ...p, projectId: nanoid() }) }),
    },
    /** «Воплотить» into a jar: the wish comes true when the money is collected and spent. */
    wishToJar: {
      reducer(s, a: PayloadAction<{ wishId: string; jarId: string; goal: number; targetDate?: DayKey } & When>) {
        const w = s.wishes[a.payload.wishId]
        if (!w) return
        s.jars[a.payload.jarId] = { id: a.payload.jarId, title: w.title, goal: a.payload.goal, currency: '₽', targetDate: a.payload.targetDate, status: 'saving', wishId: w.id, createdAt: a.payload.at }
        w.status = 'inProgress'
        w.jarId = a.payload.jarId
      },
      prepare: (p: { wishId: string; goal: number; targetDate?: DayKey }) => ({ payload: when({ ...p, jarId: nanoid() }) }),
    },

    // ----- the cycle -----
    /** A period started (or one is edited): a start, later its end, how heavy, how it felt. */
    upsertCycle: {
      reducer(s, a: PayloadAction<CycleEntry>) {
        // Merged, so two quick taps (how heavy, how it felt) don't undo each other.
        const c = { ...s.cycles[a.payload.id], ...a.payload }
        if (c.end && c.end < c.start) delete c.end
        s.cycles[c.id] = c
      },
      prepare: (c: Omit<CycleEntry, 'id'> & { id?: string }) => ({ payload: { ...c, id: c.id ?? nanoid() } }),
    },
    deleteCycle(s, a: PayloadAction<string>) {
      delete s.cycles[a.payload]
    },

    // ----- deeds of the workshop -----
    /** A quest over workshop items: one step per item, each ticked by the workshop itself. */
    addWorkshopQuest: {
      reducer(s, a: PayloadAction<{ questId: string; title: string; kind: WorkshopKind; step: string; items: { id: string; label: string }[]; doOn?: DayKey; projectId?: string } & When>) {
        const { questId, title, kind, step, items, doOn, at } = a.payload
        if (!items.length) return
        const q = newTask({ id: questId, title, tags: ['мастерская'], source: 'workshop', workshopStep: { kind, step }, ...(doOn ? { doOn } : {}) }, at)
        s.tasks[q.id] = q
        items.forEach((it, i) => {
          const x = newTask({ title: it.label, tags: ['мастерская'], parentId: q.id, order: i, source: q.source, workshop: { kind, id: it.id, step } }, at)
          s.tasks[x.id] = x
        })
      },
      prepare: (p: { title: string; kind: WorkshopKind; step: string; items: { id: string; label: string }[]; doOn?: DayKey }) => ({ payload: when({ ...p, questId: nanoid() }) }),
    },

    // ----- «заклинания»: a quest kept as a template -----
    saveSpell: {
      reducer(s, a: PayloadAction<{ taskId: string; title?: string; spellId: string } & When>) {
        const t = s.tasks[a.payload.taskId]
        if (!t) return
        const steps = Object.values(s.tasks)
          .filter((x) => x.parentId === t.id && x.status !== 'cancelled')
          .sort((x, y) => (x.order ?? 0) - (y.order ?? 0))
          .map((x) => ({ title: x.title, stars: x.stars, dread: x.dread }))
        if (!steps.length) return
        s.meta.spells.push({ id: a.payload.spellId, title: (a.payload.title ?? t.title).trim().slice(0, 200), stars: t.stars, dread: t.dread, tags: [...t.tags], steps, createdAt: a.payload.at })
      },
      prepare: (p: { taskId: string; title?: string }) => ({ payload: when({ ...p, spellId: nanoid() }) }),
    },
    /** Casts a spell: a new quest in the backlog (or in a project's book) with the spell's steps in order. */
    castSpell: {
      reducer(s, a: PayloadAction<{ spellId: string; title?: string; projectId?: string; questId: string } & When>) {
        const sp = s.meta.spells.find((x) => x.id === a.payload.spellId)
        if (!sp) return
        const { at, questId, projectId } = a.payload
        const q = newTask({ id: questId, title: a.payload.title?.trim() || sp.title, stars: sp.stars, dread: sp.dread, tags: [...sp.tags], projectId, source: projectId ? 'project' : 'manual' }, at)
        s.tasks[q.id] = q
        frogUp(s, q)
        sp.steps.forEach((step, i) => {
          const x = newTask({ ...step, tags: [...sp.tags], parentId: q.id, projectId, order: i, source: q.source }, at)
          s.tasks[x.id] = x
        })
      },
      prepare: (p: { spellId: string; title?: string; projectId?: string }) => ({ payload: when({ ...p, questId: nanoid() }) }),
    },
    renameSpell(s, a: PayloadAction<{ id: string; title: string }>) {
      const sp = s.meta.spells.find((x) => x.id === a.payload.id)
      if (sp && a.payload.title.trim()) sp.title = a.payload.title.trim().slice(0, 200)
    },
    deleteSpell(s, a: PayloadAction<string>) {
      s.meta.spells = s.meta.spells.filter((x) => x.id !== a.payload)
    },

    // ----- the bestiary: memo, scars and kindness of a workshop person -----
    updatePersonNotes(s, a: PayloadAction<Partial<PersonNotes> & { id: string }>) {
      s.personNotes[a.payload.id] = { ...s.personNotes[a.payload.id], ...a.payload }
    },
    addPersonLine: {
      reducer(s, a: PayloadAction<{ personId: string; list: PersonList; text: string; lineId: string; on?: DayKey } & When>) {
        const { personId, list, text, lineId, day } = a.payload
        if (!text.trim()) return
        const n = (s.personNotes[personId] ??= { id: personId })
        ;(n[list] ??= []).push({ id: lineId, day: a.payload.on ?? day, text: text.trim().slice(0, 500) })
      },
      prepare: (p: { personId: string; list: PersonList; text: string; on?: DayKey }) => ({ payload: when({ ...p, lineId: nanoid() }) }),
    },
    updatePersonLine(s, a: PayloadAction<{ personId: string; list: PersonList; id: string; patch: Partial<PersonLine> }>) {
      const line = s.personNotes[a.payload.personId]?.[a.payload.list]?.find((x) => x.id === a.payload.id)
      if (line) Object.assign(line, a.payload.patch)
    },
    deletePersonLine(s, a: PayloadAction<{ personId: string; list: PersonList; id: string }>) {
      const n = s.personNotes[a.payload.personId]
      if (n?.[a.payload.list]) n[a.payload.list] = n[a.payload.list]!.filter((x) => x.id !== a.payload.id)
    },
    deletePersonNotes(s, a: PayloadAction<string>) {
      delete s.personNotes[a.payload]
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
        habitToJar(s, h, id, at, day, done)
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
     * A mirror entry: dictionary words, energy, factors, a text. Feelings are never paid for — no coins
     * for any entry, so there is nothing to farm. Unknown words are dropped, at most three are kept.
     */
    addJournal: {
      reducer(s, a: PayloadAction<{ entry: Omit<JournalEntry, 'at' | 'day'> } & When>) {
        const { entry, at, day } = a.payload
        const e: JournalEntry = { ...entry, at, day }
        const words = cleanWords(entry.words)
        if (words) e.words = words
        else delete e.words
        s.journal[e.id] = e
      },
      prepare: (p: { entry: Omit<JournalEntry, 'at' | 'day' | 'id'> & { id?: string }; at?: string }) => ({
        payload: when({ ...p, entry: { ...p.entry, id: p.entry.id ?? nanoid() } }),
      }),
    },
    /** A changed time moves the entry to its own day. */
    updateJournal(s, a: PayloadAction<Partial<JournalEntry> & { id: string }>) {
      const e = s.journal[a.payload.id]
      if (!e) return
      Object.assign(e, a.payload)
      if ('words' in a.payload) {
        const words = cleanWords(a.payload.words)
        if (words) e.words = words
        else delete e.words
      }
      if (a.payload.at && !a.payload.day) e.day = dayKey(new Date(a.payload.at), s.meta.dayBoundaryHour)
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
      reducer(s, a: PayloadAction<{ wishId: string; taskId: string; fields: Partial<Task>; steps?: string[] } & When>) {
        const w = s.wishes[a.payload.wishId]
        if (!w) return
        const t = newTask({ title: w.title, tags: [...w.tags], source: 'wish', want: 'want', ...a.payload.fields, id: a.payload.taskId, wishId: w.id }, a.payload.at)
        s.tasks[t.id] = t
        // «В квест»: the steps come with it; the wish comes true when the quest is done.
        ;(a.payload.steps ?? []).forEach((title, i) => {
          const x = newTask({ title, tags: [...w.tags], source: 'wish', parentId: t.id, order: i }, a.payload.at)
          s.tasks[x.id] = x
        })
        w.status = 'inProgress'
        w.taskId = t.id
      },
      prepare: (p: { wishId: string; fields?: Partial<Task>; steps?: string[] }) => ({ payload: when({ ...p, fields: p.fields ?? {}, taskId: nanoid() }) }),
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
    /** The starter practices once; a grimoire seeded before the esbats gets only those, once too. */
    seedPractices(s, a: PayloadAction<WheelPractice[]>) {
      if (s.meta.practicesSeeded && s.meta.esbatsSeeded) return
      for (const p of a.payload) if ((!s.meta.practicesSeeded || p.sabbat === 'esbat') && !s.practices[p.id]) s.practices[p.id] = p
      s.meta.practicesSeeded = true
      s.meta.esbatsSeeded = true
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
        s.wishes[id] = { id, title: p.title, tags: [], status: 'dream', createdAt: a.payload.at, practiceId: p.id, ...(p.sabbat !== 'esbat' ? { sabbat: p.sabbat } : {}) }
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
            tags: [p.sabbat === 'esbat' ? 'эсбат' : p.seasonal ? 'сезонное' : 'колесо'],
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
