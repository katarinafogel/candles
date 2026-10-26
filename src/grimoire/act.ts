// Grimoire steps with feedback: a toast with coins and the personal reward, and «Отменить».
import { useEffect, useState } from 'react'
import { notify } from '../components/ui'
import { store, useAppSelector } from '../store'
import { grimoireActions as A, today } from '../store/grimoireSlice'
import { balance, isFrog, taskCoins } from './coins'
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

export function complete(t: Task, partial = false) {
  const coins = taskCoins(t, today(), g().meta.coins, partial).total
  const parts = [t.rewardText && !partial ? `награда: ${t.rewardText}` : '', t.enough && !partial ? `достаточно: ${t.enough}` : ''].filter(Boolean)
  withUndo(
    partial
      ? `Часть сделана · ${coinsWord(coins)}`
      : `${isFrog(t) ? '🐸 Жаба съедена!' : t.type === 'joy' ? 'Радость прожита' : 'Сделано'} · ${coinsWord(coins)}`,
    () => store.dispatch(A.completeTask({ id: t.id, partial })),
    parts.join(' · ') || undefined,
  )
  // Habits are ticked daily; asking each time would be noise.
  if (!partial && !t.habitId) feedback.ask(t.id)
  // A frog gets a slightly brighter answer: a double buzz instead of one.
  if ('vibrate' in navigator && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(isFrog(t) && !partial ? [18, 60, 30] : 18)
}

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

// ---------- «Как далось?» ----------
// After a deed is done the layout shows a small optional question; this is its tiny shared state.

let feedbackTask: string | undefined
const listeners = new Set<() => void>()
export const feedback = {
  ask(id: string) {
    feedbackTask = id
    listeners.forEach((l) => l())
  },
  clear() {
    feedbackTask = undefined
    listeners.forEach((l) => l())
  },
  get: () => feedbackTask,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => void listeners.delete(l)
  },
}
