// The day scroll: joys ahead, the morning review, today's plan (main → extra → optional → rituals),
// one-line adding and «на сегодня всё».
import { Box, Button, Flex, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Crescent, Divider } from '../../components/Magic'
import { QuickAdd } from '../../components/grimoire/QuickAdd'
import { useTaskDialog } from '../../components/grimoire/TaskDialog'
import { TaskRow } from '../../components/grimoire/TaskRow'
import { Empty, Modal, PageHeader, Section } from '../../components/ui'
import { cancel, toBacklog, useToday, withUndo } from '../../grimoire/act'
import { dayCoins } from '../../grimoire/coins'
import { addDays, days, humanDay } from '../../grimoire/days'
import { slotLabel } from '../../grimoire/labels'
import { backlog, dayPlan, deadlinesSoon, isBlocked, joysAhead, overLimit, slotCounts, toReview, words } from '../../grimoire/selectors'
import type { Task, TaskSlot } from '../../grimoire/types'
import { moonPhase, moonPhaseNames, sabbats, wheelNow } from '../../grimoire/wheel'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { Dread, Stars } from '../../components/grimoire/Marks'

const weekdayLong = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']

function dateTitle(day: string) {
  const d = new Date(`${day}T12:00:00Z`)
  return `${weekdayLong[d.getUTCDay()]}, ${humanDay(day, '0000-01-01')}`
}

/** One leftover at a time: keep, shrink, put off, let go — or everything to the backlog. */
function MorningReview({ items, today, open }: { items: Task[]; today: string; open: (t: Task) => void }) {
  const dispatch = useAppDispatch()
  const t = items[0]
  return (
    <Section title="Разбор вчерашнего">
      <Text fontSize="sm" color="fg.muted" mb="3">
        Ничего не переносится само. {items.length > 1 ? `Осталось ${items.length}, по одному:` : 'Одно дело:'}
      </Text>
      <Box mb="3" p="3" borderRadius="l2" borderWidth="1px" borderColor="border" onClick={() => open(t)} cursor="pointer">
        <Text>{t.title}</Text>
        <HStack gap="2" mt="1">
          <Stars n={t.stars} size={10} />
          <Dread n={t.dread} size={10} />
          {t.slot && <Text fontSize="xs" color="fg.subtle">{slotLabel[t.slot]}</Text>}
        </HStack>
      </Box>
      <Flex gap="2" wrap="wrap">
        <Button size="sm" onClick={() => dispatch(A.planTask({ id: t.id, day: today }))}>
          Оставить на сегодня
        </Button>
        <Button size="sm" variant="outline" onClick={() => open(t)}>
          Уменьшить
        </Button>
        <Button size="sm" variant="outline" onClick={() => dispatch(A.postponeTask({ id: t.id }))}>
          Отложить
        </Button>
        <Button size="sm" variant="ghost" onClick={() => cancel(t)}>
          Отменить
        </Button>
        <Button
          size="sm"
          variant="ghost"
          ml="auto"
          onClick={() =>
            withUndo('Всё в бэклоге', () => {
              dispatch(A.toBacklog(items.map((x) => x.id)))
              dispatch(A.markReviewed(today))
            })
          }
        >
          Всё в бэклог
        </Button>
      </Flex>
    </Section>
  )
}

