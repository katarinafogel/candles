import { describe, expect, it, vi } from 'vitest'

vi.mock('@shared/lib/supabase', () => ({ supabase: {} }))
vi.mock('localforage', () => ({ default: { setItem: async () => {}, getItem: async () => null, config: () => {} } }))

const { parseQuickAdd, parseDay } = await import('@grimoire-core/grimoire/parse')
const { addDays, dayKey, daysBetween, weekday, humanDay, nextRepeat } = await import('@grimoire-core/grimoire/days')
const { sabbatDays, wheelNow, moonPhase, seasonMoment, isFullMoon, nextFullMoon, sabbats, builtInPractices, lunarPhaseMoment } = await import('@grimoire-core/grimoire/wheel')
const { streak, habitLogId, habitTaskId } = await import('@grimoire-core/grimoire/habits')
const { default: reducer, grimoireActions: A, initialGrimoire, migrateGrimoire } = await import('@grimoire-core/store/grimoireSlice')
const { diffGrimoire, isGrimoireRow } = await import('../../lib/sync')
const { emotionWords, dyadFor, searchWords, wordPetals } = await import('@grimoire-core/grimoire/emotions')
const { dayPlan, dayStars, isBlocked, isStuck, toReview, chainOf, cardTone, projectProgress, projectTasks } = await import('@grimoire-core/grimoire/selectors')
type GS = typeof initialGrimoire
type Habit = import('@grimoire-core/grimoire/types').Habit

const MON = '2026-10-26' // a Monday
const at = (day: string, hh = '12:00') => `${day}T${hh}:00.000Z`
const w = (day: string) => ({ at: at(day), day })

describe('days', () => {
  it('counts late night as the same day until the boundary', () => {
    expect(dayKey(new Date(2026, 9, 27, 3, 30), 4)).toBe('2026-10-26')
    expect(dayKey(new Date(2026, 9, 27, 4, 30), 4)).toBe('2026-10-27')
    expect(dayKey(new Date(2026, 9, 27, 0, 30), 0)).toBe('2026-10-27')
  })
  it('does arithmetic on day keys', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-29', -1)).toBe('2026-03-28')
    expect(daysBetween('2026-10-26', '2026-11-02')).toBe(7)
    expect(weekday(MON)).toBe(1)
    expect(weekday('2026-11-01')).toBe(7)
    expect(humanDay('2026-10-27', MON)).toBe('завтра')
  })
  it('finds the next day of a repeat', () => {
    expect(nextRepeat(MON, { kind: 'daily' })).toBe('2026-10-27')
    expect(nextRepeat(MON, { kind: 'everyN', n: 10 })).toBe('2026-11-05')
    expect(nextRepeat(MON, { kind: 'weekdays', days: [1, 4] })).toBe('2026-10-29')
    expect(nextRepeat('2026-01-31', { kind: 'monthly' })).toBe('2026-02-28')
  })
})

describe('quick add', () => {
  it('parses stars, dread, tags and a weekday deadline', () => {
    const p = parseQuickAdd('помыть окна **☠☠ #дом !пт', MON)
    expect(p).toMatchObject({ title: 'помыть окна', stars: 2, dread: 2, tags: ['дом'], dueAt: '2026-10-30', type: 'deed' })
  })
  it('parses a joy with a person', () => {
    const p = parseQuickAdd('кино с @аня +радость', MON)
    expect(p).toMatchObject({ title: 'кино с аня', type: 'joy', people: ['аня'] })
  })
  it('caps the marks and reads priorities and days', () => {
    expect(parseQuickAdd('**** ☠☠☠☠ зуб +высокий', MON)).toMatchObject({ stars: 3, dread: 3, priority: 'high', title: 'зуб' })
    expect(parseQuickAdd('зуб +высокий', MON).doOn).toBeUndefined()
    // The old plan parts still work: a priority and today's plan.
    expect(parseQuickAdd('зуб +главное', MON)).toMatchObject({ priority: 'high', doOn: MON })
    expect(parseQuickAdd('отчёт +завтра !5.11', MON)).toMatchObject({ doOn: '2026-10-27', dueAt: '2026-11-05' })
    expect(parseQuickAdd('просто дело', MON)).toMatchObject({ stars: 1, dread: 0, title: 'просто дело' })
  })
  it('understands dates', () => {
    expect(parseDay('пн', MON)).toBe(MON)
    expect(parseDay('вс', MON)).toBe('2026-11-01')
    expect(parseDay('12.01', '2026-12-20')).toBe('2027-01-12')
    expect(parseDay('31.02', MON)).toBeUndefined()
    expect(parseDay('2026-11-12', MON)).toBe('2026-11-12')
  })
  it('keeps a lone ! or # as words', () => {
    expect(parseQuickAdd('ура ! #', MON).title).toBe('ура ! #')
  })
})

