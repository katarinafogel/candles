// A stage tab that has just been emptied by moving its items on opens the tab they went to.
import { useEffect, useRef } from 'react'

interface Staged {
  id: string
  stage: string
}

/** Where the items that left a tab went. A defect is not a next step, and a deleted item went nowhere. */
export function stageToFollow(left: string[], items: Staged[]) {
  const stages = new Map(items.map((i) => [i.id, i.stage]))
  return left.map((id) => stages.get(id)).find((s) => s && s !== 'defect')
}

/** `scope` names what the tab is showing: changing a filter empties a tab without anything having moved. */
export function useFollowStage(scope: string, stage: string, items: Staged[], go: (stage: string) => void) {
  const here = items.filter((i) => i.stage === stage).map((i) => i.id)
  const prev = useRef({ scope, ids: here })
  useEffect(() => {
    const p = prev.current
    prev.current = { scope, ids: here }
    if (!stage || p.scope !== scope || !p.ids.length || here.length) return
    const to = stageToFollow(p.ids, items)
    if (to) go(to)
  })
}
