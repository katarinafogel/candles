import { describe, expect, it } from 'vitest'
import { AgentError, agentTools, runTool } from '../agent'
import { balance } from '../coins'
import { dayKeyIn } from '../days'
import { habitTaskId } from '../habits'
import { diffGrimoire, rowsToGrimoire } from '../rows'
import { initialGrimoire, migrateGrimoire } from '../../store/grimoireSlice'
import type { GrimoireState } from '../types'

// 09:00 in Moscow on Monday 26 October 2026.
const NOW = new Date('2026-10-26T06:00:00Z')
const base: GrimoireState = { ...initialGrimoire, meta: { ...initialGrimoire.meta, timeZone: 'Europe/Moscow' } }

function run(state: GrimoireState, name: string, args: Record<string, unknown> = {}, now = NOW) {
  return runTool(name, args, { state, now })
}

describe('agent days', () => {
  it('counts the day in the owner’s zone with the boundary', () => {
    // 01:30 in Moscow on Tuesday is still Monday with a 4:00 boundary.
    expect(dayKeyIn(new Date('2026-10-26T22:30:00Z'), 4, 'Europe/Moscow')).toBe('2026-10-26')
    expect(dayKeyIn(new Date('2026-10-27T01:30:00Z'), 4, 'Europe/Moscow')).toBe('2026-10-27')
    expect(dayKeyIn(new Date('2026-10-26T22:30:00Z'), 0, 'Europe/Moscow')).toBe('2026-10-27')
  })
})

