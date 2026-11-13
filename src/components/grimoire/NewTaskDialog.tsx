// «Новое дело»: the card's fields with only the title required, the buttons pinned to the bottom.
// «Ещё одно» adds and starts over in the same place, «Добавить» adds and closes.
// Enter in the title or Cmd/Ctrl+Enter anywhere — «Добавить», Cmd/Ctrl+Shift+Enter — «Ещё одно».
import { Button, HStack, Stack } from '@chakra-ui/react'
import { useRef, useState } from 'react'
import { useToday } from '../../grimoire/act'
import { defaultDraft, draftToFields, type NewTaskCtx, type TaskDraft } from '@grimoire-core/grimoire/newTask'
import type { Spell, Task } from '@grimoire-core/grimoire/types'
import { useAppDispatch } from '../../store'
import { grimoireActions as A } from '@grimoire-core/store/grimoireSlice'
import { confirmAction, Modal, notify } from '@shared/components/ui'
import { usePlanGuard } from './PlanGuard'
import { SpellHints } from './SpellHints'
import { TaskFields, useFieldBlocks } from './TaskFields'

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
  const title = useRef<HTMLInputElement>(null)
  const change = (p: Partial<Task>) => setDraft((x) => ({ ...x, ...p }))
  const blocks = useFieldBlocks(draft, change)
  const [guard, guardDialog] = usePlanGuard()
  const [tried, setTried] = useState(false)

  function add(again: boolean) {
    const d = latest.current
    if (!d.title.trim()) {
      setTried(true)
      title.current?.focus()
      return
    }
    setTried(false)
    const f = draftToFields(d)
    // A full plan asks what to move first; the form stays as it is until the deed is really added.
    guard(
      f.doOn === today,
      () => {
        dispatch(A.addTask({ fields: f }))
        onAdded?.()
        if (!again) return onClose()
        notify(`Добавлено: ${f.title}`)
        setDraft(defaultDraft(ctx, today))
        blocks.reset(defaultDraft(ctx, today))
        title.current?.focus()
      },
      { stars: f.stars },
    )
  }

  /** A template picked under the title: a single deed fills the form, a quest or a chain is cast at once. */
  function fromSpell(sp: Spell) {
    if (!sp.steps.length) {
      dispatch(A.upsertSpell({ spell: { ...sp, uses: (sp.uses ?? 0) + 1 } }))
      change({ title: sp.title, stars: sp.stars, dread: sp.dread, tags: [...new Set([...draft.tags, ...sp.tags])], ...(sp.zone ? { zone: sp.zone } : {}) } as Partial<Task>)
      title.current?.focus()
      return
    }
    const f = draftToFields(latest.current)
    dispatch(A.castSpell({ spellId: sp.id, projectId: fields?.projectId, fields: { doOn: f.doOn, personIds: f.personIds } }))
    notify(`Сотворено: ${sp.title}`, 'success', sp.chain ? 'Цепочка: следующий шаг появится, когда сделаешь этот' : undefined)
    onAdded?.()
    onClose()
  }

  async function close() {
    const start = defaultDraft({ ...ctx, title: initialTitle }, today)
    if (JSON.stringify(latest.current) !== JSON.stringify(start) && !(await confirmAction('Выбросить дело?'))) return
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
        <Stack gap="3" w="full">
          {blocks.toolbar}
          <HStack gap="2">
            <Button variant="outline" flex={{ base: '1', md: 'initial' }} mr={{ md: 'auto' }} onClick={() => add(true)}>
              Ещё одно
            </Button>
            <Button flex={{ base: '1', md: 'initial' }} onClick={() => add(false)}>
              Добавить
            </Button>
          </HStack>
        </Stack>
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
        <SpellHints typed={draft.title} onPick={fromSpell} />
        <TaskFields value={draft} onChange={change} shown={blocks.shown} opened={blocks.opened} titleRef={title} titleMissing={tried} onTitleEnter={() => add(false)} />
      </Stack>
    </Modal>
  )
}
