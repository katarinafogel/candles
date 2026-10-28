// Which workshop step dialog is open right now: asked from anywhere (a deed's «Сделано», the
// workshop deed's card), shown by WorkshopRunner. No imports, so anyone can ask without cycles.
import type { WorkshopKind } from './types'

type Ask = { kind: WorkshopKind; step: string; ids: string[]; defect?: boolean }
let current: Ask | undefined
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const workshopRun = {
  ask(a: Ask) {
    current = a
    emit()
  },
  clear() {
    current = undefined
    emit()
  },
  get: () => current,
  subscribe(l: () => void) {
    listeners.add(l)
    return () => void listeners.delete(l)
  },
}
