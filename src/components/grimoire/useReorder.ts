// Reordering by a grip: the order changes live under the finger and is saved on release. Items carry
// `data-reorder={id}`; the grip calls `onPointerDown(id, e)`.
import { useRef, useState } from 'react'

/** Dragging a card by its grip: the order changes live under the finger and is saved on release. */
export function useReorder(ids: string[], save: (ids: string[]) => void) {
  const [order, setOrder] = useState<string[] | null>(null)
  const dragging = useRef<string | null>(null)
  const shown = order ?? ids

  function onPointerDown(id: string, e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragging.current = id
    let current = ids
    setOrder(ids)
    const move = (ev: PointerEvent) => {
      const over = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-reorder]')?.dataset.reorder
      if (!over || over === dragging.current) return
      const next = current.filter((x) => x !== dragging.current)
      const at = next.indexOf(over) + (current.indexOf(over) > current.indexOf(dragging.current!) ? 1 : 0)
      next.splice(at, 0, dragging.current!)
      current = next
      setOrder(next)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (current.join() !== ids.join()) save(current)
      dragging.current = null
      setOrder(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  return { shown, onPointerDown, dragging: order ? dragging.current : null }
}
