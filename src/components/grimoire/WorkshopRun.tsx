// The bridge from the grimoire to the workshop. `workshopRun.ask` opens the workshop's own step
// dialog for some items (a deed's «Сделать шаг», or ticking a workshop deed anywhere); the pour
// opens the pour form with the candles chosen. `useWorkshopSync` then ticks, reopens or lets go
// the grimoire's steps so they always match the items' stages.
import { useEffect, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { syncActions } from '../../grimoire/workshop'
import { workshopRun } from '../../grimoire/workshopRun'
import { GiveDialog } from '../../pages/CandlePage'
import { ReadyDialog } from '../../pages/Candles'
import { store, useAppSelector, useIsWitch } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { DecorateDialog, DefectDialog, HolderStepDialog } from '../StepDialogs'

export function WorkshopRunner() {
  const ask = useSyncExternalStore(workshopRun.subscribe, workshopRun.get)
  const navigate = useNavigate()
  const pour = ask && !ask.defect && ask.kind === 'candle' && ask.step === 'pour'
  useEffect(() => {
    if (!pour) return
    workshopRun.clear()
    navigate(`/pour/new?ids=${ask!.ids.join(',')}`)
  }, [pour]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!ask || pour) return null
  const close = () => workshopRun.clear()
  if (ask.defect) return <DefectDialog kind={ask.kind} ids={ask.ids} onClose={close} />
  if (ask.kind === 'holder') return <HolderStepDialog ids={ask.ids} onClose={close} />
  if (ask.step === 'decorated') return <DecorateDialog ids={ask.ids} onClose={close} />
  if (ask.step === 'ready') return <ReadyDialog ids={ask.ids} onClose={close} />
  if (ask.step === 'given') return <GiveDialog id={ask.ids[0]} onClose={close} onDone={close} />
  return null
}

/** Keeps the grimoire's workshop steps in step with the items: ticks, reopens, lets go. */
export function useWorkshopSync() {
  const witch = useIsWitch()
  const data = useAppSelector((s) => s.data)
  const tasks = useAppSelector((s) => s.grimoire.tasks)
  useEffect(() => {
    if (!witch) return
    for (const a of syncActions(data, tasks)) {
      const t = store.getState().grimoire.tasks[a.id]
      if (!t?.workshop) continue
      if (a.to === 'done') store.dispatch(A.completeTask({ id: a.id }))
      else if (a.to === 'open') {
        store.dispatch(A.reopenTask({ id: a.id }))
        if (t.workshop.lost) store.dispatch(A.updateTask({ id: a.id, workshop: { ...t.workshop, lost: undefined } }))
      } else {
        store.dispatch(A.cancelTask(a.id))
        store.dispatch(A.updateTask({ id: a.id, workshop: { ...t.workshop, lost: true } }))
      }
    }
  }, [witch, data, tasks])
}