describe('agent tools', () => {
  it('describes every tool with an object schema and Russian text', () => {
    expect(agentTools.length).toBeGreaterThan(15)
    for (const t of agentTools) {
      expect(t.name).toMatch(/^grimoire_[a-z_]+$/)
      expect(t.inputSchema.type).toBe('object')
      expect(t.description.length).toBeGreaterThan(20)
    }
    expect(new Set(agentTools.map((t) => t.name)).size).toBe(agentTools.length)
  })

  it('adds a deed from a quick line and plans it', () => {
    let { state, result } = run(base, 'grimoire_add_task', { line: 'помыть окна **☠☠ #дом !пт' })
    const t = (result as { task: { id: string; dueAt: string; stars: number; dread: number; coins: number } }).task
    expect(t).toMatchObject({ dueAt: '2026-10-30', stars: 2, dread: 2, coins: 40 + 5 })
    ;({ state } = run(state, 'grimoire_plan_task', { id: t.id, day: '2026-10-26', slot: 'main' }))
    const today = run(state, 'grimoire_today').result as { day: string; plan: { main: { id: string }[] } }
    expect(today.day).toBe('2026-10-26')
    expect(today.plan.main.map((x) => x.id)).toEqual([t.id])
  })

  it('warns, but still adds, when the day’s plan is full', () => {
    let { state } = run(base, 'grimoire_add_task', { title: 'первое', doOn: '2026-10-26', slot: 'main' })
    const r = run(state, 'grimoire_add_task', { title: 'второе', doOn: '2026-10-26', slot: 'main' })
    state = r.state
    expect((r.result as { warning?: string }).warning).toMatch(/лимит/)
    expect(Object.keys(state.tasks)).toHaveLength(2)
  })

  it('completes with coins by the same rules as the app and takes them back on reopen', () => {
    let { state, result } = run(base, 'grimoire_add_task', { title: 'зуб', stars: 3, dread: 3, dueAt: '2026-10-27' })
    const id = (result as { task: { id: string } }).task.id
    const done = run(state, 'grimoire_complete_task', { id })
    // A monster is a frog: 75 · 1,5 rounded up, plus 5 on time.
    expect((done.result as { coins: number }).coins).toBe(113 + 5)
    state = done.state
    expect(state.tasks[id]).toMatchObject({ status: 'done', doneDay: '2026-10-26' })
    ;({ state } = run(state, 'grimoire_reopen_task', { id }))
    expect(balance(state.coinTxs)).toBe(0)
  })

  it('warns when a deed would take the day past its stars, and links «ждёт другое дело»', () => {
    let { state } = run(base, 'grimoire_add_task', { title: 'раз', stars: 3, doOn: '2026-10-26', slot: 'extra' })
    ;({ state } = run(state, 'grimoire_add_task', { title: 'два', stars: 3, doOn: '2026-10-26', slot: 'extra' }))
    const third = run(state, 'grimoire_add_task', { title: 'три', stars: 2, doOn: '2026-10-26', slot: 'extra' })
    expect((third.result as { warning?: string }).warning).toContain('звёзд в плане станет 8 при лимите 6')
    const today = run(third.state, 'grimoire_today').result as { dayStars: { inPlan: number; limit: number; over: number } }
    expect(today.dayStars).toMatchObject({ inPlan: 8, limit: 6, over: 2 })
    const ids = Object.values(third.state.tasks).map((t) => t.id)
    const linked = run(third.state, 'grimoire_wait_for', { id: ids[0], blockerId: ids[1] })
    expect((linked.result as { waitsFor?: unknown[] }).waitsFor).toHaveLength(1)
    expect(() => run(linked.state, 'grimoire_wait_for', { id: ids[1], blockerId: ids[0] })).toThrow(/круг/)
  })

  it('in the навь says what the assistant may send and lists the «даже в нави» deeds', () => {
    let { state } = run(base, 'grimoire_add_task', { title: 'оплатить квартиру', dueAt: '2026-10-27', evenInNav: true })
    ;({ state } = run(state, 'grimoire_add_task', { title: 'помыть окна', doOn: '2026-10-26' }))
    ;({ state } = run(state, 'grimoire_set_nav', { active: true }))
    state = { ...state, meta: { ...state.meta, nav: { ...state.meta.nav, agent: 'silent' } } }
    const today = run(state, 'grimoire_today').result as { nav: { agent: string; note: string }; evenInNav: { title: string }[] }
    expect(today.nav.agent).toBe('silent')
    expect(today.nav.note).toContain('тишины')
    expect(today.evenInNav.map((t) => t.title)).toEqual(['оплатить квартиру'])
  })

  it('postpones with a reason and reports it in the day summary', () => {
    let { state, result } = run(base, 'grimoire_add_task', { title: 'позвонить', doOn: '2026-10-26' })
    const id = (result as { task: { id: string } }).task.id
    ;({ state } = run(state, 'grimoire_postpone_task', { id, to: '2026-10-28', reason: 'needTalk' }))
    const sum = run(state, 'grimoire_day_summary').result as { postponed: { id: string; to: string; reason: string }[] }
    expect(sum.postponed).toEqual([{ id, title: 'позвонить', to: '2026-10-28', reason: 'needTalk' }])
  })

  it('makes today’s ritual tasks on the first look of the day, like the app', () => {
    const habit = {
      id: 'h',
      title: 'Вода',
      schedule: { kind: 'daily' as const },
      mark: { kind: 'count' as const, goal: 8 },
      stars: 1 as const,
      dread: 0 as const,
      status: 'active' as const,
      shields: 0,
      createdAt: '2026-10-20T00:00:00Z',
    }
    let state: GrimoireState = { ...base, habits: { h: habit } }
    ;({ state } = run(state, 'grimoire_today'))
    expect(state.tasks[habitTaskId('h', '2026-10-26')]).toBeTruthy()
    const r = run(state, 'grimoire_mark_habit', { habitId: 'h' })
    expect(r.result).toMatchObject({ value: 8, done: true, task: 'done' })
  })

  it('keeps the plan out of sight in навь', () => {
    let { state } = run(base, 'grimoire_set_nav', { active: true })
    const t = run(state, 'grimoire_today').result as { nav: { active: boolean; note: string } }
    expect(t.nav.active).toBe(true)
    expect(t.nav.note).toMatch(/нави/)
    ;({ state } = run(state, 'grimoire_set_nav', { active: false }))
    expect(state.meta.nav.history).toHaveLength(1)
  })

  it('refuses bad arguments without touching the state', () => {
    expect(() => run(base, 'grimoire_complete_task', { id: 'nope' })).toThrow(AgentError)
    expect(() => run(base, 'grimoire_add_task', {})).toThrow(/название/)
    expect(() => run(base, 'grimoire_plan_task', { id: 'x', day: '26.10' })).toThrow(AgentError)
    expect(() => run(base, 'grimoire_nothing')).toThrow(/нет инструмента/)
  })

  it('splits, spawns and writes a journal entry', () => {
    let { state, result } = run(base, 'grimoire_add_task', { title: 'ремонт', doOn: '2026-10-26', steps: ['купить краску', 'покрасить'] })
    const id = (result as { task: { id: string } }).task.id
    const full = run(state, 'grimoire_get_task', { id }).result as { steps: { title: string; doOn?: string }[] }
    expect(full.steps.map((s) => s.title)).toEqual(['купить краску', 'покрасить'])
    expect(full.steps[0].doOn).toBe('2026-10-26')
    const sp = run(state, 'grimoire_spawn_task', { fromId: id, title: 'узнать цвет' })
    state = sp.state
    expect((sp.result as { origin: { waitsFor: unknown[] } }).origin.waitsFor).toHaveLength(1)
    ;({ state } = run(state, 'grimoire_add_journal', { words: ['anger.1', 'joy.9', 'dyad.awe'], energy: 2, text: 'устала' }))
    // An unknown word is dropped; the entry says it came from the assistant.
    expect(Object.values(state.journal)[0]).toMatchObject({ words: ['anger.1', 'dyad.awe'], energy: 2, day: '2026-10-26', source: 'assistant' })
    expect(() => run(state, 'grimoire_add_journal', {})).toThrow(/пустая/)
    expect(() => run(state, 'grimoire_add_journal', { words: ['joy.9'] })).toThrow(/пустая/)
  })

  it('round-trips through table rows: what it writes is what the app reads', () => {
    const { state } = run(base, 'grimoire_add_task', { title: 'дело' })
    const rows = diffGrimoire(initialGrimoire, state).map((c) => ({ kind: c.kind, id: c.id, data: c.data }))
    const back = migrateGrimoire(rowsToGrimoire(rows))
    expect(Object.values(back.tasks).map((t) => t.title)).toEqual(['дело'])
    expect(back.meta.timeZone).toBe('Europe/Moscow')
  })
})

describe('wheel tool', () => {
  it('gives the sabbat card and the esbat', () => {
    const g = migrateGrimoire({ ...initialGrimoire, meta: { ...initialGrimoire.meta, sabbatCards: { samhain: { herbs: 'моя полынь' } } } })
    const samhain = run(g, 'grimoire_wheel', { sabbat: 'samhain' }).result as { card: Record<string, string> }
    expect(samhain.card.herbs).toBe('моя полынь')
    expect(samhain.card.colors).toBeTruthy()
    const esbat = run(g, 'grimoire_wheel', { sabbat: 'esbat' }).result as { day: string }
    expect(esbat.day >= dayKeyIn(NOW, 4)).toBe(true)
  })
})
