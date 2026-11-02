// «Новое дело»: the card's fields with only the title required, the buttons pinned to the bottom.
// «Ещё одно» adds and starts over in the same place, «Добавить» adds and closes.
// Enter in the title or Cmd/Ctrl+Enter anywhere — «Добавить», Cmd/Ctrl+Shift+Enter — «Ещё одно».
import { Button, Stack } from '@chakra-ui/react'
import { useRef, useState } from 'react'
import { useToday } from '../../grimoire/act'
import { defaultDraft, draftToFields, type NewTaskCtx, type TaskDraft } from '../../grimoire/newTask'
import type { Task } from '../../grimoire/types'
import { useAppDispatch } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { confirmAction, Modal, notify } from '../ui'
import { usePlanGuard } from './PlanGuard'
import { TaskFields } from './TaskFields'

/** `fields` go into every deed added here (a book's deeds carry its projectId); `onAdded` — after each one. */
export function NewTaskDialog({
  onClose,
  initialTitle,
  planToday,
  fields,
  onAdded,
}: {
  onClose: () => void
  initialTitle?: string
  planToday?: boolean
  fields?: Partial<Task>
  onAdded?: () => void
}) {
  const dispatch = useAppDispatch()
  const today = useToday()
  const ctx: NewTaskCtx = { planToday, fields }
  const [draft, setDraft] = useState<TaskDraft>(() => defaultDraft({ ...ctx, title: initialTitle }, today))
  // The latest draft for the keyboard shortcuts: a tag typed into TagInput lands in the same keypress.
  const latest = useRef(draft)
  latest.current = draft
  const [more, setMore] = useState(false)
  const title = useRef<HTMLInputElement>(null)
  const [guard, guardDialog] = usePlanGuard()
  const empty = !draft.title.trim()

  function add(again: boolean) {
    const d = latest.current
    if (!d.title.trim()) return
    const f = draftToFields(d)
    // A full plan asks what to move first; the form stays as it is until the deed is really added.
    guard(
      f.doOn === today ? f.slot : undefined,
      () => {
        dispatch(A.addTask({ fields: f }))
        onAdded?.()
        if (!again) return onClose()
        notify(`Добавлено: ${f.title}`)
        setDraft(defaultDraft(ctx, today))
        setMore(false)
        title.current?.focus()
      },
      { stars: f.stars },
    )
  }

  function close() {
    const start = defaultDraft({ ...ctx, title: initialTitle }, today)
    if (JSON.stringify(latest.current) !== JSON.stringify(start) && !confirmAction('Выбросить дело?')) return
    onClose()
  }

  return (
    <Modal
      open
      onClose={close}
      title="Новое дело"
      size="lg"
      initialFocusEl={() => title.current}
      footer={
        <>
          <Button variant="outline" flex={{ base: '1', md: 'initial' }} mr={{ md: 'auto' }} disabled={empty} onClick={() => add(true)}>
            Ещё одно
          </Button>
          <Button flex={{ base: '1', md: 'initial' }} disabled={empty} onClick={() => add(false)}>
            Добавить
          </Button>
        </>
      }
    >
      {guardDialog}
      <Stack
        gap="4"
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return
          e.preventDefault()
          const again = e.shiftKey
          // After TagInput has taken its Enter and the state has settled.
          setTimeout(() => add(again))
        }}
      >
        <TaskFields value={draft} onChange={(p) => setDraft((x) => ({ ...x, ...p }))} more={more} onMore={setMore} titleRef={title} onTitleEnter={() => add(false)} />
      </Stack>
    </Modal>
  )
}
