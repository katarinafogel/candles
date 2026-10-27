// Grimoire steps with feedback: a toast with coins and the personal reward, and «Отменить».
import { useEffect, useState } from 'react'
import { notify } from '../components/ui'
import { store, useAppSelector } from '../store'
import { grimoireActions as A, today } from '../store/grimoireSlice'
import { balance, isFrog, taskCoins } from './coins'
import { flySpark, praise } from './fly'
import { isHard } from './mirrorStats'
import type { GrimoireState, Task } from './types'

const g = () => store.getState().grimoire

/**
 * Runs a step and offers «Отменить» in the toast. Undo puts back the state from before the step,
 * only while nothing else changed in the grimoire since.
 */
export function withUndo(title: string, change: () => void, description?: string) {
  const before = g()
  change()
  const after = g()
  if (after === before) return
  notify(title, 'success', description, {
    label: 'Отменить',
    onClick: () => {
      if (g() !== after) return notify('Уже были другие изменения, отменить не получится', 'warning')
      store.dispatch(A.restore(before as GrimoireState))
      notify('Отменено', 'info')
    },
  })
}

const coinsWord = (n: number) => `${n > 0 ? '+' : ''}${n} 🪙`

/** Closes a deed with its toast; `from` — the card or button the spark flies from into the coins. */
export function complete(t: Task, partial = false, from?: Element | null) {
  const { tone, coins: rules } = g().meta
  const coins = taskCoins(t, today(), rules, partial).total
  const { title, word } = praise(partial ? 'partial' : isFrog(t) ? 'frog' : t.type === 'joy' ? 'joy' : 'done', coinsWord(coins), tone.praise)
  const parts = [word, t.rewardText && !partial ? `награда: ${t.rewardText}` : '', t.enough && !partial ? `достаточно: ${t.enough}` : ''].filter(Boolean)
  withUndo(title, () => store.dispatch(A.completeTask({ id: t.id, partial })), parts.join(' · ') || undefined)
  if (!partial) flySpark(from, tone.motion)
  // Habits are ticked daily; asking each time would be noise.
  if (!partial && !t.habitId) feedback.ask(t.id, 'done')
  // A frog gets a slightly brighter answer: a double buzz instead of one.
  if (tone.motion !== 'off' && 'vibrate' in navigator && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    navigator.vibrate?.(isFrog(t) && !partial ? [18, 60, 30] : 18)
}

/** «Начать понемногу», and «С каким чувством берёшься?» when the settings ask it for this deed. */
export function start(t: Task) {
  withUndo(`Начато · +${g().meta.coins.startedCoins} 🪙`, () => store.dispatch(A.startTask({ id: t.id })))
  if (asksEmotion(t, g().meta.emotionAsk)) feedback.ask(t.id, 'start')
}

/** Whether the emotion question comes at this deed: by default only at frogs and «чудовища». */
export const asksEmotion = (t: Task, ask: GrimoireState['meta']['emotionAsk'] = 'hard') =>
  !t.habitId && (ask === 'all' || (ask === 'hard' && isHard(t)))

export const reopen = (t: Task) => withUndo('Вернула в работу', () => store.dispatch(A.reopenTask({ id: t.id })))
export const toBacklog = (ids: string[], title = 'В бэклоге') => withUndo(title, () => store.dispatch(A.toBacklog(ids)))
export const cancel = (t: Task) => withUndo('Отпущено без монет и без штрафа', () => store.dispatch(A.cancelTask(t.id)))

export const useBalance = () => useAppSelector((s) => balance(s.grimoire.coinTxs))

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
