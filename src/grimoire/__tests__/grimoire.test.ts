import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))
vi.mock('localforage', () => ({ default: { setItem: async () => {}, getItem: async () => null, config: () => {} } }))

const { parseQuickAdd, parseDay } = await import('../parse')
const { baseCoins, balance, taskCoins } = await import('../coins')
const { addDays, dayKey, daysBetween, weekday, humanDay, nextRepeat } = await import('../days')
const { sabbatDays, wheelNow, moonPhase, seasonMoment } = await import('../wheel')
const { streak, habitLogId, habitTaskId } = await import('../habits')
const { default: reducer, grimoireActions: A, initialGrimoire, migrateGrimoire } = await import('../../store/grimoireSlice')
const { diffGrimoire, isGrimoireRow } = await import('../../lib/sync')
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

  it('pays +2 for the first mirror entry of the day and +1 for each feedback', () => {
    let s = initialGrimoire
    for (const type of ['entry', 'evening', 'taskFeedback', 'taskFeedback'] as const)
      s = reducer(s, { type: A.addJournal.type, payload: { entry: { id: `${type}${Object.keys(s.journal).length}`, type, mood: 4 }, ...w(MON) } })
    expect(Object.keys(s.journal)).toHaveLength(4)
    expect(balance(s.coinTxs)).toBe(2 + 1 + 1)
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
