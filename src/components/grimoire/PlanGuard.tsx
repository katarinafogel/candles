// A full plan is not overfilled silently: before an urgent deed lands on today, the grimoire asks what
// to move — to tomorrow, to the backlog or a step lower. «Full» is either the slot's limit or the day's
// stars going past their limit. Once there is room, the deed is added by itself.
import { Button, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useToday } from '../../grimoire/act'
import { addDays } from '../../grimoire/days'
import { slotLabel } from '../../grimoire/labels'
import { byPlanOrder, dayStars, isOpenTask, overLimit, slotCounts } from '../../grimoire/selectors'
import type { DayKey, GrimoireState, TaskSlot } from '../../grimoire/types'
import { store, useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { Modal } from '../ui'
import { Dread, Stars } from './Marks'

const lower: Partial<Record<TaskSlot, TaskSlot>> = { main: 'extra', extra: 'optional' }

/**
 * What lands: its slot, the stars it adds to the day (0 when it is in today's plan already), its own id;
 * `starsOnly` — it already stands in that slot today, so only the stars can overflow.
 */
interface Landing {
  slot: TaskSlot
  stars: number
  self?: string
  starsOnly?: boolean
}

/** Why the plan has no room: the slot is taken, the stars would go past the limit, or both. */
function fullness(g: GrimoireState, today: DayKey, l: Landing) {
  const st = dayStars(g, today)
  return { slot: !l.starsOnly && overLimit(g.meta, slotCounts(g, today), l.slot), stars: st.limit > 0 && l.stars > 0 && st.total + l.stars > st.limit, st }
}

/**
 * `guard(slot, add, opts)` runs `add` at once while today has room, otherwise first asks what to move.
 * Pass no slot for deeds that do not land on today; `stars` — what the deed adds to the day's stars.
 * Render the returned dialog next to the caller.
 */
type GuardOpts = { stars?: number; self?: string; starsOnly?: boolean }

export function usePlanGuard(): [(slot: TaskSlot | undefined, add: () => void, opts?: GuardOpts) => void, ReactNode] {
  const today = useToday()
  const [pending, setPending] = useState<Landing & { add: () => void }>()
  function guard(slot: TaskSlot | undefined, add: () => void, opts: GuardOpts = {}) {
    if (!slot) return add()
    // Read the store, not a render-time snapshot: the guard may run right after another dispatch.
    const landing = { slot, stars: opts.stars ?? 0, self: opts.self, starsOnly: opts.starsOnly }
    const f = fullness(store.getState().grimoire, today, landing)
    if (f.slot || f.stars) setPending({ ...landing, add })
    else add()
  }
  const dialog = pending ? (
    <PlanFull
      landing={pending}
      onClose={() => setPending(undefined)}
      onAdd={() => {
        setPending(undefined)
        pending.add()
      }}
    />
  ) : null
  return [guard, dialog]
}

function PlanFull({ landing, onClose, onAdd }: { landing: Landing; onClose: () => void; onAdd: () => void }) {
  const dispatch = useAppDispatch()
  const today = useToday()
  const g = useAppSelector((s) => s.grimoire)
  const { slot } = landing
  const f = fullness(g, today, landing)
  const full = f.slot || f.stars
  // The slot is taken → its deeds; only the stars are over → every open deed of the day can make room.
  const tasks = Object.values(g.tasks)
    .filter((t) => t.doOn === today && !t.habitId && isOpenTask(t) && t.id !== landing.self && (!f.slot || (t.slot ?? 'extra') === slot))
    .sort(byPlanOrder)
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
          {f.slot && `В «${slotLabel[slot]}» на сегодня уже ${slotCounts(g, today)[slot]} из ${g.meta.planLimit[slot]}. `}
          {f.stars && `Звёзд в плане ${f.st.total} из ${f.st.limit}, с новым делом станет ${f.st.total + landing.stars}. `}
          Что убрать или сдвинуть, чтобы новое встало на его место?
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
              {/* A step lower frees the slot, not the stars. */}
              {f.slot && down && (
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
