// «Отменить» in the toast after a stage change: rolls back exactly the step that was just made.
import { notify } from '../components/ui'
import { store } from '../store'
import { actions } from '../store/dataSlice'

type Kind = 'holder' | 'candle'

const historyLengths = (kind: Kind) => {
  const d = store.getState().data
  const items: Record<string, { history: unknown[] }> = kind === 'holder' ? d.holders : d.candles
  return (id: string) => items[id]?.history.length ?? 0
}

/**
 * Runs a stage change and shows a toast with «Отменить».
 * Only items whose history grew are rolled back, and only while nothing else was recorded on them since.
 */
export function withUndo(kind: Kind, ids: string[], change: () => void, title: string, type: 'success' | 'info' = 'success') {
  const before = historyLengths(kind)
  const was = new Map(ids.map((id) => [id, before(id)]))
  change()
  const after = historyLengths(kind)
  const changed = ids.filter((id) => after(id) > (was.get(id) ?? 0)).map((id) => [id, after(id)] as const)
  if (!changed.length) return notify(title, type)
  notify(title, type, undefined, {
    label: 'Отменить',
    onClick: () => {
      const now = historyLengths(kind)
      const date = new Date().toISOString()
      for (const [id, len] of changed) {
        if (now(id) !== len) continue
        store.dispatch(kind === 'holder' ? actions.undoHolder({ id, date }) : actions.undoCandle({ id, date }))
      }
      notify('Отменено', 'info')
    },
  })
}