describe('grimoire reducer', () => {
  const add = (s: GS, id: string, f: object = {}) => reducer(s, { type: A.addTask.type, payload: { fields: { id, title: id, ...f }, ...w(MON) } })

  it('closes a deed after a partial and reopens it', () => {
    let s = add(initialGrimoire, 't', { stars: 3, dread: 2 })
    s = reducer(s, { type: A.completeTask.type, payload: { id: 't', partial: true, note: 'половина', ...w(MON) } })
    expect(s.tasks.t).toMatchObject({ status: 'partial', partialNote: 'половина' })
    s = reducer(s, { type: A.completeTask.type, payload: { id: 't', ...w(MON) } })
    expect(s.tasks.t).toMatchObject({ status: 'done', doneDay: MON })
    s = reducer(s, { type: A.reopenTask.type, payload: { id: 't', ...w(MON) } })
    expect(s.tasks.t.status).toBe('open')
  })

  it('makes a frog of a monster', () => {
    const s = add(initialGrimoire, 't', { stars: 3, dread: 3 })
    expect(s.tasks.t.frog).toBe('auto')
  })

  it('makes a frog after three postponements to later days or to the backlog, not earlier', () => {
    let s = add(initialGrimoire, 't', { doOn: MON })
    s = reducer(s, { type: A.postponeTask.type, payload: { id: 't', to: addDays(MON, 2), ...w(MON) } })
    s = reducer(s, { type: A.postponeTask.type, payload: { id: 't', to: addDays(MON, 1), ...w(MON) } }) // earlier: not counted
    s = reducer(s, { type: A.postponeTask.type, payload: { id: 't', ...w(MON) } })
    expect(s.tasks.t.postponeCount).toBe(2)
    expect(s.tasks.t.frog).toBeUndefined()
    s = reducer(s, { type: A.reviewToBacklog.type, payload: ['t'] })
    expect(s.tasks.t).toMatchObject({ postponeCount: 3, frog: 'auto' })
    // Taken off by hand: the count starts over and dread alone does not bring it back.
    s = reducer(s, { type: A.setFrog.type, payload: { id: 't', frog: false } })
    s = reducer(s, { type: A.updateTask.type, payload: { id: 't', dread: 3 } })
    expect(s.tasks.t).toMatchObject({ frog: 'off', postponeCount: 0 })
    // A plain «в бэклог» is a choice, not a postponement.
    s = reducer(s, { type: A.toBacklog.type, payload: ['t'] })
    expect(s.tasks.t.postponeCount).toBe(0)
  })

  it('turns old deeds into frogs on load by the same rules', () => {
    const old = { tasks: { a: { id: 'a', title: 'a', status: 'open', dread: 3, postponements: [] }, b: { id: 'b', title: 'b', status: 'open', dread: 0, postponements: [{}, {}, {}] }, c: { id: 'c', title: 'c', status: 'open', dread: 1, postponements: [] } } }
    const g = migrateGrimoire(old as never)
    expect([g.tasks.a.frog, g.tasks.b.frog, g.tasks.c.frog]).toEqual(['auto', 'auto', undefined])
    expect(g.tasks.b.postponeCount).toBe(3)
  })

  it('closes a book with its last deed and opens it again on undo', () => {
    let s = reducer(initialGrimoire, { type: A.upsertProject.type, payload: { project: { id: 'p', title: 'Ремонт', status: 'active' }, ...w(MON) } })
    s = add(s, 'a', { projectId: 'p' })
    s = add(s, 'q', { projectId: 'p' })
    s = reducer(s, { type: A.splitTask.type, payload: { id: 'q', steps: ['раз', 'два'], ...w(MON) } })
    const steps = Object.values(s.tasks).filter((t) => t.parentId === 'q')
    expect(steps.every((t) => t.projectId === 'p')).toBe(true)
    expect(projectProgress(s, 'p')).toBe(0)
    s = reducer(s, { type: A.completeTask.type, payload: { id: 'a', ...w(MON) } })
    for (const st of steps) s = reducer(s, { type: A.completeTask.type, payload: { id: st.id, ...w(MON) } })
    expect(s.tasks.q.status).toBe('done')
    expect(s.projects.p.status).toBe('done')
    expect(projectProgress(s, 'p')).toBe(1)
    // A new deed reopens the book; letting it go closes it again.
    s = add(s, 'b', { projectId: 'p' })
    expect(s.projects.p.status).toBe('active')
    s = reducer(s, { type: A.cancelTask.type, payload: { id: 'b', ...w(MON) } })
    expect(s.projects.p.status).toBe('done')
    // Undoing a deed opens the book.
    s = reducer(s, { type: A.reopenTask.type, payload: { id: 'a', ...w(MON) } })
    expect(s.projects.p.status).toBe('active')
  })

  it('keeps the book order: dragged order first, done deeds last', () => {
    let s = reducer(initialGrimoire, { type: A.upsertProject.type, payload: { project: { id: 'p', title: 'p', status: 'active' }, ...w(MON) } })
    for (const id of ['a', 'b', 'c']) s = add(s, id, { projectId: 'p' })
    s = reducer(s, { type: A.reorderTasks.type, payload: ['c', 'a', 'b'] })
    s = reducer(s, { type: A.completeTask.type, payload: { id: 'c', ...w(MON) } })
    expect(projectTasks(s, 'p').map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('links «ждёт другое дело» by hand and refuses a circle', () => {
    let s = add(initialGrimoire, 'a')
    s = add(s, 'b')
    s = add(s, 'c')
    s = reducer(s, { type: A.linkBlock.type, payload: { id: 'a', blockerId: 'b', on: true } })
    s = reducer(s, { type: A.linkBlock.type, payload: { id: 'b', blockerId: 'c', on: true } })
    s = reducer(s, { type: A.linkBlock.type, payload: { id: 'c', blockerId: 'a', on: true } }) // a → b → c → a: ignored
    expect([s.tasks.a.blockedBy, s.tasks.b.blockedBy, s.tasks.c.blockedBy]).toEqual([['b'], ['c'], undefined])
    expect(isBlocked(s.tasks.a, s.tasks)).toBe(true)
    s = reducer(s, { type: A.linkBlock.type, payload: { id: 'a', blockerId: 'b', on: false } })
    expect(s.tasks.a.blockedBy).toBeUndefined()
  })

  it('puts leftovers into the «разобрать потом» pack without counting them as postponed', () => {
    let s = add(initialGrimoire, 'a', { doOn: addDays(MON, -3) })
    s = reducer(s, { type: A.clearSlate.type, payload: { ids: ['a'], day: MON } })
    expect(s.tasks.a).toMatchObject({ later: MON })
    expect(s.tasks.a.doOn).toBeUndefined()
    expect(s.tasks.a.postponeCount ?? 0).toBe(0)
    expect(s.meta).toMatchObject({ reviewedDay: MON, welcomedDay: MON })
    s = reducer(s, { type: A.planTask.type, payload: { id: 'a', day: MON } })
    expect(s.tasks.a.later).toBeUndefined()
  })

  it('counts the day stars: joys apart, done deeds too, rituals out, past the limit is over', () => {
    let s = add(initialGrimoire, 'j', { type: 'joy', stars: 2, doOn: MON })
    s = add(s, 'a', { stars: 3, doOn: MON })
    s = add(s, 'b', { stars: 3, doOn: MON })
    s = add(s, 'h', { stars: 3, doOn: MON, habitId: 'x' })
    s = add(s, 'later', { stars: 3, doOn: addDays(MON, 1) })
    s = reducer(s, { type: A.completeTask.type, payload: { id: 'a', ...w(MON) } })
    expect(dayStars(s, MON)).toEqual({ joy: 2, deed: 6, total: 8, limit: 6, over: 2 })
  })

  it('colours a card: frog, then joy, then three stars, then silver', () => {
    const t = (f: object) => ({ type: 'deed', stars: 1, ...f }) as never
    expect(cardTone(t({ frog: 'auto', type: 'joy', stars: 3 }))).toBe('swamp')
    expect(cardTone(t({ type: 'joy', stars: 3 }))).toBe('nacre')
    expect(cardTone(t({ stars: 3, frog: 'off' }))).toBe('wine')
    expect(cardTone(t({ stars: 2 }))).toBe('silver')
  })

  it('puts a deed in progress with «начать понемногу»', () => {
    let s = add(initialGrimoire, 't')
    s = reducer(s, { type: A.startTask.type, payload: { id: 't', ...w(MON) } })
    expect(s.tasks.t.status).toBe('inProgress')
  })

  it('closes a quest when the last step is done and reopens it on undo', () => {
    let s = add(initialGrimoire, 'q', { doOn: MON })
    s = reducer(s, { type: A.splitTask.type, payload: { id: 'q', steps: ['a', 'b'], ...w(MON) } })
    const steps = Object.values(s.tasks).filter((t) => t.parentId === 'q')
    expect(steps).toHaveLength(2)
    expect(steps.filter((t) => t.doOn === MON)).toHaveLength(1)
    expect(s.tasks.q.doOn).toBeUndefined()
    for (const st of steps) s = reducer(s, { type: A.completeTask.type, payload: { id: st.id, ...w(MON) } })
    expect(s.tasks.q.status).toBe('done')
    s = reducer(s, { type: A.reopenTask.type, payload: { id: steps[0].id, ...w(MON) } })
    expect(s.tasks.q.status).toBe('open')
  })

  it('blocks a task by its spawned tail until the tail is done', () => {
    let s = add(initialGrimoire, 'bulb', { doOn: MON })
    s = reducer(s, { type: A.spawnTask.type, payload: { fromId: 'bulb', fields: { id: 'which', title: 'Узнать, какая лампочка' }, ...w(MON) } })
    expect(isBlocked(s.tasks.bulb, s.tasks)).toBe(true)
    expect(s.tasks.which.doOn).toBe(MON)
    expect(chainOf(s, 'bulb').map((t) => t.id)).toEqual(['which'])
    s = reducer(s, { type: A.completeTask.type, payload: { id: 'which', ...w(MON) } })
    expect(isBlocked(s.tasks.bulb, s.tasks)).toBe(false)
  })

  it('brings a repeating deed back once', () => {
    let s = add(initialGrimoire, 'w', { doOn: MON, repeat: { kind: 'everyN', n: 7 } })
    s = reducer(s, { type: A.completeTask.type, payload: { id: 'w', ...w(MON) } })
    s = reducer(s, { type: A.reopenTask.type, payload: { id: 'w', ...w(MON) } })
    s = reducer(s, { type: A.completeTask.type, payload: { id: 'w', ...w(MON) } })
    const next = Object.values(s.tasks).filter((t) => t.repeatOf === 'w')
    expect(next.map((t) => [t.id, t.doOn, t.status])).toEqual([['w@2026-11-02', '2026-11-02', 'open']])
  })

  it('remembers postponements and marks a task stuck after three', () => {
    let s = add(initialGrimoire, 't', { doOn: MON })
    for (let i = 0; i < 3; i++) s = reducer(s, { type: A.postponeTask.type, payload: { id: 't', to: addDays(MON, i + 1), reason: 'tooBig', ...w(addDays(MON, i)) } })
    expect(s.tasks.t.postponements.map((p) => p.day)).toEqual([MON, '2026-10-27', '2026-10-28'])
    expect(isStuck(s.tasks.t)).toBe(true)
  })

  it('shows yesterday’s leftovers in the morning review and sends all to the backlog', () => {
    let s = add(initialGrimoire, 'old', { doOn: MON })
    expect(toReview(s, addDays(MON, 1)).map((t) => t.id)).toEqual(['old'])
    s = reducer(s, A.toBacklog(['old']))
    expect(toReview(s, addDays(MON, 1))).toHaveLength(0)
    expect(s.tasks.old.postponements).toHaveLength(0)
  })

  const habit = (f: Partial<Habit> = {}) => ({
    id: 'h',
    title: 'Вода',
    schedule: { kind: 'daily' as const },
    mark: { kind: 'check' as const },
    stars: 1 as const,
    dread: 0 as const,
    status: 'active' as const,
    activeFrom: MON,
    ...f,
  })

  it('generates habit tasks once a day and turns yesterday’s unticked ones into skips', () => {
    let s = reducer(initialGrimoire, { type: A.upsertHabit.type, payload: { habit: habit(), ...w(MON) } })
    expect(s.tasks[habitTaskId('h', MON)]).toBeTruthy()
    s = reducer(s, { type: A.generateHabitTasks.type, payload: w(addDays(MON, 1)) })
    expect(s.tasks[habitTaskId('h', MON)]).toBeUndefined()
    expect(s.habitLogs[habitLogId('h', MON)]).toMatchObject({ skipped: true })
    expect(s.tasks[habitTaskId('h', addDays(MON, 1))]).toBeTruthy()
    expect(dayPlan(s, addDays(MON, 1)).habits).toHaveLength(1)
  })

  it('makes no habit tasks in «навь»', () => {
    let s = reducer(initialGrimoire, { type: A.upsertHabit.type, payload: { habit: habit(), ...w(MON) } })
    s = reducer(s, { type: A.setNav.type, payload: { active: true, ...w(MON) } })
    s = reducer(s, { type: A.generateHabitTasks.type, payload: w(addDays(MON, 1)) })
    expect(s.tasks[habitTaskId('h', addDays(MON, 1))]).toBeUndefined()
    s = reducer(s, { type: A.setNav.type, payload: { active: false, ...w(addDays(MON, 3)) } })
    expect(s.meta.nav).toMatchObject({ active: false, history: [{ from: at(MON), to: at(addDays(MON, 3)) }] })
  })

  it('ticks the tracker with the task', () => {
    let s = reducer(initialGrimoire, { type: A.upsertHabit.type, payload: { habit: habit(), ...w(MON) } })
    for (let i = 0; i < 7; i++) {
      const d = addDays(MON, i)
      s = reducer(s, { type: A.generateHabitTasks.type, payload: w(d) })
      s = reducer(s, { type: A.completeTask.type, payload: { id: habitTaskId('h', d), ...w(d) } })
    }
    for (let i = 0; i < 7; i++) expect(s.habitLogs[habitLogId('h', addDays(MON, i))]).toBeDefined()
    expect(streak(s.habits.h, s.habitLogs, addDays(MON, 6)).current).toBe(7)
  })

  it('keeps at most three known words in a mirror entry', () => {
    let s = initialGrimoire
    for (const type of ['entry', 'evening', 'taskFeedback'] as const)
      s = reducer(s, { type: A.addJournal.type, payload: { entry: { id: type, type, words: ['joy.2', 'nope', 'joy.2', 'trust.1', 'fear.1', 'anger.3'] }, ...w(MON) } })
    expect(s.journal.entry.words).toEqual(['joy.2', 'trust.1', 'fear.1'])
    // Moving the time back moves the entry to its day.
    s = reducer(s, A.updateJournal({ id: 'entry', at: at(addDays(MON, -2)), words: [] }))
    expect(s.journal.entry.day).toBe(addDays(MON, -2))
    expect(s.journal.entry.words).toBeUndefined()
  })
  it('knows the dictionary: 32 words, neighbours suggest a mixed feeling, synonyms find words', () => {
    expect(Object.keys(emotionWords)).toHaveLength(32)
    expect(dyadFor(['fear.1', 'surprise.2'])).toBe('dyad.awe')
    expect(dyadFor(['joy.1', 'sadness.1'])).toBeUndefined()
    expect(dyadFor(['fear.1', 'surprise.2', 'dyad.awe'])).toBeUndefined()
    expect(searchWords('раздраж').map((x) => x.key)).toEqual(['anger.1', 'anger.2'])
    expect(wordPetals('dyad.optimism')).toEqual(['anticipation', 'joy'])
  })

  it('fulfils a wish once: by its deed or by hand', () => {
    let s = reducer(initialGrimoire, { type: A.upsertWish.type, payload: { wish: { id: 'baikal', title: 'Байкал', tags: [] }, ...w(MON) } })
    s = reducer(s, { type: A.wishToTask.type, payload: { wishId: 'baikal', taskId: 'go', fields: {}, ...w(MON) } })
    expect(s.wishes.baikal.status).toBe('inProgress')
    s = reducer(s, { type: A.completeTask.type, payload: { id: 'go', ...w(MON) } })
    expect(s.wishes.baikal.status).toBe('fulfilled')
    s = reducer(s, { type: A.fulfillWish.type, payload: { id: 'baikal', ...w(MON) } })
    expect(s.wishes.baikal.status).toBe('fulfilled')
    s = reducer(s, { type: A.reopenTask.type, payload: { id: 'go', ...w(MON) } })
    expect(s.wishes.baikal.status).toBe('inProgress')
  })

  it('syncs grimoire rows as their own kinds with the settings under meta/grimoire', () => {
    const s = add(initialGrimoire, 't')
    const ch = diffGrimoire(initialGrimoire, reducer(s, A.updateMeta({ streaksOn: false })))
    expect(ch.map((c) => `${c.op}:${c.kind}:${c.id}`).sort()).toEqual(['upsert:meta:grimoire', 'upsert:task:t'])
    expect(isGrimoireRow('meta', 'grimoire')).toBe(true)
    expect(isGrimoireRow('meta', 'settings')).toBe(false)
  })
})

describe('habit streaks', () => {
  const h = { id: 'h', title: '', schedule: { kind: 'daily' }, mark: { kind: 'check' }, stars: 1, dread: 0, status: 'active', activeFrom: MON, createdAt: at(MON) } as Habit
  const logs = (days: string[]) => Object.fromEntries(days.map((d) => [habitLogId('h', d), { id: habitLogId('h', d), habitId: 'h', date: d, value: 1 }]))
  it('forgives one skip a week but not two', () => {
    const one = logs([MON, '2026-10-27', '2026-10-29', '2026-10-30'])
    expect(streak(h, one, '2026-10-30').current).toBe(4)
    const two = logs([MON, '2026-10-29', '2026-10-30'])
    expect(streak(h, two, '2026-10-30').current).toBe(2)
  })
  it('does not break on today not done yet, and freezes in навь', () => {
    expect(streak(h, logs([MON, '2026-10-27']), '2026-10-28').current).toBe(2)
    const nav = (d: string) => d >= '2026-10-28' && d <= '2026-10-31'
    expect(streak(h, logs([MON, '2026-10-27', '2026-11-01']), '2026-11-01', nav).current).toBe(3)
  })
})

describe('wheel of the year', () => {
  it('computes solstices and equinoxes of 2026', () => {
    const d = (x: Date) => x.toISOString().slice(0, 16)
    // Published UTC moments: 20 Mar 14:46, 21 Jun 08:24, 23 Sep 00:05, 21 Dec 20:50.
    expect(Math.abs(seasonMoment(2026, 0).getTime() - Date.parse('2026-03-20T14:46Z'))).toBeLessThan(5 * 60_000)
    expect(Math.abs(seasonMoment(2026, 1).getTime() - Date.parse('2026-06-21T08:24Z'))).toBeLessThan(5 * 60_000)
    expect(Math.abs(seasonMoment(2026, 2).getTime() - Date.parse('2026-09-23T00:05Z'))).toBeLessThan(5 * 60_000)
    expect(d(seasonMoment(2026, 3)).slice(0, 10)).toBe('2026-12-21')
  })
  it('knows where in the wheel today is', () => {
    const now = wheelNow(MON)
    expect(now.current.sabbat).toBe('mabon')
    expect(now.next).toEqual({ sabbat: 'samhain', day: '2026-10-31' })
    expect(now.daysToNext).toBe(5)
    expect(wheelNow('2026-11-01').current.sabbat).toBe('samhain')
    expect(wheelNow('2027-01-15').current.sabbat).toBe('yule')
  })
  it('turns the southern wheel by half a year', () => {
    expect(sabbatDays(2026, 'south').samhain).toBe('2026-05-01')
    expect(sabbatDays(2026, 'south').beltane).toBe('2026-10-31')
  })
  it('knows the Moon', () => {
    expect(moonPhase('2024-01-25')).toBe(4)
    expect(moonPhase('2024-01-11')).toBe(0)
  })
  it('finds true full and new moons to the minute', () => {
    // Published UTC moments: full 3 Jan 10:03, 1 Feb 22:09, 26 Oct 04:12; new 10 Oct 15:50.
    const off = (k: number, iso: string) => Math.abs(lunarPhaseMoment(k).getTime() - Date.parse(iso))
    expect(off(321.5, '2026-01-03T10:03Z')).toBeLessThan(3 * 60_000)
    expect(off(322.5, '2026-02-01T22:09Z')).toBeLessThan(3 * 60_000)
    expect(off(331.5, '2026-10-26T04:12Z')).toBeLessThan(3 * 60_000)
    expect(off(331, '2026-10-10T15:50Z')).toBeLessThan(3 * 60_000)
  })
  it('marks exactly one esbat day a cycle', () => {
    let n = 0
    for (let d = '2026-01-01'; d <= '2026-12-31'; d = addDays(d, 1)) if (isFullMoon(d)) n++
    // 2026 has 13 full moons.
    expect(n).toBe(13)
    expect(nextFullMoon('2026-10-27')).toBe(dayKey(lunarPhaseMoment(332.5), 0))
    expect(moonPhase(nextFullMoon('2026-10-27'))).toBe(4)
    expect(moonPhase(addDays(nextFullMoon('2026-10-27'), 1))).toBe(5)
  })
  it('says «до Самайна» and «к Самайну»', () => {
    expect(`до ${sabbats.samhain.genitive}`).toBe('до Самайна')
    expect(`к ${sabbats.beltane.dative}`).toBe('к Бельтайну')
    expect(sabbats.ostara.genitive).toBe('Остары')
  })
  it('adds the esbat practices to a grimoire seeded before them, once', () => {
    const old = builtInPractices.filter((p) => p.sabbat !== 'esbat')
    let g: GS = reducer(initialGrimoire, A.seedPractices(old))
    const hidden = old[0]
    g = reducer({ ...g, meta: { ...g.meta, esbatsSeeded: undefined } }, A.deletePractice(hidden.id))
    g = reducer(g, A.seedPractices(builtInPractices))
    expect(Object.values(g.practices).filter((p) => p.sabbat === 'esbat').length).toBeGreaterThan(0)
    // A deleted built-in sabbat practice does not come back with them.
    expect(g.practices[hidden.id]).toBeUndefined()
    const esbat = Object.values(g.practices).find((p) => p.sabbat === 'esbat')!
    g = reducer(g, A.wantPractice({ practiceId: esbat.id }))
    expect(Object.values(g.wishes)[0].sabbat).toBeUndefined()
    g = reducer(g, A.practiceToTask({ practiceId: esbat.id, doOn: '2026-11-24' }))
    expect(Object.values(g.tasks)[0].tags).toEqual(['эсбат'])
  })
})

describe('tags', async () => {
  const { tagPalette, tagPalettes, tagsByUse } = await import('@grimoire-core/grimoire/tags')
  const g = {
    tasks: {
      a: { tags: ['дом', 'бумаги'] },
      b: { tags: ['дом'] },
      c: { tags: ['дача', 'дом'] },
    },
  } as unknown as GS

  it('keeps a steady colour per name until one is chosen', () => {
    expect(tagPalette('дом', {})).toBe(tagPalette('дом', {}))
    expect(tagPalettes).toContain(tagPalette('дом', {}))
    expect(tagPalette('дом', { дом: 'pine' })).toBe('pine')
    // A colour chosen from the old Chakra list maps onto the theme's palette.
    expect(tagPalette('дом', { дом: 'purple' })).toBe('pine')
    expect(tagPalette('дом', { дом: 'nonsense' })).toBe(tagPalette('дом', {}))
  })
  it('puts the most used tags first', () => {
    expect(tagsByUse(g)).toEqual(['дом', 'бумаги', 'дача'])
  })
  it('counts tags on books, notes and templates too', async () => {
    const { tagCounts } = await import('@grimoire-core/grimoire/tags')
    const more = { ...g, books: { x: { tags: ['дача'] } }, notes: { y: { tags: ['дача'] } }, meta: { spells: [{ tags: ['дача'] }] } } as unknown as GS
    expect(tagCounts(more).get('дача')).toBe(4)
  })
  it('wears her own colour or the theme one', async () => {
    const { tagColor } = await import('@grimoire-core/grimoire/tags')
    expect(tagColor('дом', { дом: '#a1b2c3' })).toBe('#a1b2c3')
    expect(tagColor('дом', { дом: 'pine' })).toBe('var(--g-tag-pine)')
  })
  it('removes a tag from everything and forgets its colour', () => {
    let s = reducer(undefined, A.addTask({ fields: { title: 'окна', tags: ['дом', 'весна'] } }))
    s = reducer(s, A.upsertWish({ wish: { title: 'дача', tags: ['дом'] } }))
    s = reducer(s, A.upsertBook({ book: { title: 'Цирцея', status: 'want', tags: ['дом'] } }))
    s = reducer(s, A.updateMeta({ tagColors: { дом: '#112233', весна: 'pine' } }))
    s = reducer(s, A.removeTag('дом'))
    expect(Object.values(s.tasks)[0].tags).toEqual(['весна'])
    expect(Object.values(s.wishes)[0].tags).toEqual([])
    expect(Object.values(s.books)[0].tags).toEqual([])
    expect(s.meta.tagColors).toEqual({ весна: 'pine' })
  })
})

describe('books', () => {
  it('dates the reading by itself and clears what no longer fits', () => {
    let s = reducer(undefined, A.upsertBook({ book: { id: 'b', title: '  Цирцея ', status: 'want', tags: [] }, at: '2026-11-13T10:00:00' } as never))
    expect(s.books.b.title).toBe('Цирцея')
    expect(s.books.b.startedOn).toBeUndefined()
    s = reducer(s, A.upsertBook({ book: { ...s.books.b, status: 'reading' }, at: '2026-11-14T10:00:00' } as never))
    expect(s.books.b.startedOn).toBe('2026-11-14')
    s = reducer(s, A.upsertBook({ book: { ...s.books.b, status: 'read', rating: 5 }, at: '2026-11-20T10:00:00' } as never))
    expect(s.books.b.finishedOn).toBe('2026-11-20')
    expect(s.books.b.rating).toBe(5)
    s = reducer(s, A.upsertBook({ book: { ...s.books.b, status: 'want' } }))
    expect(s.books.b.startedOn).toBeUndefined()
    expect(s.books.b.finishedOn).toBeUndefined()
    expect(s.books.b.rating).toBeUndefined()
  })
})

describe('mirror analytics', async () => {
  const S = await import('@grimoire-core/grimoire/mirrorStats')
  const E = await import('@grimoire-core/grimoire/emotions')
  type J = import('@grimoire-core/grimoire/types').JournalEntry
  const j = (id: string, day: string, words: string[], extra: Partial<J> = {}): J => ({ id, at: `${day}T09:00:00`, day, type: 'entry', words, ...extra })
  const task = { id: 't', title: 'налоги', dread: 3, stars: 2, tags: ['бумаги'], postponements: [{ at: `${MON}T10:00:00`, day: MON }] } as unknown as import('@grimoire-core/grimoire/types').Task

  it('counts petals, a mixed feeling for both', () => {
    const c = S.countPetals([j('a', MON, ['joy.2', 'dyad.love'])])
    expect(c.joy).toBe(2)
    expect(c.trust).toBe(1)
    expect(S.total(c)).toBe(3)
    expect(E.mainPetal(['fear.1', 'fear.2', 'joy.1'])).toBe('fear')
  })
  it('puts the morning words into the morning', () => {
    const r = S.rhythm([j('a', MON, ['fear.1'])])
    expect(r.map((x) => x.key)).toEqual(['morning'])
  })
  it('compares before and after at a dreaded deed, and the tags fear comes to', () => {
    const list = [j('a', MON, ['fear.2'], { taskId: 't', source: 'task_start' }), j('b', MON, ['joy.1'], { taskId: 't', type: 'taskFeedback', source: 'task_done' })]
    const d = S.deedsAndFeelings({ tasks: { t: task } }, list)
    expect(d.before.fear).toBe(1)
    expect(d.after.joy).toBe(1)
    expect(d.tags).toEqual([['бумаги', 1]])
  })
  it('looks at the words before a postponement on its day', () => {
    const p = S.postponeFeelings({ tasks: { t: task } }, [j('a', MON, ['fear.1'])], MON, MON)
    expect(p.moves).toBe(1)
    expect(p.near.fear).toBe(1)
  })
  it('counts the vocabulary and how precise it is', () => {
    const v = S.vocabulary([j('a', MON, ['fear.1', 'fear.2', 'joy.3'])], MON)
    expect(v.now.distinct).toBe(3)
    expect(v.now.precise).toBeCloseTo(2 / 3)
  })
  it('exports the mirror as CSV with words by name', () => {
    const csv = S.mirrorCsv({ journal: { a: j('a', MON, ['anger.1'], { text: 'звонок; опять', factors: ['hobby'] }) }, tasks: {} }, {}, { factor: E.factorLabel, body: E.bodyLabel, action: E.actionLabel })
    const [head, row] = csv.replace('﻿', '').split('\r\n')
    expect(head.startsWith('время;день')).toBe(true)
    expect(row).toContain('досада;anger.1;anger')
    expect(row).toContain('хобби')
    expect(row).toContain('"звонок; опять"')
  })
})

describe('spells and the bestiary', async () => {
  const P = await import('@grimoire-core/grimoire/people')
  it('keeps a quest as a spell and casts it with the steps in order', () => {
    let s: GS = { ...initialGrimoire, meta: { ...initialGrimoire.meta, spells: [] } }
    s = reducer(s, A.addTask({ fields: { id: 'q', title: 'покрасить потолок', stars: 3, tags: ['дом'] } }))
    s = reducer(s, A.splitTask({ id: 'q', steps: ['купить краску', 'застелить пол', 'покрасить'] }))
    const [a, b] = Object.values(s.tasks).filter((t) => t.parentId === 'q').sort((x, y) => x.order! - y.order!)
    s = reducer(s, A.reorderTasks([b.id, a.id]))
    s = reducer(s, A.saveSpell({ taskId: 'q' }))
    const sp = s.meta.spells[0]
    expect(sp.steps.map((x) => x.title)).toEqual(['застелить пол', 'купить краску', 'покрасить'])
    s = reducer(s, A.castSpell({ spellId: sp.id, title: 'потолок в спальне', projectId: 'p1' }))
    const q2 = Object.values(s.tasks).find((t) => t.title === 'потолок в спальне')!
    expect(q2.projectId).toBe('p1')
    expect(q2.stars).toBe(3)
    const steps = Object.values(s.tasks).filter((t) => t.parentId === q2.id).sort((x, y) => x.order! - y.order!)
    expect(steps.map((t) => t.title)).toEqual(['застелить пол', 'купить краску', 'покрасить'])
    expect(steps.every((t) => t.projectId === 'p1' && t.tags.includes('дом'))).toBe(true)
  })
  it('finds the next birthday, a leap one too, and the age', () => {
    expect(P.nextOccurrence('03-14', MON)).toBe('2027-03-14')
    expect(P.nextOccurrence('10-26', MON)).toBe('2026-10-26')
    expect(P.nextOccurrence('2000-02-29', '2027-01-01')).toBe('2027-02-28')
    const soon = P.upcomingDates({ a: { id: 'a', birthday: '1990-11-02', dates: [{ id: 'd', label: 'годовщина', date: '12-31' }] } }, MON, 14)
    expect(soon).toEqual([{ personId: 'a', label: 'день рождения', day: '2026-11-02', inDays: 7, age: 36 }])
  })
  it('lets go of a scar without losing it, and counts the year', () => {
    let s: GS = initialGrimoire
    s = reducer(s, A.addPersonLine({ personId: 'a', list: 'scars', text: 'не пришла', on: '2026-03-10' }))
    s = reducer(s, A.addPersonLine({ personId: 'a', list: 'kindness', text: 'помогла', on: '2026-05-01' }))
    expect(P.liveScars(s.personNotes.a)).toHaveLength(1)
    const id = s.personNotes.a.scars![0].id
    s = reducer(s, A.updatePersonLine({ personId: 'a', list: 'scars', id, patch: { released: MON } }))
    expect(P.liveScars(s.personNotes.a)).toHaveLength(0)
    expect(P.personBalance(s, 'a', MON)).toEqual({ forThem: 0, kindness: 1, scars: 1 })
  })
})

describe('deeds of the workshop', async () => {
  const W = await import('../workshop')
  const { initialData } = await import('@workshop-core/store/dataSlice')
  type D = import('@workshop-core/types').DataState
  const holder = (id: string, stage: string, extra: object = {}) => ({ id, moldId: 'M-001', mixId: 'G-1', purpose: 'holder', mix: {}, dryStart: '2026-10-20T10:00:00.000Z', stage, history: [{ stage, date: '2026-10-20', consumption: [] }], ...extra })
  const data = (holders: object[], candles: object[] = []): D =>
    ({ ...initialData, molds: { 'M-001': { id: 'M-001', name: 'Книжка' } }, holders: Object.fromEntries(holders.map((h: any) => [h.id, h])), candles: Object.fromEntries(candles.map((c: any) => [c.id, c])) }) as unknown as D

  it('knows the next step, the state of an item and the deed title', () => {
    const d = data([holder('P-1', 'varnishIn'), holder('P-2', 'painted'), holder('P-3', 'defect')])
    expect(W.nextStep(d, 'holder', 'P-1')).toBe('painted')
    expect(W.itemState(d, { kind: 'holder', id: 'P-1', step: 'painted' })).toBe('open')
    expect(W.itemState(d, { kind: 'holder', id: 'P-2', step: 'painted' })).toBe('done')
    expect(W.itemState(d, { kind: 'holder', id: 'P-3', step: 'painted' })).toBe('defect')
    expect(W.itemState(d, { kind: 'holder', id: 'P-9', step: 'painted' })).toBe('gone')
    expect(W.questTitle('holder', 'painted', 5)).toBe('Расписать · 5 подсвечников')
    expect(W.itemLabel(d, 'holder', 'P-1')).toBe('P-1 Книжка')
  })
  it('plans the drying check by the settings', () => {
    const d = data([holder('P-1', 'drying')])
    expect(W.plannedDay(d, 'holder', 'dried', ['P-1'], '2026-10-21')).toBe('2026-10-23')
    expect(W.plannedDay(d, 'holder', 'dried', ['P-1'], '2026-10-28')).toBe('2026-10-28')
    expect(W.plannedDay(d, 'holder', 'painted', ['P-1'], '2026-10-21')).toBeUndefined()
  })
  it('ticks a step when the workshop did it, lets a defect go, reopens an undone one', () => {
    let s: GS = initialGrimoire
    s = reducer(s, A.addWorkshopQuest({ title: 'Расписать', kind: 'holder', step: 'painted', items: [{ id: 'P-1', label: 'P-1' }, { id: 'P-2', label: 'P-2' }] }))
    const quest = Object.values(s.tasks).find((t) => t.workshopStep)!
    const [a, b] = Object.values(s.tasks).filter((t) => t.parentId === quest.id).sort((x, y) => x.order! - y.order!)
    const apply = (d: D) => {
      for (const x of W.syncActions(d, s.tasks)) {
        if (x.to === 'done') s = reducer(s, A.completeTask({ id: x.id }))
        else if (x.to === 'open') s = reducer(s, A.reopenTask({ id: x.id }))
        else {
          s = reducer(s, A.cancelTask(x.id))
          s = reducer(s, A.updateTask({ id: x.id, workshop: { ...s.tasks[x.id].workshop!, lost: true } }))
        }
      }
    }
    apply(data([holder('P-1', 'painted'), holder('P-2', 'varnishIn')]))
    expect(s.tasks[a.id].status).toBe('done')
    expect(s.tasks[b.id].status).toBe('open')
    apply(data([holder('P-1', 'painted'), holder('P-2', 'defect')]))
    expect(s.tasks[b.id].status).toBe('cancelled')
    expect(s.tasks[quest.id].status).toBe('done')
    apply(data([holder('P-1', 'varnishIn'), holder('P-2', 'defect')]))
    expect(s.tasks[a.id].status).toBe('open')
    expect(s.tasks[quest.id].status).toBe('open')
  })
  it('offers the next step for the same items', () => {
    let s: GS = initialGrimoire
    s = reducer(s, A.addWorkshopQuest({ title: 'Расписать', kind: 'holder', step: 'painted', items: [{ id: 'P-1', label: 'P-1' }, { id: 'P-2', label: 'P-2' }] }))
    const quest = Object.values(s.tasks).find((t) => t.workshopStep)!
    for (const t of Object.values(s.tasks).filter((t) => t.parentId === quest.id)) s = reducer(s, A.completeTask({ id: t.id }))
    const o = W.nextOffer(data([holder('P-1', 'painted'), holder('P-2', 'painted')]), s.tasks, s.tasks[quest.id])
    expect(o).toEqual({ kind: 'holder', step: 'varnishOut', ids: ['P-1', 'P-2'], done: 2 })
    expect(W.doneTitle('holder', 'painted', 2)).toBe('Расписала 2')
  })
})

describe('the cycle', async () => {
  const C = await import('@grimoire-core/grimoire/cycle')
  const S = await import('@grimoire-core/grimoire/mirrorStats')
  const mk = (starts: [string, string?][]) => Object.fromEntries(starts.map(([start, end], i) => [`c${i}`, { id: `c${i}`, start, end }]))
  it('guesses 28 days until three cycles, then counts the last ones', () => {
    expect(C.cycleStats(mk([['2026-09-01', '2026-09-05']]))).toEqual({ length: 28, period: 5, approx: true, cycles: 0 })
    const four = mk([['2026-06-01', '2026-06-04'], ['2026-06-31'.replace('06-31', '07-01'), '2026-07-04'], ['2026-07-31', '2026-08-03'], ['2026-08-30', '2026-09-02']])
    const s = C.cycleStats(four)
    expect(s.approx).toBe(false)
    expect(s.length).toBe(30)
    expect(s.period).toBe(4)
  })
  it('places a day in its phase and forecasts the next start', () => {
    const cycles = mk([['2026-10-01', '2026-10-05']])
    expect(C.cycleDay(cycles, '2026-09-30')).toBeUndefined()
    expect(C.cycleDay(cycles, '2026-10-03')).toMatchObject({ n: 3, phase: 'menstrual', predicted: false })
    expect(C.cycleDay(cycles, '2026-10-08')?.phase).toBe('follicular')
    expect(C.cycleDay(cycles, '2026-10-14')?.phase).toBe('ovulation')
    expect(C.cycleDay(cycles, '2026-10-20')).toMatchObject({ phase: 'luteal', nextStart: '2026-10-29' })
    expect(C.cycleDay(cycles, '2026-10-30')).toMatchObject({ n: 2, phase: 'menstrual', predicted: true })
  })
  it('averages the energy by phase over marked cycles', () => {
    const cycles = mk([['2026-10-01', '2026-10-05']])
    const e = (day: string, energy: number) => ({ id: day, at: `${day}T10:00:00`, day, type: 'entry' as const, energy })
    const r = S.cycleEnergy([e('2026-10-02', 2), e('2026-10-03', 1), e('2026-10-09', 4)], cycles)
    expect(r.byPhase.menstrual).toBe(1.5)
    expect(r.byPhase.follicular).toBe(4)
    expect(r.all).toBeCloseTo(7 / 3)
  })
  it('halves the stars limit on an easy day', () => {
    const s = { ...initialGrimoire, meta: { ...initialGrimoire.meta, dayStars: 6, easyDay: MON } }
    expect(dayStars(s, MON).limit).toBe(3)
    expect(dayStars(s, '2026-10-27').limit).toBe(6)
  })
})

describe('jars', async () => {
  const J = await import('@grimoire-core/grimoire/jars')
  it('fills a jar, is collected when full, and a spent jar makes its wish come true', () => {
    let s: GS = initialGrimoire
    s = reducer(s, A.upsertWish({ wish: { id: 'w', title: 'торшер', tags: [], price: 1000 } }))
    s = reducer(s, A.wishToJar({ wishId: 'w', goal: 1000 }))
    const jar = Object.values(s.jars)[0]
    expect(s.wishes.w.status).toBe('inProgress')
    s = reducer(s, A.addJarTx({ jarId: jar.id, amount: 600 }))
    expect(s.jars[jar.id].status).toBe('saving')
    s = reducer(s, A.addJarTx({ jarId: jar.id, amount: 400 }))
    expect(s.jars[jar.id].status).toBe('collected')
    s = reducer(s, A.addJarTx({ jarId: jar.id, amount: -100 }))
    expect(s.jars[jar.id].status).toBe('saving')
    s = reducer(s, A.addJarTx({ jarId: jar.id, amount: 100 }))
    expect(s.jars[jar.id].status).toBe('collected')
    s = reducer(s, A.setJarStatus({ id: jar.id, status: 'spent' }))
    expect(s.wishes.w.status).toBe('fulfilled')
  })
  it('a ritual puts its sum in, and unticking takes it back', () => {
    let s: GS = initialGrimoire
    s = reducer(s, A.upsertJar({ jar: { id: 'j', title: 'отпуск', goal: 10000, currency: '₽' } }))
    s = reducer(s, { type: A.upsertHabit.type, payload: { habit: { id: 'h', title: 'отложить', schedule: { kind: 'daily' }, mark: { kind: 'check' }, stars: 1, dread: 0, status: 'active', jarId: 'j', jarAmount: 1000 }, ...w(MON) } })
    const tid = habitTaskId('h', MON)
    s = reducer(s, { type: A.completeTask.type, payload: { id: tid, ...w(MON) } })
    expect(Object.values(s.jarTxs).map((x) => x.amount)).toEqual([1000])
    s = reducer(s, { type: A.reopenTask.type, payload: { id: tid, ...w(MON) } })
    expect(Object.values(s.jarTxs)).toHaveLength(0)
  })
  it('a wish embodied as a quest comes true with the quest; as a project, when the book is read', () => {
    let s: GS = initialGrimoire
    s = reducer(s, A.upsertWish({ wish: { id: 'w', title: 'ремонт', tags: [] } }))
    s = reducer(s, A.wishToTask({ wishId: 'w', steps: ['обои', 'пол'] }))
    for (const t of Object.values(s.tasks).filter((t) => t.parentId)) s = reducer(s, A.completeTask({ id: t.id }))
    expect(s.wishes.w.status).toBe('fulfilled')
    s = reducer(s, A.upsertWish({ wish: { id: 'w2', title: 'сад', tags: [] } }))
    s = reducer(s, A.wishToProject({ wishId: 'w2' }))
    const pid = s.wishes.w2.projectId!
    s = reducer(s, A.addTask({ fields: { id: 'd', title: 'посадить', projectId: pid } }))
    s = reducer(s, A.completeTask({ id: 'd' }))
    expect(s.wishes.w2.status).toBe('fulfilled')
  })
  it('plans by the date or by the pace', () => {
    const jar = { id: 'j', title: 'x', goal: 10000, currency: '₽', status: 'saving' as const, targetDate: '2026-11-23' }
    expect(J.jarPlan(jar, [{ id: 't', jarId: 'j', at: `${MON}T10:00:00`, amount: 2000 }], MON).perWeek).toBe(2000)
    const pace = J.jarPlan({ ...jar, targetDate: undefined }, [{ id: 't', jarId: 'j', at: `${MON}T10:00:00`, amount: 4000 }], MON)
    expect(pace.perWeek).toBe(500)
    expect(pace.when).toBe('2027-01-18')
  })
})

describe('push notifications', async () => {
  const N = await import('@grimoire-core/grimoire/notify')
  it('sends each kind once, in its window, and nothing in the навь', () => {
    let s: GS = initialGrimoire
    s = reducer(s, A.addTask({ fields: { id: 'a', title: 'налоги', doOn: MON, priority: 'high', dueAt: MON } }))
    const m = N.dueMessages(s, MON, '09:20', [])
    expect(m.map((x) => x.kind)).toEqual(['morning'])
    expect(m[0].body).toContain('важнее всего — налоги')
    expect(m[0].body).toContain('Срок сегодня: налоги')
    expect(N.dueMessages(s, MON, '09:20', ['morning'])).toEqual([])
    expect(N.dueMessages(s, MON, '13:00', [])).toEqual([])
    expect(N.dueMessages(s, MON, '21:10', []).map((x) => x.kind)).toEqual(['evening'])
    const nav = { ...s, meta: { ...s.meta, nav: { ...s.meta.nav, active: true } } }
    expect(N.dueMessages(nav, MON, '09:20', [])).toEqual([])
  })
  it('names the sabbat on its eve', () => {
    const m = N.morningMessage(initialGrimoire, '2026-10-30')
    expect(m!.body).toContain('Завтра Самайн')
  })
  it('during an event names it in the morning and asks for no rituals in the evening', () => {
    let s: GS = reducer(initialGrimoire, { type: A.upsertHabit.type, payload: { habit: { id: 'h', title: 'вода', schedule: { kind: 'daily' }, mark: { kind: 'check' }, stars: 1, dread: 0, status: 'active', activeFrom: MON }, ...w(MON) } })
    expect(N.eveningMessage(s, MON)!.body).toContain('Ритуалы: вода')
    s = { ...s, events: { e: { id: 'e', title: 'Поездка', sigil: '🧳', from: MON, to: addDays(MON, 2), createdAt: at(MON) } } }
    expect(N.eveningMessage(s, MON)!.body).not.toContain('Ритуалы')
    expect(N.morningMessage(s, MON)!.body).toContain('🧳 Поездка, ритуалы на паузе.')
  })
})

describe('new deed form', async () => {
  const { defaultDraft, draftToFields } = await import('@grimoire-core/grimoire/newTask')

  it('starts in the backlog, on today from the day scroll, in the book from a book', () => {
    expect(defaultDraft({}, MON)).toEqual({ title: '', stars: 1, dread: 0, tags: [], type: 'deed' })
    expect(defaultDraft({ planToday: true }, MON)).toEqual({ title: '', stars: 1, dread: 0, tags: [], type: 'deed', doOn: MON })
    expect(defaultDraft({ fields: { projectId: 'p1', source: 'project' }, title: 'окна' }, MON)).toMatchObject({ title: 'окна', projectId: 'p1', source: 'project' })
  })
  it('trims, drops empty fields and keeps symbols as plain text', () => {
    const f = draftToFields({ title: '  купить #2 **☠ ', stars: 2, dread: 1, tags: [], type: 'deed', note: ' ', why: [], personIds: [], checklist: [{ id: 'a', text: ' купить ' }, { id: 'b', text: ' ' }] })
    expect(f).toEqual({ title: 'купить #2 **☠', stars: 2, dread: 1, tags: [], type: 'deed', checklist: [{ id: 'a', text: 'купить' }] })
  })
  it('stores «нормальный» as no priority and keeps the others', () => {
    const base: import('@grimoire-core/grimoire/newTask').TaskDraft = { title: 'x', stars: 1, dread: 0, tags: [], type: 'deed' }
    expect(draftToFields({ ...base, doOn: MON })).not.toHaveProperty('priority')
    expect(draftToFields({ ...base, priority: 'medium' })).not.toHaveProperty('priority')
    expect(draftToFields({ ...base, priority: 'lowest' }).priority).toBe('lowest')
    expect(draftToFields({ ...base, doOn: MON, slot: 'main' })).not.toHaveProperty('slot')
  })
})

describe('priorities', async () => {
  const { priorityOf, dayPlan } = await import('@grimoire-core/grimoire/selectors')
  const { migrateGrimoire } = await import('@grimoire-core/store/grimoireSlice')
  it('read the old plan parts and sort the day by urgency', () => {
    expect(priorityOf({})).toBe('medium')
    expect(priorityOf({ slot: 'main' })).toBe('high')
    expect(priorityOf({ slot: 'optional' })).toBe('low')
    let s: GS = initialGrimoire
    s = reducer(s, A.addTask({ fields: { id: 'low', title: 'потом', doOn: MON, priority: 'low' } }))
    s = reducer(s, A.addTask({ fields: { id: 'mid', title: 'обычное', doOn: MON } }))
    s = reducer(s, A.addTask({ fields: { id: 'top', title: 'горит', doOn: MON, priority: 'highest' } }))
    expect(dayPlan(s, MON).all.map((t) => t.id)).toEqual(['top', 'mid', 'low'])
    expect(s.tasks.mid).not.toHaveProperty('priority')
    s = reducer(s, A.updateTask({ id: 'top', priority: 'medium' }))
    expect(s.tasks.top).not.toHaveProperty('priority')
  })
  it('migrates old deeds and the old plan limits once', () => {
    const old = { tasks: { a: { id: 'a', title: 'a', slot: 'main', status: 'done' } }, meta: { planLimit: { main: 1, extra: 2, optional: 1 } } } as unknown as GS
    const g = migrateGrimoire(old)
    expect(g.tasks.a).toMatchObject({ priority: 'high' })
    expect(g.tasks.a).not.toHaveProperty('slot')
    expect(g.meta.planMax).toBe(4)
    expect(g.meta).not.toHaveProperty('planLimit')
    expect(migrateGrimoire({ meta: { planLimit: { main: 1, extra: 0, optional: 1 } } } as unknown as GS).meta.planMax).toBe(0)
  })
})

describe('suggestions while typing', async () => {
  const { matchSuggestions } = await import('../../components/grimoire/SuggestInput')
  const opts = ['Аня', 'Мама', 'Ксюша Ан'].map((x) => ({ value: x, label: x }))
  it('shows nothing until something is typed, the start of a name first', () => {
    expect(matchSuggestions('', opts)).toEqual([])
    expect(matchSuggestions('ан', opts).map((x) => x.value)).toEqual(['Аня', 'Ксюша Ан'])
    expect(matchSuggestions('зз', opts)).toEqual([])
  })
})

describe('wishlist round two', () => {
  const add = (s: GS, id: string, f: object = {}) => reducer(s, { type: A.addTask.type, payload: { fields: { id, title: id, ...f }, ...w(MON) } })
  const done = (s: GS, id: string) => reducer(s, { type: A.completeTask.type, payload: { id, ...w(MON) } })

  it('a chain spell brings its next step only when the one before is done', () => {
    let s = reducer(initialGrimoire, {
      type: A.upsertSpell.type,
      payload: { spell: { id: 'wash', title: 'Стирка', stars: 1, dread: 0, tags: ['дом'], chain: true, steps: [{ title: 'Постирать', stars: 1, dread: 0 }, { title: 'Развесить', stars: 1, dread: 0 }] }, ...w(MON) },
    })
    s = reducer(s, { type: A.castSpell.type, payload: { spellId: 'wash', questId: 'q', ...w(MON) } })
    expect(Object.values(s.tasks).map((t) => t.title)).toEqual(['Постирать'])
    expect(s.meta.spells[0].uses).toBe(1)
    s = done(s, 'q')
    const next = Object.values(s.tasks).find((t) => t.title === 'Развесить')!
    expect(next).toMatchObject({ status: 'open', spawnedFrom: 'q', tags: ['дом'] })
    expect(next.chainNext).toBeUndefined()
    // Done twice (undo and again) — still one next step.
    s = reducer(s, { type: A.reopenTask.type, payload: { id: 'q', ...w(MON) } })
    s = done(s, 'q')
    expect(Object.values(s.tasks).filter((t) => t.title === 'Развесить')).toHaveLength(1)
  })

  it('an archived book takes its open deeds along, if asked, and gives them back to the backlog', () => {
    let s = reducer(initialGrimoire, { type: A.upsertProject.type, payload: { project: { id: 'p', title: 'Ремонт', status: 'active' }, ...w(MON) } })
    s = add(s, 'a', { projectId: 'p', doOn: MON })
    s = add(s, 'b', { projectId: 'p' })
    s = done(s, 'b')
    s = reducer(s, A.archiveProject({ id: 'p', tasks: 'shelve' }))
    expect(s.projects.p.status).toBe('archived')
    expect(s.tasks.a).toMatchObject({ shelved: true })
    expect(s.tasks.a.doOn).toBeUndefined()
    expect(dayPlan(s, MON).all).toHaveLength(0)
    s = reducer(s, A.unarchiveProject('p'))
    expect(s.tasks.a.shelved).toBeUndefined()
    expect(s.projects.p.status).toBe('active')
    s = reducer(s, A.deleteProject({ id: 'p', tasks: 'delete' }))
    expect(s.projects.p).toBeUndefined()
    expect(s.tasks.a).toBeUndefined()
    expect(s.tasks.b).toBeDefined()
    expect(s.tasks.b.projectId).toBeUndefined()
  })

  it('an event moves the deeds of its days as chosen and pauses rituals without skips', () => {
    let s = add(initialGrimoire, 'x', { doOn: addDays(MON, 1) })
    s = add(s, 'y', { doOn: addDays(MON, 2) })
    s = reducer(s, {
      type: A.upsertEvent.type,
      payload: { event: { id: 'e', title: 'Поездка', from: addDays(MON, 1), to: addDays(MON, 3) }, fate: { x: 'after', y: 'backlog' }, ...w(MON) },
    })
    expect(s.tasks.x.doOn).toBe(addDays(MON, 4))
    expect(s.tasks.y.doOn).toBeUndefined()
    s = reducer(s, { type: A.upsertHabit.type, payload: { habit: { id: 'h', title: 'вода', schedule: { kind: 'daily' }, mark: { kind: 'check' }, stars: 1, dread: 0, status: 'active', activeFrom: MON }, ...w(MON) } })
    s = reducer(s, { type: A.generateHabitTasks.type, payload: w(addDays(MON, 2)) })
    expect(Object.values(s.tasks).filter((t) => t.habitId === 'h' && t.doOn === addDays(MON, 2))).toHaveLength(0)
  })

  it('a note to repeat climbs the ladder on «помню» and comes back tomorrow otherwise', () => {
    let s = reducer(initialGrimoire, { type: A.upsertNote.type, payload: { note: { id: 'n', text: 'цитата', tags: [], repeat: true }, ...w(MON) } })
    expect(s.notes.n.nextOn).toBe(addDays(MON, 1))
    s = reducer(s, { type: A.reviewNote.type, payload: { id: 'n', remember: true, ...w(addDays(MON, 1)) } })
    expect(s.notes.n).toMatchObject({ step: 1, nextOn: addDays(MON, 4) })
    s = reducer(s, { type: A.reviewNote.type, payload: { id: 'n', remember: false, ...w(addDays(MON, 4)) } })
    expect(s.notes.n).toMatchObject({ step: 0, nextOn: addDays(MON, 5) })
  })

  it('stores the new collections as their own rows', () => {
    const next = { ...initialGrimoire, events: { e: { id: 'e', title: 't', from: MON, to: MON, createdAt: at(MON) } } }
    expect(diffGrimoire(initialGrimoire, next)).toEqual([{ op: 'upsert', kind: 'event', id: 'e', data: next.events.e }])
    expect(isGrimoireRow('tarot', 'r')).toBe(true)
  })
})

describe('wish filters', async () => {
  const { filterWishes } = await import('@grimoire-core/grimoire/wishes')
  type W = import('@grimoire-core/grimoire/types').Wish
  const w = (id: string, extra: Partial<W> = {}): W => ({ id, title: id, tags: [], status: 'dream', createdAt: '2026-01-01T10:00:00', ...extra })
  const list = [
    w('тент', { createdAt: '2026-01-01T10:00:00', description: 'на балкон', tags: ['дом'], price: 5000, relevantUntil: '2026-11-20' }),
    w('подсвечник', { createdAt: '2026-03-01T10:00:00', tags: ['крафт'], priority: 'high' }),
    w('книжный', { createdAt: '2026-02-01T10:00:00', tags: ['дом', 'крафт'], price: 20000, relevantUntil: '2026-10-01' }),
  ]
  const ids = (x: W[]) => x.map((v) => v.id)
  const today = '2026-11-13'
  it('searches the title and the description', () => {
    expect(ids(filterWishes(list, { q: 'балкон' }, today))).toEqual(['тент'])
  })
  it('takes any of the chosen tags', () => {
    expect(ids(filterWishes(list, { tags: ['крафт'], sort: 'old' }, today))).toEqual(['книжный', 'подсвечник'])
  })
  it('filters by deadline and price range', () => {
    expect(ids(filterWishes(list, { deadline: 'has', sort: 'urgent' }, today))).toEqual(['книжный', 'тент'])
    expect(ids(filterWishes(list, { deadline: 'has', within: 'twoWeeks' }, today))).toEqual(['тент'])
    expect(ids(filterWishes(list, { deadline: 'has', within: 'month' }, today))).toEqual(['тент'])
    expect(ids(filterWishes(list, { deadline: 'has', within: 'overdue' }, today))).toEqual(['книжный'])
    expect(ids(filterWishes(list, { deadline: 'none' }, today))).toEqual(['подсвечник'])
    expect(ids(filterWishes(list, { priceFrom: 1000, priceTo: 10000 }, today))).toEqual(['тент'])
  })
  it('sorts by deadline, age and price, the ones without last', () => {
    expect(ids(filterWishes(list, { sort: 'urgent' }, today))).toEqual(['книжный', 'тент', 'подсвечник'])
    expect(ids(filterWishes(list, { sort: 'later' }, today))).toEqual(['тент', 'книжный', 'подсвечник'])
    expect(ids(filterWishes(list, { sort: 'old' }, today))).toEqual(['тент', 'книжный', 'подсвечник'])
    expect(ids(filterWishes(list, { sort: 'new' }, today))).toEqual(['подсвечник', 'книжный', 'тент'])
    expect(ids(filterWishes(list, { sort: 'priceDesc' }, today))).toEqual(['книжный', 'тент', 'подсвечник'])
    expect(ids(filterWishes(list, { sort: 'priorityHigh' }, today))[0]).toBe('подсвечник')
    expect(ids(filterWishes(list, { sort: 'priorityLow' }, today))[2]).toBe('подсвечник')
    expect(ids(filterWishes(list, {}, today))[0]).toBe('подсвечник')
  })
})

describe('book shelf', async () => {
  const { filterBooks, moveInQueue } = await import('@grimoire-core/grimoire/books')
  type B = import('@grimoire-core/grimoire/types').Book
  const b = (id: string, extra: Partial<B> = {}): B => ({ id, title: id, tags: [], status: 'want', createdAt: '2026-01-01T10:00:00', ...extra })
  const list = [
    b('дюна', { createdAt: '2026-01-01T10:00:00', tags: ['фантастика'], format: 'paper', queue: 2 }),
    b('мастер', { createdAt: '2026-02-01T10:00:00', tags: ['классика'], format: 'ebook', priority: 'high', queue: 1 }),
    b('старая', { createdAt: '2025-12-01T10:00:00', format: 'print' }),
    b('прочла', { status: 'read', finishedOn: '2026-10-01' }),
  ]
  const ids = (x: B[]) => x.map((v) => v.id)
  it('keeps «хочу прочесть» in its queue, the unnumbered after', () => {
    expect(ids(filterBooks(list, 'want', {}))).toEqual(['мастер', 'дюна', 'старая'])
  })
  it('filters by tags and format, sorts by priority', () => {
    expect(ids(filterBooks(list, 'want', { tags: ['фантастика', 'классика'], sort: 'old' }))).toEqual(['дюна', 'мастер'])
    expect(ids(filterBooks(list, 'want', { format: 'print' }))).toEqual(['старая'])
    expect(ids(filterBooks(list, 'want', { sort: 'priorityHigh' }))[0]).toBe('мастер')
    expect(ids(filterBooks(list, 'read', { sort: 'queue' }))).toEqual(['прочла'])
  })
  it('moves a book in the queue and numbers them all', () => {
    expect(moveInQueue(list, 'старая', -1)).toEqual({ мастер: 1, старая: 2, дюна: 3 })
    expect(moveInQueue(list, 'мастер', -1)).toEqual({ мастер: 1, дюна: 2, старая: 3 })
  })
  it('puts a new book at the end of the queue and drops the place when it is read', () => {
    let s = reducer(initialGrimoire, A.upsertBook({ book: { id: 'a', title: 'А', status: 'want', tags: [] } }))
    s = reducer(s, A.upsertBook({ book: { id: 'b', title: 'Б', status: 'want', tags: [] } }))
    expect([s.books.a.queue, s.books.b.queue]).toEqual([1, 2])
    s = reducer(s, A.upsertBook({ book: { ...s.books.a, status: 'reading' } }))
    expect(s.books.a.queue).toBeUndefined()
    s = reducer(s, A.upsertBook({ book: { ...s.books.a, status: 'want' } }))
    expect(s.books.a.queue).toBe(3)
  })
})

describe('hall of fame', () => {
  it('gives a fulfilled wish back to the chest', () => {
    let s = reducer(initialGrimoire, A.upsertWish({ wish: { id: 'w', title: 'море', tags: [] } }))
    s = reducer(s, A.fulfillWish({ id: 'w', note: 'было' }))
    s = reducer(s, A.restoreWish('w'))
    expect(s.wishes.w.status).toBe('dream')
    expect(s.wishes.w.fulfilledAt).toBeUndefined()
    expect(s.wishes.w.fulfilledNote).toBe('было')
  })
})
