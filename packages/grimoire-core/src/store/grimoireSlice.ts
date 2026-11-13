// All grimoire operations. Business rules live here, like the workshop's in dataSlice: the database
// only stores the result. Every action that depends on «now» carries the moment and the grimoire day
// in its payload (filled in by `prepare`), so the reducers stay pure and testable.
import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import { cleanWords } from '../grimoire/emotions.ts'
import { addDays, dayKey, nextRepeat } from '../grimoire/days.ts'
import { habitLogId, habitTaskId, isDone, isScheduled } from '../grimoire/habits.ts'
import { priorityOf } from '../grimoire/selectors.ts'
import type {
  Being,
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
  TaskPriority,
  WheelPractice,
  PersonLine,
  PersonList,
  PersonNotes,
  WorkshopKind,
  CycleEntry,
  Goal,
  LifeEvent,
  Note,
  Spell,
  SpellStep,
  TarotReading,
} from '../grimoire/types.ts'

export const defaultMeta: GrimoireMeta = {
  dayBoundaryHour: 4,
  hemisphere: 'north',
  planMax: 0,
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
  beings: {},
  personNotes: {},
  cycles: {},
  events: {},
  tarot: {},
  goals: {},
  notes: {},
  meta: defaultMeta,
}

/** Fills in fields added after the data was saved; safe to run again on fresh data. */
export function migrateGrimoire(input: Partial<GrimoireState> | undefined): GrimoireState {
  // The old coin journal and its rules are dropped: the reward is being rebuilt from scratch.
  const { coinTxs: _txs, ...rest } = (input ?? {}) as Partial<GrimoireState> & { coinTxs?: unknown }
  const { coins: _rules, ...m } = (input?.meta ?? {}) as Partial<GrimoireMeta> & { coins?: unknown }
  // The old per-part limits become one: their sum, unless «extra» was unlimited.
  if (m.planMax === undefined && m.planLimit) m.planMax = m.planLimit.extra > 0 ? m.planLimit.main + m.planLimit.extra + m.planLimit.optional : 0
  delete m.planLimit
  const meta0 = { ...defaultMeta, ...m }
  // Deeds saved before frogs existed become frogs by the same rules, once.
  const tasks = Object.fromEntries(
    Object.entries(input?.tasks ?? {}).map(([id, t]) => {
      // A deed from before priorities: its plan part becomes the priority, once.
      if (t.slot && !t.priority) {
        const { slot, ...r } = t
        t = { ...r, priority: priorityOf({ slot }) }
      }
      if (t.frog !== undefined || !isOpen(t)) return [id, t]
      const count = t.postponeCount ?? t.postponements?.length ?? 0
      return [id, { ...t, postponeCount: count, ...(t.dread === 3 || count >= meta0.frogPostpones ? { frog: 'auto' as const } : {}) }]
    }),
  )
  return {
    ...initialGrimoire,
    ...rest,
    tasks,
    meta: {
      ...defaultMeta,
      ...m,
      tone: { ...defaultMeta.tone, ...m.tone },
      nav: { ...defaultMeta.nav, ...m.nav },
      notify: { ...defaultMeta.notify, ...m.notify },
    },
  }
}

// ---------- helpers on the draft ----------

/** Open deeds of a book (steps of its quests too): shelved with it, detached from it or deleted. */
function moveProjectTasks(s: GrimoireState, projectId: string, how: 'shelve' | 'detach' | 'delete') {
  const mine = Object.values(s.tasks).filter((t) => t.projectId === projectId && t.status !== 'done' && t.status !== 'cancelled')
  for (const t of mine) {
    if (how === 'shelve') {
      t.shelved = true
      delete t.doOn
      delete t.doAt
    } else if (how === 'detach') {
      delete t.projectId
      delete t.shelved
    } else {
      delete s.tasks[t.id]
      for (const o of Object.values(s.tasks)) {
        if (o.blockedBy?.includes(t.id)) o.blockedBy = o.blockedBy.filter((x) => x !== t.id)
        if (o.parentId === t.id) delete o.parentId
      }
    }
  }
}

