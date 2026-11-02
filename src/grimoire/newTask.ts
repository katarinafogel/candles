// The «Новое дело» form: what it starts from in each place and what it hands to addTask.
// Only the title is required; empty fields are dropped rather than saved as empty strings.
import type { DayKey, Task } from './types.ts'

/** A deed being written: the card's fields without id, status or dates. */
export type TaskDraft = Partial<Task> & Pick<Task, 'title' | 'stars' | 'dread' | 'tags' | 'type'>

/** Where the form was opened: the day scroll plans for today, a book puts the deed in itself. */
export interface NewTaskCtx {
  planToday?: boolean
  fields?: Partial<Task>
  title?: string
}

/** The start of the form, and what «Ещё одно» resets it to. */
export function defaultDraft(ctx: NewTaskCtx, today: DayKey): TaskDraft {
  return {
    title: ctx.title ?? '',
    stars: 1,
    dread: 0,
    tags: [],
    type: 'deed',
    ...(ctx.planToday ? { doOn: today, slot: 'extra' as const } : {}),
    ...ctx.fields,
  }
}

const textKeys = ['note', 'whyText', 'enough', 'stopAt', 'ifStuck', 'rewardText', 'zone'] as const
const listKeys = ['why', 'costs', 'personIds'] as const

/** The draft as addTask fields: trimmed, without empty strings and lists; a planned deed gets «доп» by default. */
export function draftToFields(draft: TaskDraft): Partial<Task> & { title: string } {
  const f: Partial<Task> & { title: string } = { ...draft, title: draft.title.trim().slice(0, 200) }
  for (const k of textKeys) if (!f[k]?.trim()) delete f[k]
  for (const k of listKeys) if (!f[k]?.length) delete f[k]
  for (const k of ['prep', 'wrapUp'] as const) {
    const items = (f[k] ?? []).map((x) => x.trim()).filter(Boolean)
    if (items.length) f[k] = items
    else delete f[k]
  }
  if (!f.doOn) {
    delete f.doOn
    delete f.slot
  } else if (!f.slot) f.slot = 'extra'
  if (!f.dueAt) delete f.dueAt
  if (f.estimateMin == null) delete f.estimateMin
  if (!f.evenInNav) delete f.evenInNav
  if (!f.repeat) delete f.repeat
  return f
}
