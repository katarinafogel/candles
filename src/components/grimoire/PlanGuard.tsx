// A full plan is not overfilled silently: before an urgent deed lands on today, the grimoire asks what
// to move — to tomorrow or to the backlog. «Full» is either the plan's limit of deeds or the day's
// stars going past their limit. Once there is room, the deed is added by itself.
import { Button, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useToday } from '../../grimoire/act'
import { addDays } from '@grimoire-core/grimoire/days'
import { byPlanOrder, dayStars, isOpenTask, overLimit, planCount, priorityOf } from '@grimoire-core/grimoire/selectors'
import type { DayKey, GrimoireState } from '@grimoire-core/grimoire/types'
import { store, useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '@grimoire-core/store/grimoireSlice'
import { Modal } from '@shared/components/ui'
import { Dread, PriorityIcon, Stars } from './Marks'

/**
 * What lands: the stars it adds to the day (0 when it is in today's plan already), its own id;
 * `starsOnly` — it already stands in today's plan, so only the stars can overflow.
 */
interface Landing {
  stars: number
  self?: string
  starsOnly?: boolean
}

/** Why the plan has no room: it holds its limit of deeds, the stars would go past the limit, or both. */
function fullness(g: GrimoireState, today: DayKey, l: Landing) {
  const st = dayStars(g, today)
  return { count: !l.starsOnly && overLimit(g.meta, planCount(g, today)), stars: st.limit > 0 && l.stars > 0 && st.total + l.stars > st.limit, st }
}

/**
 * `guard(onToday, add, opts)` runs `add` at once while today has room, otherwise first asks what to move.
 * `onToday` false — the deed does not land on today, nothing to check; `stars` — what it adds to the day.
 * Render the returned dialog next to the caller.
 */
type GuardOpts = { stars?: number; self?: string; starsOnly?: boolean }

export function usePlanGuard(): [(onToday: boolean, add: () => void, opts?: GuardOpts) => void, ReactNode] {
  const today = useToday()
  const [pending, setPending] = useState<Landing & { add: () => void }>()
  function guard(onToday: boolean, add: () => void, opts: GuardOpts = {}) {
    if (!onToday) return add()
    // Read the store, not a render-time snapshot: the guard may run right after another dispatch.
    const landing = { stars: opts.stars ?? 0, self: opts.self, starsOnly: opts.starsOnly }
    const f = fullness(store.getState().grimoire, today, landing)
    if (f.count || f.stars) setPending({ ...landing, add })
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
  const f = fullness(g, today, landing)
  const full = f.count || f.stars
  // The least urgent first: they are the natural ones to move.
  const tasks = Object.values(g.tasks)
    .filter((t) => t.doOn === today && !t.habitId && isOpenTask(t) && t.id !== landing.self)
    .sort(byPlanOrder)
    .reverse()
  const added = useRef(false)

  // Room was made: the new deed takes it without one more tap.
  useEffect(() => {
    if (!full && !added.current) {
      added.current = true
      onAdd()
    }
  }, [full, onAdd])

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
          {f.count && `В плане на сегодня уже ${planCount(g, today)} дел из ${g.meta.planMax}. `}
          {f.stars && `Звёзд в плане ${f.st.total} из ${f.st.limit}, с новым делом станет ${f.st.total + landing.stars}. `}
          Что убрать или сдвинуть, чтобы новое встало на его место?
        </Text>
        {tasks.map((t) => (
          <Flex key={t.id} gap="2" align="center" wrap="wrap" py="2" borderBottomWidth="1px" borderColor="border.muted" _last={{ borderBottomWidth: 0 }}>
            <Stack gap="0.5" flex="1" minW="150px">
              <Text fontSize="sm">{t.title}</Text>
              <HStack gap="2">
                <PriorityIcon p={priorityOf(t)} size={12} />
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
            </HStack>
          </Flex>
        ))}
      </Stack>
    </Modal>
  )
}
