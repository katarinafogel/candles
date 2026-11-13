// Grimoire steps with feedback: a toast with praise and the personal reward, and «Отменить».
import { useEffect, useState } from 'react'
import { notify } from '@shared/components/ui'
import { store, useAppSelector } from '../store'
import { grimoireActions as A, today } from '@grimoire-core/store/grimoireSlice'
import { isFrog } from '@grimoire-core/grimoire/frog'
import { isHard } from '@grimoire-core/grimoire/mirrorStats'
import { workshopRun } from '@grimoire-core/grimoire/workshopRun'
import type { GrimoireState, Task } from '@grimoire-core/grimoire/types'

const g = () => store.getState().grimoire

/**
 * Runs a step and offers «Отменить» in the toast. Undo puts back the state from before the step,
 * only while nothing else changed in the grimoire since.
 */
export function withUndo(title: string, change: () => void, description?: string, undoLabel = 'Отменить') {
  const before = g()
  change()
  const after = g()
  if (after === before) return
  notify(title, 'success', description, {
    label: undoLabel,
    onClick: () => {
      if (g() !== after) return notify('Уже были другие изменения, отменить не получится', 'warning')
      store.dispatch(A.restore(before as GrimoireState))
      notify(undoLabel === 'Вернуть' ? 'Вернула' : 'Отменено', 'info')
    },
  })
}

const warmWords = ['Ведьма в ударе!', 'Ещё одна страница гримуара заполнена.', 'Котёл кипит, дело сделано.', 'Луна одобряет.', 'Так держать.']

/** The toast for a done deed, by «Похвала»: quiet and normal — just the word, warm — a kind line too. */
function praise(kind: 'done' | 'joy' | 'frog' | 'partial', level: GrimoireState['meta']['tone']['praise']) {
  const title = { done: 'Сделано', joy: 'Радость прожита', frog: level === 'quiet' ? 'Жаба съедена' : '🐸 Жаба съедена!', partial: 'Часть сделана' }[kind]
  const word = level === 'warm' && kind !== 'partial' ? warmWords[Math.floor(Math.random() * warmWords.length)] : undefined
  return { title, word }
}

/** Closes a deed with its toast. */
export function complete(t: Task, partial = false) {
  // A workshop deed is done in the workshop: its step dialog opens, and the deed ticks itself after.
  if (!partial && (t.workshop || t.workshopStep)) {
    const items = t.workshop ? [t.workshop] : Object.values(g().tasks).filter((x) => x.parentId === t.id && x.workshop && x.status !== 'done' && x.status !== 'cancelled').map((x) => x.workshop!)
    if (items.length) return workshopRun.ask({ kind: items[0].kind, step: items[0].step, ids: items.map((x) => x.id) })
  }
  const { tone } = g().meta
  const { title, word } = praise(partial ? 'partial' : isFrog(t) ? 'frog' : t.type === 'joy' ? 'joy' : 'done', tone.praise)
  withUndo(title, () => store.dispatch(A.completeTask({ id: t.id, partial })), word || undefined)
  // Habits are ticked daily; asking each time would be noise.
  if (!partial && !t.habitId) feedback.ask(t.id, 'done')
  // A frog gets a slightly brighter answer: a double buzz instead of one.
  if (tone.motion !== 'off' && 'vibrate' in navigator && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    navigator.vibrate?.(isFrog(t) && !partial ? [18, 60, 30] : 18)
}

/** «Начать понемногу», and «С каким чувством берёшься?» when the settings ask it for this deed. */
export function start(t: Task) {
  withUndo('Начато', () => store.dispatch(A.startTask({ id: t.id })))
  if (asksEmotion(t, g().meta.emotionAsk)) feedback.ask(t.id, 'start')
}

/** Whether the emotion question comes at this deed: by default only at frogs and «чудовища». */
export const asksEmotion = (t: Task, ask: GrimoireState['meta']['emotionAsk'] = 'hard') =>
  !t.habitId && (ask === 'all' || (ask === 'hard' && isHard(t)))

export const reopen = (t: Task) => withUndo('Вернула в работу', () => store.dispatch(A.reopenTask({ id: t.id })))
export const toBacklog = (ids: string[], title = 'В бэклоге') => withUndo(title, () => store.dispatch(A.toBacklog(ids)))
/** Deletes a deed for good, with «Вернуть» in the toast while nothing else changed. */
export const remove = (t: Task) => withUndo('Дело удалено', () => store.dispatch(A.deleteTask(t.id)), t.title, 'Вернуть')
/** Several deeds at once (the «Выбрать» mode); one «Вернуть» brings them all back. */
export const removeMany = (ids: string[]) =>
  withUndo(`Удалено дел: ${ids.length}`, () => ids.forEach((id) => store.dispatch(A.deleteTask(id))), undefined, 'Вернуть')
export const cancel = (t: Task) => withUndo('Отпущено без штрафа', () => store.dispatch(A.cancelTask(t.id)))

/** Today in the grimoire's terms; re-checks every minute and when the app comes back to the screen. */
export function useToday() {
  const boundary = useAppSelector((s) => s.grimoire.meta.dayBoundaryHour)
  const [day, setDay] = useState(() => today())
  useEffect(() => {
    const tick = () => setDay(today())
    tick()
    const t = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [boundary])
  return day
}

// ---------- «Как теперь?» ----------
// After a deed is started or done the layout shows a small optional question; this is its tiny shared state.

let feedbackAsk: { id: string; kind: 'start' | 'done' } | undefined
const listeners = new Set<() => void>()
export const feedback = {
  ask(id: string, kind: 'start' | 'done') {
    feedbackAsk = { id, kind }
    listeners.forEach((l) => l())
  },
  clear() {
    feedbackAsk = undefined
    listeners.forEach((l) => l())
  },
  get: () => feedbackAsk,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => void listeners.delete(l)
  },
}
