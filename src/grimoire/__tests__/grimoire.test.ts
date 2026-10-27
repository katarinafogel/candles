import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))
vi.mock('localforage', () => ({ default: { setItem: async () => {}, getItem: async () => null, config: () => {} } }))

const { parseQuickAdd, parseDay } = await import('../parse')
const { baseCoins, balance, taskCoins } = await import('../coins')
const { addDays, dayKey, daysBetween, weekday, humanDay, nextRepeat } = await import('../days')
const { sabbatDays, wheelNow, moonPhase, seasonMoment, isFullMoon, nextFullMoon, sabbats, builtInPractices, lunarPhaseMoment } = await import('../wheel')
const { streak, habitLogId, habitTaskId } = await import('../habits')
const { default: reducer, grimoireActions: A, initialGrimoire, migrateGrimoire } = await import('../../store/grimoireSlice')
const { diffGrimoire, isGrimoireRow } = await import('../../lib/sync')
const { emotionWords, dyadFor, searchWords, wordPetals } = await import('../emotions')
const { dayPlan, dayStars, isBlocked, isStuck, toReview, chainOf, cardTone, projectProgress, projectTasks } = await import('../selectors')
type GS = typeof initialGrimoire
type Habit = import('../types').Habit

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
  it('caps the marks and reads slots and days', () => {
    expect(parseQuickAdd('**** ☠☠☠☠ зуб +главное', MON)).toMatchObject({ stars: 3, dread: 3, slot: 'main', doOn: MON, title: 'зуб' })
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

describe('coins', () => {
  it('follows the formula from the spec', () => {
    expect(baseCoins({ stars: 1, dread: 0 })).toBe(10)
    expect(baseCoins({ stars: 3, dread: 3 })).toBe(75)
  })
  it('adds the on-time bonus and halves a partial deed', () => {
    const t = { stars: 2, dread: 1, dueAt: '2026-10-28', extraCoins: 3 } as never
    expect(taskCoins(t, MON).total).toBe(30 + 5 + 3)
    expect(taskCoins(t, '2026-10-29').total).toBe(33)
    expect(taskCoins(t, MON, undefined, true).total).toBe(15)
  })
})

describe('grimoire reducer', () => {
  const add = (s: GS, id: string, f: object = {}) => reducer(s, { type: A.addTask.type, payload: { fields: { id, title: id, ...f }, ...w(MON) } })

  it('pays for a deed, takes the coins back on reopen, pays the rest after a partial', () => {
    let s = add(initialGrimoire, 't', { stars: 3, dread: 2 })
    s = reducer(s, { type: A.completeTask.type, payload: { id: 't', partial: true, ...w(MON) } })
    expect(balance(s.coinTxs)).toBe(30)
    s = reducer(s, { type: A.completeTask.type, payload: { id: 't', ...w(MON) } })
    expect(balance(s.coinTxs)).toBe(60)
    expect(s.tasks.t).toMatchObject({ status: 'done', doneDay: MON })
    s = reducer(s, { type: A.reopenTask.type, payload: { id: 't', ...w(MON) } })
    expect(balance(s.coinTxs)).toBe(0)
    expect(Object.values(s.coinTxs).some((x) => x.tag === 'undo' && x.amount === -60)).toBe(true)
    expect(s.tasks.t.status).toBe('open')
  })

  it('makes a frog of a monster and pays it one and a half times, rounded up', () => {
    let s = add(initialGrimoire, 't', { stars: 3, dread: 3 })
    expect(s.tasks.t.frog).toBe('auto')
    s = reducer(s, { type: A.completeTask.type, payload: { id: 't', ...w(MON) } })
    expect(balance(s.coinTxs)).toBe(113) // 75 · 1,5 = 112,5
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

  it('closes a book with its last deed, pays the bonus once and takes it back on undo', () => {
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
    const bonus = () => Object.values(s.coinTxs).filter((x) => x.refId === 'p').reduce((n, x) => n + x.amount, 0)
    expect(bonus()).toBe(50)
    // A new deed reopens the book but keeps the bonus; finishing again does not pay twice.
    s = add(s, 'b', { projectId: 'p' })
    expect(s.projects.p.status).toBe('active')
    s = reducer(s, { type: A.cancelTask.type, payload: { id: 'b', ...w(MON) } })
    expect(s.projects.p.status).toBe('done')
    expect(bonus()).toBe(50)
    // Undoing a deed takes the bonus back.
    s = reducer(s, { type: A.reopenTask.type, payload: { id: 'a', ...w(MON) } })
    expect(s.projects.p.status).toBe('active')
    expect(bonus()).toBe(0)
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

  it('pays «начать понемногу» once and keeps it on reopen', () => {
    let s = add(initialGrimoire, 't')
    s = reducer(s, { type: A.startTask.type, payload: { id: 't', ...w(MON) } })
    s = reducer(s, { type: A.startTask.type, payload: { id: 't', ...w(MON) } })
    expect(balance(s.coinTxs)).toBe(2)
    s = reducer(s, { type: A.completeTask.type, payload: { id: 't', ...w(MON) } })
    s = reducer(s, { type: A.reopenTask.type, payload: { id: 't', ...w(MON) } })
    expect(balance(s.coinTxs)).toBe(2)
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
    expect(balance(s.coinTxs)).toBe(10 + 10 + 20)
    s = reducer(s, { type: A.reopenTask.type, payload: { id: steps[0].id, ...w(MON) } })
    expect(s.tasks.q.status).toBe('open')
    expect(balance(s.coinTxs)).toBe(10)
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

  it('ticks the tracker with the task and pays the 7-day streak once', () => {
    let s = reducer(initialGrimoire, { type: A.upsertHabit.type, payload: { habit: habit(), ...w(MON) } })
    for (let i = 0; i < 7; i++) {
      const d = addDays(MON, i)
      s = reducer(s, { type: A.generateHabitTasks.type, payload: w(d) })
      s = reducer(s, { type: A.completeTask.type, payload: { id: habitTaskId('h', d), ...w(d) } })
    }
    const streakTx = Object.values(s.coinTxs).filter((x) => x.tag === 'streak')
    expect(streakTx).toHaveLength(1)
    expect(streakTx[0].amount).toBe(15)
    expect(balance(s.coinTxs)).toBe(7 * 10 + 15)
  })

  it('pays nothing for mirror entries and keeps at most three known words', () => {
    let s = initialGrimoire
    for (const type of ['entry', 'evening', 'taskFeedback'] as const)
      s = reducer(s, { type: A.addJournal.type, payload: { entry: { id: type, type, words: ['joy.2', 'nope', 'joy.2', 'trust.1', 'fear.1', 'anger.3'] }, ...w(MON) } })
    expect(balance(s.coinTxs)).toBe(0)
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
    expect(balance(s.coinTxs)).toBe(10 + 30)
    s = reducer(s, { type: A.reopenTask.type, payload: { id: 'go', ...w(MON) } })
    expect(s.wishes.baikal.status).toBe('inProgress')
    expect(balance(s.coinTxs)).toBe(0)
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
  const h = { id: 'h', title: '', schedule: { kind: 'daily' }, mark: { kind: 'check' }, stars: 1, dread: 0, status: 'active', shields: 0, activeFrom: MON, createdAt: at(MON) } as Habit
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
  const { tagPalette, tagPalettes, tagsByUse, suggestTags, typingTag, completeTag } = await import('../tags')
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
    expect(tagPalette('дом', { дом: 'purple' })).toBe('purple')
    expect(tagPalette('дом', { дом: 'nonsense' })).toBe(tagPalette('дом', {}))
  })
  it('suggests the most used tags first, without those already on the deed', () => {
    expect(tagsByUse(g)).toEqual(['дом', 'бумаги', 'дача'])
    expect(suggestTags('д', tagsByUse(g))).toEqual(['дом', 'дача'])
    expect(suggestTags('#Д', tagsByUse(g), ['дом'])).toEqual(['дача'])
    expect(suggestTags('дом', tagsByUse(g))).toEqual([])
  })
  it('finds and completes the tag being typed at the end of the line', () => {
    expect(typingTag('помыть окна #до')).toBe('до')
    expect(typingTag('помыть #')).toBe('')
    expect(typingTag('помыть #дом окна')).toBeUndefined()
    expect(completeTag('помыть окна #до', 'дом')).toBe('помыть окна #дом ')
  })
})

describe('mirror analytics', async () => {
  const S = await import('../mirrorStats')
  const E = await import('../emotions')
  type J = import('../types').JournalEntry
  const j = (id: string, day: string, words: string[], extra: Partial<J> = {}): J => ({ id, at: `${day}T09:00:00`, day, type: 'entry', words, ...extra })
  const task = { id: 't', title: 'налоги', dread: 3, stars: 2, tags: ['бумаги'], postponements: [{ at: `${MON}T10:00:00`, day: MON }] } as unknown as import('../types').Task

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