/** Sets a priority; «medium» is the default, so it is stored as no value. The old plan part goes. */
export function setPriority(t: Task, p: TaskPriority) {
  if (p === 'medium') delete t.priority
  else t.priority = p
  delete t.slot
}

type S = GrimoireState

const isOpen = (t: Task) => t.status !== 'done' && t.status !== 'cancelled' && !t.shelved

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
    syncWish(s, parent, at, true)
  } else if (!allDone && parent.status === 'done') {
    parent.status = 'open'
    delete parent.doneAt
    delete parent.doneDay
    syncWish(s, parent, at, false)
  }
}

/**
 * A book closes itself when its last deed is done and opens again when a deed is undone (`undo`: its
 * wish stops being fulfilled too). A deed added to a read book reopens it but keeps the wish.
 */
function syncProject(s: S, projectId: string | undefined, at: string, undo = false) {
  const p = projectId ? s.projects[projectId] : undefined
  if (!p || p.status === 'archived') return
  const deeds = Object.values(s.tasks).filter((t) => t.projectId === p.id && !t.parentId && t.status !== 'cancelled')
  const allDone = deeds.length > 0 && deeds.every((t) => t.status === 'done')
  if (allDone && p.status !== 'done') {
    p.status = 'done'
    p.doneAt = at
    fulfillLinked(s, Object.values(s.wishes).find((w) => w.projectId === p.id), at, true)
  } else if (!allDone && p.status === 'done') {
    p.status = 'active'
    delete p.doneAt
    if (undo) fulfillLinked(s, Object.values(s.wishes).find((w) => w.projectId === p.id), at, false)
  }
}

function markHabit(s: S, t: Task, at: string, done: boolean) {
  const h = t.habitId ? s.habits[t.habitId] : undefined
  if (!h || !t.doOn) return
  const id = habitLogId(h.id, t.doOn)
  if (!done) {
    delete s.habitLogs[id]
    habitToJar(s, h, id, at, false)
    return
  }
  s.habitLogs[id] = { id, habitId: h.id, date: t.doOn, value: h.mark.kind === 'count' ? h.mark.goal : 1 }
  habitToJar(s, h, id, at, true)
}

/** A wish made real by a task goes to the hall of fame when the task is done, and back if undone. */
function syncWish(s: S, t: Task, at: string, done: boolean) {
  const w = t.wishId ? s.wishes[t.wishId] : undefined
  if (!w) return
  if (done && w.status !== 'fulfilled') {
    w.status = 'fulfilled'
    w.fulfilledAt = at
  } else if (!done && w.status === 'fulfilled') {
    w.status = 'inProgress'
    delete w.fulfilledAt
  }
}

export const jarBalance = (s: Pick<S, 'jarTxs'>, jarId: string) => Object.values(s.jarTxs).reduce((sum, x) => (x.jarId === jarId ? sum + x.amount : sum), 0)

/** After money moves: a full jar is «собрана»; a jar no longer full saves again. */
function syncJar(s: S, jarId: string) {
  const j = s.jars[jarId]
  if (!j || j.goal <= 0) return
  const pct = (jarBalance(s, jarId) / j.goal) * 100
  if (pct >= 100 && j.status === 'saving') j.status = 'collected'
  else if (pct < 100 && j.status === 'collected') j.status = 'saving'
}

/** «Отложить 1000 ₽»: a ticked ritual puts its sum into its jar; unticked, takes it back. */
function habitToJar(s: S, h: Habit, logId: string, at: string, done: boolean) {
  if (!h.jarId || !h.jarAmount || !s.jars[h.jarId]) return
  const id = `habit:${logId}`
  if (done && !s.jarTxs[id]) s.jarTxs[id] = { id, jarId: h.jarId, at, amount: h.jarAmount, note: h.title, habitLogId: logId }
  else if (!done && s.jarTxs[id]) delete s.jarTxs[id]
  else return
  syncJar(s, h.jarId)
}

