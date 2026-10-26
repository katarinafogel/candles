// A full plan is not overfilled silently: before an urgent deed lands on today, the grimoire asks what
// to move — to tomorrow, to the backlog or a step lower. Once there is room, the deed is added by itself.
import { Button, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useToday } from '../../grimoire/act'
import { addDays } from '../../grimoire/days'
import { slotLabel } from '../../grimoire/labels'
import { byPlanOrder, isOpenTask, overLimit, slotCounts } from '../../grimoire/selectors'
import type { TaskSlot } from '../../grimoire/types'
import { store, useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { Modal } from '../ui'
import { Dread, Stars } from './Marks'

const lower: Partial<Record<TaskSlot, TaskSlot>> = { main: 'extra', extra: 'optional' }

/**
 * `guard(slot, add)` runs `add` at once while today's `slot` has room, otherwise first asks what to move.
 * Pass no slot for deeds that do not land on today. Render the returned dialog next to the caller.
 */
export function usePlanGuard(): [(slot: TaskSlot | undefined, add: () => void) => void, ReactNode] {
  const today = useToday()
  const [pending, setPending] = useState<{ slot: TaskSlot; add: () => void }>()
  function guard(slot: TaskSlot | undefined, add: () => void) {
    // Read the store, not a render-time snapshot: the guard may run right after another dispatch.
    const g = store.getState().grimoire
    if (slot && overLimit(g.meta, slotCounts(g, today), slot)) setPending({ slot, add })
    else add()
  }
  const dialog = pending ? (
    <PlanFull
      slot={pending.slot}
      onClose={() => setPending(undefined)}
      onAdd={() => {
        setPending(undefined)
        pending.add()
      }}
    />
  ) : null
  return [guard, dialog]
}

function PlanFull({ slot, onClose, onAdd }: { slot: TaskSlot; onClose: () => void; onAdd: () => void }) {
  const dispatch = useAppDispatch()
  const today = useToday()
  const g = useAppSelector((s) => s.grimoire)
  const tasks = Object.values(g.tasks)
    .filter((t) => t.doOn === today && !t.habitId && isOpenTask(t) && (t.slot ?? 'extra') === slot)
    .sort(byPlanOrder)
  const full = overLimit(g.meta, slotCounts(g, today), slot)
  const added = useRef(false)

  // Room was made: the new deed takes it without one more tap.
  useEffect(() => {
    if (!full && !added.current) {
      added.current = true
      onAdd()
    }
  }, [full, onAdd])

  const down = lower[slot]
  return (
    <Modal
      open
      onClose={onClose}
      title="План на сегодня полный"
      footer={
        <>
          <Button variant="ghost" mr="auto" onClick={onClose}>
            Не добавлять
          </Button>
          <Button variant="outline" onClick={onAdd}>
            Всё равно добавить
          </Button>
        </>
      }
    >
      <Stack gap="3">
        <Text fontSize="sm" color="fg.muted">
          В «{slotLabel[slot]}» на сегодня уже {tasks.length} из {g.meta.planLimit[slot]}. Что убрать или сдвинуть, чтобы новое встало на его место?
        </Text>
        {tasks.map((t) => (
          <Flex key={t.id} gap="2" align="center" wrap="wrap" py="2" borderBottomWidth="1px" borderColor="border.muted" _last={{ borderBottomWidth: 0 }}>
            <Stack gap="0.5" flex="1" minW="150px">
              <Text fontSize="sm">{t.title}</Text>
              <HStack gap="2">
                <Stars n={t.stars} size={10} />
                <Dread n={t.dread} size={10} />
              </HStack>
            </Stack>
            <HStack gap="1">
              <Button size="xs" variant="outline" onClick={() => dispatch(A.postponeTask({ id: t.id, to: addDays(today, 1), boundary: g.meta.dayBoundaryHour }))}>
                На завтра
              </Button>
              <Button size="xs" variant="outline" onClick={() => dispatch(A.toBacklog([t.id]))}>
                В бэклог
              </Button>
              {down && (
                <Button size="xs" variant="ghost" onClick={() => dispatch(A.planTask({ id: t.id, day: today, slot: down }))}>
                  в {slotLabel[down]}
                </Button>
              )}
            </HStack>
          </Flex>
        ))}
      </Stack>
    </Modal>
  )
}