/** Choosing today's deeds from the backlog; monsters are there too but never suggested first. */
function PickFromBacklog({ onClose, today, slot }: { onClose: () => void; today: string; slot: TaskSlot }) {
  const dispatch = useAppDispatch()
  const g = useAppSelector((s) => s.grimoire)
  const meta = g.meta
  const list = useMemo(
    () =>
      backlog(g, today)
        .filter((t) => !isBlocked(t, g.tasks))
        .sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') || a.dread - b.dread || a.createdAt.localeCompare(b.createdAt)),
    [g, today],
  )
  const counts = slotCounts(g, today)
  return (
    <Modal open onClose={onClose} title={`В план: ${slotLabel[slot]}`}>
      {overLimit(meta, counts, slot) && (
        <Text fontSize="sm" color="orange.300" mb="3">
          На сегодня уже есть {slotLabel[slot]}. Можно, но, может, что-то убрать?
        </Text>
      )}
      {list.length ? (
        <Stack gap="1">
          {list.map((t) => (
            <Flex key={t.id} align="center" gap="3" py="2" px="2" borderRadius="l2" _hover={{ bg: 'bg.muted' }} cursor="pointer" onClick={() => {
              dispatch(A.planTask({ id: t.id, day: today, slot }))
              onClose()
            }}>
              <Box flex="1">
                <Text fontSize="sm">{t.title}</Text>
                <HStack gap="2">
                  <Stars n={t.stars} size={10} />
                  <Dread n={t.dread} size={10} />
                  {t.dueAt && <Text fontSize="xs" color="fg.muted">до {humanDay(t.dueAt.slice(0, 10), today)}</Text>}
                  {t.dread === 3 && <Text fontSize="xs" color="red.300">чудовище</Text>}
                </HStack>
              </Box>
            </Flex>
          ))}
        </Stack>
      ) : (
        <Empty>Бэклог пуст.</Empty>
      )}
    </Modal>
  )
}

function PlanSection({ title, slot, tasks, today, open, pick }: { title: string; slot: TaskSlot; tasks: Task[]; today: string; open: (t: Task) => void; pick: (s: TaskSlot) => void }) {
  return (
    <Box mb="4">
      <Flex align="center" justify="space-between" mb="1.5">
        <Text fontFamily="heading" fontSize="xl" color="ember.100" fontWeight="semibold">
          {title}
        </Text>
        <Button size="xs" variant="ghost" onClick={() => pick(slot)}>
          + из бэклога
        </Button>
      </Flex>
      {tasks.length ? (
        <Stack gap="1">
          {tasks.map((t) => (
            <TaskRow key={t.id} t={t} today={today} onOpen={open} />
          ))}
        </Stack>
      ) : (
        <Text fontSize="sm" color="fg.subtle" px="2">
          {slot === 'optional' ? 'Можно ничего.' : 'Пусто.'}
        </Text>
      )}
    </Box>
  )
}