/** A wish made real by a project or a jar comes true when the book is read or the money spent. */
function fulfillLinked(s: S, w: Wish | undefined, at: string, done: boolean) {
  if (!w) return
  if (done && w.status !== 'fulfilled') {
    w.status = 'fulfilled'
    w.fulfilledAt = at
  } else if (!done && w.status === 'fulfilled') {
    w.status = 'inProgress'
    delete w.fulfilledAt
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

/** A chain spell: the done deed brings the next step, into the backlog, once. */
function spawnChain(s: S, t: Task, at: string) {
  if (!t.chainNext?.length) return
  const id = `${t.id}>`.slice(0, 64)
  if (s.tasks[id]) return
  const [next, ...rest] = t.chainNext
  s.tasks[id] = newTask({ ...next, id, tags: [...t.tags], projectId: t.projectId, personIds: t.personIds, source: t.source, spawnedFrom: t.id, chainNext: rest.length ? rest : undefined }, at)
  frogUp(s, s.tasks[id])
}

/** Templates offered on an empty «Шаблоны» page. */
export const starterSpells: Omit<Spell, 'id' | 'createdAt'>[] = [
  { title: 'Вынести мусор', stars: 1, dread: 0, tags: ['дом'], steps: [] },
  { title: 'Помыть окна', stars: 2, dread: 1, tags: ['дом'], steps: [] },
  {
    title: 'Стирка',
    stars: 1,
    dread: 0,
    tags: ['дом'],
    chain: true,
    steps: [
      { title: 'Постирать', stars: 1, dread: 0 },
      { title: 'Развесить бельё', stars: 1, dread: 0 },
      { title: 'Снять и разложить бельё', stars: 1, dread: 0 },
    ],
  },
]

/** Spaced repetition for notes: days until it comes back after each «помню». */
export const noteLadder = [1, 3, 7, 21, 60]

function newTask(fields: Partial<Task> & { title: string }, at: string): Task {
  const t: Task = {
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
  // «medium» is stored as no value; a part of the old plan becomes its priority.
  setPriority(t, priorityOf(t))
  return t
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
        if (!t.parentId) syncProject(s, t.projectId, a.payload.at)
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
      if ('priority' in a.payload) setPriority(t, a.payload.priority ?? 'medium')
      if (t.title) t.title = t.title.trim().slice(0, 200)
      frogUp(s, t)
      if (wasIn !== t.projectId && !t.parentId) {
        // Steps follow their quest into another book.
        for (const st of Object.values(s.tasks)) if (st.parentId === t.id) st.projectId = t.projectId
        const at = new Date().toISOString()
        syncProject(s, wasIn, at)
        syncProject(s, t.projectId, at)
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
        if (partial) {
          t.status = 'partial'
          if (note) t.partialNote = note
          return
        }
        t.status = 'done'
        t.doneAt = at
        t.doneDay = day
        markHabit(s, t, at, true)
        syncParent(s, t.parentId, at, day)
        syncProject(s, t.projectId ?? (t.parentId ? s.tasks[t.parentId]?.projectId : undefined), at)
        syncWish(s, t, at, true)
        spawnRepeat(s, t, at, day)
        spawnChain(s, t, at)
      },
      prepare: (p: { id: string; partial?: boolean; note?: string; boundary?: number }) => ({ payload: when(p) }),
    },
    /** Takes a done (or partly done) task back into work. */
    reopenTask: {
      reducer(s, a: PayloadAction<{ id: string } & When>) {
        const { id, at, day } = a.payload
        const t = s.tasks[id]
        if (!t) return
        const wasDone = t.status === 'done'
        t.status = 'open'
        delete t.doneAt
        delete t.doneDay
        if (wasDone) {
          markHabit(s, t, at, false)
          syncParent(s, t.parentId, at, day)
          syncProject(s, t.projectId ?? (t.parentId ? s.tasks[t.parentId]?.projectId : undefined), at, true)
          syncWish(s, t, at, false)
        }
      },
      prepare: (p: { id: string; boundary?: number }) => ({ payload: when(p) }),
    },
    /** «Начать понемногу»: the deed is in progress, even if it isn't finished. */
    startTask: {
      reducer(s, a: PayloadAction<{ id: string } & When>) {
        const t = s.tasks[a.payload.id]
        if (!t || !isOpen(t)) return
        t.status = 'inProgress'
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
        else syncProject(s, t.projectId, a.payload.at)
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

    /** Chooses a task for a day (or sends it back to the backlog with `day` empty), optionally with a priority. */
    planTask(s, a: PayloadAction<{ id: string; day?: DayKey; priority?: TaskPriority }>) {
      const t = s.tasks[a.payload.id]
      if (!t) return
      if (a.payload.priority) setPriority(t, a.payload.priority)
      if (a.payload.day) {
        t.doOn = a.payload.day
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
            priority: from.priority,
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
            { title, stars: t.stars, dread: t.dread, tags: [...t.tags], parentId: t.id, projectId: t.projectId, order: i, source: t.source, ...(t.priority ? { priority: t.priority } : {}), ...(i === 0 && t.doOn ? { doOn: t.doOn } : {}) },
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
        const { jar, at } = a.payload
        const prev = s.jars[jar.id]
        s.jars[jar.id] = { ...prev, ...jar, status: jar.status ?? prev?.status ?? 'saving', createdAt: prev?.createdAt ?? at }
        syncJar(s, jar.id)
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
        const { jarId, amount, note, txId, at } = a.payload
        if (!s.jars[jarId] || !amount) return
        s.jarTxs[txId] = { id: txId, jarId, at, amount, ...(note?.trim() ? { note: note.trim().slice(0, 200) } : {}) }
        syncJar(s, jarId)
      },
      prepare: (p: { jarId: string; amount: number; note?: string; at?: string }) => ({ payload: when({ ...p, txId: nanoid() }) }),
    },
    deleteJarTx: {
      reducer(s, a: PayloadAction<{ id: string } & When>) {
        const x = s.jarTxs[a.payload.id]
        if (!x) return
        delete s.jarTxs[x.id]
        syncJar(s, x.jarId)
      },
      prepare: (id: string) => ({ payload: when({ id }) }),
    },
    /** «Потрачена» makes its wish come true; «закрыта» just puts the jar away. */
    setJarStatus: {
      reducer(s, a: PayloadAction<{ id: string; status: Jar['status'] } & When>) {
        const { id, status, at } = a.payload
        const j = s.jars[id]
        if (!j) return
        const was = j.status
        j.status = status
        const wish = j.wishId ? s.wishes[j.wishId] : undefined
        if (status === 'spent') fulfillLinked(s, wish, at, true)
        else if (was === 'spent') fulfillLinked(s, wish, at, false)
        if (status === 'saving' || status === 'collected') syncJar(s, id)
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
        // A deed without steps is kept too: a one-deed template («вынести мусор»).
        s.meta.spells.push({ id: a.payload.spellId, title: (a.payload.title ?? t.title).trim().slice(0, 200), stars: t.stars, dread: t.dread, tags: [...t.tags], steps, createdAt: a.payload.at })
      },
      prepare: (p: { taskId: string; title?: string }) => ({ payload: when({ ...p, spellId: nanoid() }) }),
    },
    /** Casts a spell: a new quest in the backlog (or in a project's book) with the spell's steps in order. */
    castSpell: {
      reducer(s, a: PayloadAction<{ spellId: string; title?: string; projectId?: string; questId: string; fields?: Partial<Task> } & When>) {
        const sp = s.meta.spells.find((x) => x.id === a.payload.spellId)
        if (!sp) return
        const { at, questId, projectId } = a.payload
        sp.uses = (sp.uses ?? 0) + 1
        const source = projectId ? 'project' : 'manual'
        const extra = { ...(a.payload.fields ?? {}) }
        if (sp.chain && sp.steps.length) {
          // A chain: only the first step now, the rest waits on it.
          const [first, ...rest] = sp.steps
          const c = newTask({ ...extra, id: questId, ...first, tags: [...sp.tags], projectId, source, chainNext: rest.length ? rest : undefined }, at)
          s.tasks[c.id] = c
          frogUp(s, c)
          return
        }
        const q = newTask({ ...extra, id: questId, title: a.payload.title?.trim() || sp.title, stars: sp.stars, dread: sp.dread, tags: [...sp.tags], projectId, source }, at)
        s.tasks[q.id] = q
        frogUp(s, q)
        sp.steps.forEach((step, i) => {
          const x = newTask({ ...step, tags: [...sp.tags], parentId: q.id, projectId, order: i, source: q.source }, at)
          s.tasks[x.id] = x
        })
      },
      prepare: (p: { spellId: string; title?: string; projectId?: string; fields?: Partial<Task> }) => ({ payload: when({ ...p, questId: nanoid() }) }),
    },
    /** A template made or changed by hand on the «Шаблоны» page. */
    upsertSpell: {
      reducer(s, a: PayloadAction<{ spell: Omit<Spell, 'createdAt'> } & When>) {
        const i = s.meta.spells.findIndex((x) => x.id === a.payload.spell.id)
        const sp: Spell = { ...a.payload.spell, title: a.payload.spell.title.trim().slice(0, 200), createdAt: i >= 0 ? s.meta.spells[i].createdAt : a.payload.at }
        if (!sp.title) return
        if (i >= 0) s.meta.spells[i] = sp
        else s.meta.spells.push(sp)
      },
      prepare: (p: { spell: Omit<Spell, 'createdAt' | 'id'> & { id?: string } }) => ({ payload: when({ spell: { ...p.spell, id: p.spell.id ?? nanoid() } }) }),
    },
    /** The starter templates, added once on request; those with the same name are skipped. */
    addStarterSpells: {
      reducer(s, a: PayloadAction<{ ids: string[] } & When>) {
        starterSpells.forEach((sp, i) => {
          if (s.meta.spells.some((x) => x.title.toLowerCase() === sp.title.toLowerCase())) return
          s.meta.spells.push({ ...sp, id: a.payload.ids[i], createdAt: a.payload.at })
        })
      },
      prepare: () => ({ payload: when({ ids: starterSpells.map(() => nanoid()) }) }),
    },
    renameSpell(s, a: PayloadAction<{ id: string; title: string }>) {
      const sp = s.meta.spells.find((x) => x.id === a.payload.id)
      if (sp && a.payload.title.trim()) sp.title = a.payload.title.trim().slice(0, 200)
    },
    deleteSpell(s, a: PayloadAction<string>) {
      s.meta.spells = s.meta.spells.filter((x) => x.id !== a.payload)
    },

    // ----- the bestiary: its people, and the memo, scars and kindness of each -----
    upsertBeing(s, a: PayloadAction<Being>) {
      const name = a.payload.name.trim().slice(0, 200)
      if (name) s.beings[a.payload.id] = { ...s.beings[a.payload.id], ...a.payload, name }
    },
    deleteBeing(s, a: PayloadAction<string>) {
      delete s.beings[a.payload]
      delete s.personNotes[a.payload]
    },
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

    // ----- habits -----
    upsertHabit: {
      reducer(s, a: PayloadAction<{ habit: Omit<Habit, 'id' | 'createdAt'> & Partial<Pick<Habit, 'id' | 'createdAt'>> } & When>) {
        const { habit, at, day } = a.payload
        const id = habit.id ?? nanoid()
        const prev = s.habits[id]
        const h: Habit = { ...prev, ...habit, id, createdAt: prev?.createdAt ?? habit.createdAt ?? at }
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
      prepare: (p: { habit: Omit<Habit, 'id' | 'createdAt'> & Partial<Pick<Habit, 'id' | 'createdAt'>>; boundary?: number }) => ({
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
        habitToJar(s, h, id, at, done)
        if (t && done && t.status !== 'done') {
          t.status = 'done'
          t.doneAt = at
          t.doneDay = day
        } else if (t && !done && t.status === 'done') {
          t.status = 'open'
          delete t.doneAt
          delete t.doneDay
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
        // A long event (a trip, a sick leave): its days ask for no rituals and count no skips.
        const inEvent = (d: DayKey) => Object.values(s.events).some((e) => d >= e.from && d <= e.to)
        for (const t of Object.values(s.tasks)) {
          if (!t.habitId || !t.doOn || t.doOn >= day || !isOpen(t)) continue
          const id = habitLogId(t.habitId, t.doOn)
          if (!s.habitLogs[id] && s.habits[t.habitId] && !inEvent(t.doOn)) s.habitLogs[id] = { id, habitId: t.habitId, date: t.doOn, value: 0, skipped: true }
          delete s.tasks[t.id]
        }
        for (const h of Object.values(s.habits)) {
          if (inEvent(day)) break
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
    /**
     * A book to the archive. Its open deeds: `shelve` — go with it (out of the plan and the backlog,
     * back to the backlog when the book comes back), `detach` — stay where they are without the book,
     * `delete` — go away. Done deeds stay in the history either way.
     */
    archiveProject(s, a: PayloadAction<{ id: string; tasks: 'shelve' | 'detach' | 'delete' }>) {
      const p = s.projects[a.payload.id]
      if (!p) return
      p.status = 'archived'
      moveProjectTasks(s, p.id, a.payload.tasks)
    },
    /** Back from the archive: its shelved deeds return to the backlog, without their old days. */
    unarchiveProject(s, a: PayloadAction<string>) {
      const p = s.projects[a.payload]
      if (!p) return
      p.status = 'active'
      for (const t of Object.values(s.tasks))
        if (t.projectId === p.id && t.shelved) {
          delete t.shelved
          delete t.doOn
          delete t.doAt
        }
    },
    /** A book for good. Its open deeds are detached or deleted; done ones stay without the book; wishes and jars just lose the link. */
    deleteProject(s, a: PayloadAction<{ id: string; tasks: 'detach' | 'delete' }>) {
      const id = a.payload.id
      if (!s.projects[id]) return
      moveProjectTasks(s, id, a.payload.tasks)
      for (const t of Object.values(s.tasks))
        if (t.projectId === id) {
          delete t.projectId
          delete t.shelved
        }
      for (const w of Object.values(s.wishes)) if (w.projectId === id) delete w.projectId
      for (const j of Object.values(s.jars)) if (j.projectId === id) delete j.projectId
      delete s.projects[id]
    },

    // ----- long events (a trip, a sick leave) -----
    /**
     * An event and what happens to the deeds of its days, decided once: `keep`, `after` — the day after
     * the event, `backlog`, `cancel` (let go). Rituals of those days are skipped without breaking a series.
     */
    upsertEvent: {
      reducer(s, a: PayloadAction<{ event: Omit<LifeEvent, 'createdAt'>; fate?: Record<string, 'keep' | 'after' | 'backlog' | 'cancel'> } & When>) {
        const e = a.payload.event
        s.events[e.id] = { ...e, title: e.title.trim().slice(0, 200), createdAt: s.events[e.id]?.createdAt ?? a.payload.at }
        const after = addDays(e.to, 1)
        for (const [id, how] of Object.entries(a.payload.fate ?? {})) {
          const t = s.tasks[id]
          if (!t || !isOpen(t)) continue
          if (how === 'after') t.doOn = after
          else if (how === 'backlog') {
            delete t.doOn
            delete t.doAt
          } else if (how === 'cancel') t.status = 'cancelled'
        }
      },
      prepare: (p: { event: Omit<LifeEvent, 'createdAt' | 'id'> & { id?: string }; fate?: Record<string, 'keep' | 'after' | 'backlog' | 'cancel'> }) => ({
        payload: when({ ...p, event: { ...p.event, id: p.event.id ?? nanoid() } }),
      }),
    },
    deleteEvent(s, a: PayloadAction<string>) {
      delete s.events[a.payload]
    },

    // ----- tarot: readings with a real deck -----
    upsertTarot: {
      reducer(s, a: PayloadAction<{ reading: Omit<TarotReading, 'createdAt'> } & When>) {
        const r = a.payload.reading
        s.tarot[r.id] = { ...r, createdAt: s.tarot[r.id]?.createdAt ?? a.payload.at }
        if (r.deck && !(s.meta.tarotDecks ?? []).includes(r.deck)) s.meta.tarotDecks = [...(s.meta.tarotDecks ?? []), r.deck]
      },
      prepare: (p: { reading: Omit<TarotReading, 'createdAt' | 'id'> & { id?: string } }) => ({ payload: when({ reading: { ...p.reading, id: p.reading.id ?? nanoid() } }) }),
    },
    deleteTarot(s, a: PayloadAction<string>) {
      delete s.tarot[a.payload]
    },
    saveTarotLayout(s, a: PayloadAction<{ name: string; positions: string[] }>) {
      const name = a.payload.name.trim()
      if (!name) return
      s.meta.tarotLayouts = [...(s.meta.tarotLayouts ?? []).filter((l) => l.name !== name), { name, positions: a.payload.positions }]
    },

    // ----- goals for the year -----
    upsertGoal: {
      reducer(s, a: PayloadAction<{ goal: Omit<Goal, 'createdAt'> } & When>) {
        const g = a.payload.goal
        const was = s.goals[g.id]
        s.goals[g.id] = { ...g, title: g.title.trim().slice(0, 200), createdAt: was?.createdAt ?? a.payload.at }
        if (g.status === 'done' && was?.status !== 'done') s.goals[g.id].doneAt = a.payload.at
        if (g.status !== 'done') delete s.goals[g.id].doneAt
      },
      prepare: (p: { goal: Omit<Goal, 'createdAt' | 'id'> & { id?: string } }) => ({ payload: when({ goal: { ...p.goal, id: p.goal.id ?? nanoid() } }) }),
    },
    deleteGoal(s, a: PayloadAction<string>) {
      delete s.goals[a.payload]
    },

    // ----- notes, quotes, moments to come back to -----
    upsertNote: {
      reducer(s, a: PayloadAction<{ note: Omit<Note, 'createdAt'> } & When>) {
        const n = a.payload.note
        const was = s.notes[n.id]
        const note: Note = { ...n, text: n.text.trim(), createdAt: was?.createdAt ?? a.payload.at }
        if (!note.text) return
        // Turned on for repeating: it first comes back tomorrow.
        if (note.repeat && !was?.repeat) {
          note.step = 0
          note.nextOn = addDays(a.payload.day, noteLadder[0])
        }
        if (!note.repeat) {
          delete note.step
          delete note.nextOn
        }
        s.notes[n.id] = note
      },
      prepare: (p: { note: Omit<Note, 'createdAt' | 'id'> & { id?: string }; boundary?: number }) => ({ payload: when({ ...p, note: { ...p.note, id: p.note.id ?? nanoid() } }) }),
    },
    deleteNote(s, a: PayloadAction<string>) {
      delete s.notes[a.payload]
    },
    /** The note of the day was read: «помню» moves it up the ladder, «ещё повторить» brings it back tomorrow. */
    reviewNote: {
      reducer(s, a: PayloadAction<{ id: string; remember: boolean } & When>) {
        const n = s.notes[a.payload.id]
        if (!n?.repeat) return
        const step = a.payload.remember ? Math.min((n.step ?? 0) + 1, noteLadder.length - 1) : 0
        n.step = step
        n.nextOn = addDays(a.payload.day, a.payload.remember ? noteLadder[step] : 1)
      },
      prepare: (p: { id: string; remember: boolean; boundary?: number }) => ({ payload: when(p) }),
    },

    // ----- journal («Зеркало») -----
    /**
     * A mirror entry: dictionary words, energy, factors, a text. Unknown words are dropped, at most
     * three are kept.
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