export default function Scroll() {
  const dispatch = useAppDispatch()
  const g = useAppSelector((s) => s.grimoire)
  const today = useToday()
  const { open, dialog } = useTaskDialog()
  const [pick, setPick] = useState<TaskSlot>()
  const meta = g.meta
  const w = words(meta)
  const plan = dayPlan(g, today)
  const review = meta.reviewedDay === today || meta.nav.active ? [] : toReview(g, today)
  const joys = joysAhead(g, today).slice(0, 3)
  const wheel = wheelNow(today, meta.hemisphere)
  const soon = deadlinesSoon(g, today, addDays(today, 3)).filter((t) => t.doOn !== today)
  const coinsToday = dayCoins(g.coinTxs, today)
  const openToday = plan.all.filter((t) => t.status !== 'done')
  const wishesNear = Object.values(g.wishes).filter((x) => x.status === 'dream' && x.sabbat === wheel.current.sabbat).length

  if (meta.nav.active)
    return (
      <>
        <PageHeader title="Навь" />
        <Section>
          <Stack align="center" textAlign="center" gap="3" py="6">
            <Box color="ember.200" opacity=".8">
              <Crescent size={40} />
            </Box>
            <Text>Ты в нави{meta.nav.since ? ` с ${humanDay(meta.nav.since.slice(0, 10), today)}` : ''}.</Text>
            <Text fontSize="sm" color="fg.muted" maxW="420px">
              Серии и бонусы заморожены, привычки молчат, плана нет. Монеты и копилки на месте. Возвращайся, когда захочешь.
            </Text>
            <Button onClick={() => dispatch(A.setNav({ active: false }))}>Вернуться в явь</Button>
          </Stack>
        </Section>
        {soon.length > 0 && (
          <Section title="Реальные сроки">
            <Stack gap="1">
              {soon.map((t) => (
                <TaskRow key={t.id} t={t} today={today} onOpen={open} compact />
              ))}
            </Stack>
          </Section>
        )}
        {dialog}
      </>
    )

  return (
    <>
      <PageHeader title={w.scroll}>
        <Text fontSize="sm" color="fg.muted">
          {dateTitle(today)} · {moonPhaseNames[moonPhase(today)]}
        </Text>
      </PageHeader>

      {review.length > 0 && <MorningReview items={review} today={today} open={open} />}

      <SimpleGrid columns={{ base: 1, md: 2 }} gap="3" mb="4">
        <Box p="3" borderRadius="l3" borderWidth="1px" borderColor="border" bg="bg.subtle">
          <Text fontFamily="heading" fontSize="lg" color="ember.100" mb="1">
            Впереди радости
          </Text>
          {joys.length ? (
            joys.map((t) => (
              <Text key={t.id} fontSize="sm" cursor="pointer" onClick={() => open(t)}>
                ✦ {t.title}
                <Text as="span" color="fg.subtle">
                  {' '}
                  · {humanDay(t.doOn ?? t.dueAt!.slice(0, 10), today)}
                </Text>
              </Text>
            ))
          ) : (
            <Text fontSize="sm" color="fg.subtle">
              Пока ничего. Добавь с «+радость».
            </Text>
          )}
          <Text fontSize="sm" mt="1" color="fg.muted">
            {sabbats[wheel.next.sabbat].symbol} {sabbats[wheel.next.sabbat].name} через {days(wheel.daysToNext)}
            {wishesNear ? ` · хотелок отрезка: ${wishesNear}` : ''}
          </Text>
        </Box>
        <Box p="3" borderRadius="l3" borderWidth="1px" borderColor="border" bg="bg.subtle">
          <Text fontFamily="heading" fontSize="lg" color="ember.100" mb="1">
            Сегодня
          </Text>
          <Text fontSize="sm" color="fg.muted">
            Сделано {plan.all.filter((t) => t.status === 'done').length + plan.habits.filter((t) => t.status === 'done').length} · монет за день {coinsToday > 0 ? `+${coinsToday}` : coinsToday}
          </Text>
          {wheel.daysToNext <= 7 && (
            <Button asChild size="xs" variant="outline" mt="2">
              <RouterLink to={`/g/wheel?s=${wheel.next.sabbat}`}>Подготовиться к {sabbats[wheel.next.sabbat].dative} →</RouterLink>
            </Button>
          )}
        </Box>
      </SimpleGrid>

      <Section>
        <PlanSection title="Главное" slot="main" tasks={plan.main} today={today} open={open} pick={setPick} />
        <PlanSection title="Дополнительное" slot="extra" tasks={plan.extra} today={today} open={open} pick={setPick} />
        <PlanSection title="Необязательное" slot="optional" tasks={plan.optional} today={today} open={open} pick={setPick} />
        {plan.habits.length > 0 && (
          <Box>
            <Text fontFamily="heading" fontSize="xl" color="ember.100" fontWeight="semibold" mb="1.5">
              {w.rituals}
            </Text>
            <Stack gap="1">
              {plan.habits.map((t) => (
                <TaskRow key={t.id} t={t} today={today} onOpen={open} compact />
              ))}
            </Stack>
          </Box>
        )}
        <Divider my="4" />
        <QuickAdd planToday />
        {openToday.length > 0 && (
          <Flex justify="flex-end" mt="4">
            <Button size="sm" variant="ghost" onClick={() => toBacklog(openToday.map((t) => t.id), 'На сегодня всё. Остальное в бэклоге')}>
              На сегодня всё
            </Button>
          </Flex>
        )}
      </Section>

      {soon.length > 0 && (
        <Section title="Сроки рядом">
          <Stack gap="1">
            {soon.map((t) => (
              <TaskRow key={t.id} t={t} today={today} onOpen={open} compact />
            ))}
          </Stack>
        </Section>
      )}

      {pick && <PickFromBacklog slot={pick} today={today} onClose={() => setPick(undefined)} />}
      {dialog}
    </>
  )
}
