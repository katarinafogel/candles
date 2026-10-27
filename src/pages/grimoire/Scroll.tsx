// The day scroll: joys ahead, the morning review, today's plan (main → extra → optional → rituals),
// one-line adding and «на сегодня всё».
import { Box, Button, Flex, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Crescent } from '../../components/Magic'
import { usePlanGuard } from '../../components/grimoire/PlanGuard'
import { useTaskDialog } from '../../components/grimoire/TaskDialog'
import { cardColumns, TaskCard } from '../../components/grimoire/TaskCard'
import { Empty, Modal, PageHeader, Section } from '../../components/ui'
import { cancel, toBacklog, useToday, withUndo } from '../../grimoire/act'
import { dayCoins } from '../../grimoire/coins'
import { addDays, dayKey, days, daysBetween, humanDay } from '../../grimoire/days'
import { slotLabel } from '../../grimoire/labels'
import { backlog, dayPlan, dayStars, deadlinesSoon, evenInNav, isBlocked, joysAhead, toReview, words } from '../../grimoire/selectors'
import type { Sabbat, Task, TaskSlot } from '../../grimoire/types'
import { isFullMoon, moonPhase, moonPhaseNames, sabbats, wheelNow } from '../../grimoire/wheel'
import { MoonIcon } from '../../components/grimoire/MoonIcon'
import { WheelPick } from '../../components/grimoire/WheelPick'
import { sabbatTag, SabbatNoteDialog } from './Wheel'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { Dread, StarMark, Stars } from '../../components/grimoire/Marks'

const weekdayLong = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']

function dateTitle(day: string) {
  const d = new Date(`${day}T12:00:00Z`)
  return `${weekdayLong[d.getUTCDay()]}, ${humanDay(day, '0000-01-01')}`
}

/**
 * Welcome back after the навь or a few days away: no wall of overdue deeds. «Чистый лист» puts every
 * leftover into one «разобрать потом» pack in the backlog; «по одному» opens the usual morning review.
 */
function Welcome({ items, today, navDays, away }: { items: Task[]; today: string; navDays?: number; away: number }) {
  const dispatch = useAppDispatch()
  const welcomed = () => dispatch(A.updateMeta({ welcomedDay: today }))
  return (
    <Section>
      <Stack gap="3" align="center" textAlign="center" py="2">
        <Box color="ember.200">
          <Crescent size={34} />
        </Box>
        <Text fontFamily="heading" fontSize="2xl" color="ember.100">
          С возвращением
        </Text>
        <Text fontSize="sm" color="fg.muted" maxW="440px">
          {navDays != null ? `Ты была в нави ${days(Math.max(1, navDays))}. ` : `Тебя не было ${days(away)}. `}
          {items.length
            ? `С прошлых дней осталось ${items.length}. Ничего не горит: можно начать с чистого листа, а хвосты разобрать потом.`
            : 'Хвостов нет, можно просто начать день.'}
        </Text>
        <Flex gap="2" wrap="wrap" justify="center">
          {items.length > 0 ? (
            <>
              <Button size="sm" onClick={() => withUndo('Чистый лист: хвосты в «разобрать потом»', () => dispatch(A.clearSlate({ ids: items.map((t) => t.id), day: today })))}>
                Чистый лист
              </Button>
              <Button size="sm" variant="outline" onClick={welcomed}>
                Разобрать по одному
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={welcomed}>
              Начать день
            </Button>
          )}
        </Flex>
      </Stack>
    </Section>
  )
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
        {items.length >= 5 && (
          <Button size="sm" variant="ghost" ml="auto" onClick={() => withUndo('Чистый лист: хвосты в «разобрать потом»', () => dispatch(A.clearSlate({ ids: items.map((x) => x.id), day: today })))}>
            Чистый лист
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          ml={items.length >= 5 ? undefined : 'auto'}
          onClick={() =>
            withUndo('Всё в бэклоге', () => {
              dispatch(A.reviewToBacklog(items.map((x) => x.id)))
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
  const list = useMemo(
    () =>
      backlog(g, today)
        .filter((t) => !isBlocked(t, g.tasks))
        .sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') || a.dread - b.dread || a.createdAt.localeCompare(b.createdAt)),
    [g, today],
  )
  const [guard, guardDialog] = usePlanGuard()
  return (
    <Modal open onClose={onClose} title={`В план: ${slotLabel[slot]}`}>
      {guardDialog}
      {list.length ? (
        <Stack gap="1">
          {list.map((t) => (
            <Flex key={t.id} align="center" gap="3" py="2" px="2" borderRadius="l2" _hover={{ bg: 'bg.muted' }} cursor="pointer" onClick={() => {
              guard(
                slot,
                () => {
                  dispatch(A.planTask({ id: t.id, day: today, slot }))
                  onClose()
                },
                { stars: t.stars, self: t.id },
              )
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

/**
 * The day's stars against the limit: white for joys, first; gold for deeds; pale outlines for what is
 * still free; red for what goes past the limit.
 */
function DayStars({ today }: { today: string }) {
  const g = useAppSelector((s) => s.grimoire)
  const st = dayStars(g, today)
  if (!st.limit && !st.total) return null
  const marks: { color: string; filled: boolean }[] = []
  for (let i = 0; i < st.joy; i++) marks.push({ color: '#f4efe6', filled: true })
  for (let i = 0; i < st.deed; i++) marks.push({ color: st.limit && marks.length >= st.limit ? 'red.400' : 'ember.300', filled: true })
  while (marks.length < st.limit) marks.push({ color: 'ember.700', filled: false })
  return (
    <Box mt="1.5">
      <Flex gap="0.5" wrap="wrap" aria-label={`звёзд в плане ${st.total} из ${st.limit}`}>
        {marks.map((m, i) => (
          <StarMark key={i} filled={m.filled} color={m.color} size={15} />
        ))}
      </Flex>
      <Text fontSize="xs" color={st.over ? 'red.300' : 'fg.subtle'} mt="0.5">
        {st.limit ? `звёзд в плане ${st.total} из ${st.limit}${st.over ? ` · сверх нормы ${st.over}` : ''}` : `звёзд в плане ${st.total}`}
      </Text>
    </Box>
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
        <SimpleGrid gridTemplateColumns={cardColumns} gap={{ base: '3', md: '4' }}>
          {tasks.map((t) => (
            <TaskCard key={t.id} t={t} today={today} onOpen={open} />
          ))}
        </SimpleGrid>
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
  const [survival, setSurvival] = useState(false)
  const [wheelPick, setWheelPick] = useState(false)
  const [noteFor, setNoteFor] = useState<Sabbat>()
  const meta = g.meta
  const w = words(meta)
  const fullPlan = dayPlan(g, today)
  // Energy 1–2 in today's latest mirror entry: offer to show only the main deeds and the light ones.
  const lastEnergy = Object.values(g.journal)
    .filter((e) => e.day === today && e.energy)
    .sort((a, b) => b.at.localeCompare(a.at))[0]?.energy
  const lowEnergy = !!lastEnergy && lastEnergy <= 2
  const light = (t: Task) => t.stars === 1 || t.status === 'done'
  const plan = survival ? { ...fullPlan, extra: fullPlan.extra.filter(light), optional: fullPlan.optional.filter(light) } : fullPlan
  const review = meta.reviewedDay === today || meta.nav.active ? [] : toReview(g, today)
  // Back from the навь today, or away for 3+ days: a welcome first, until it is answered.
  const lastNav = meta.nav.history[meta.nav.history.length - 1]
  const backFromNav = !!lastNav?.to && dayKey(new Date(lastNav.to), meta.dayBoundaryHour) === today
  const navDays = lastNav?.to ? daysBetween(dayKey(new Date(lastNav.from), meta.dayBoundaryHour), today) : undefined
  const welcome = meta.nav.active || meta.welcomedDay === today ? undefined : backFromNav ? 'nav' : (meta.awayDays ?? 0) >= 3 ? 'away' : undefined
  const joys = joysAhead(g, today).slice(0, 3)
  const wheel = wheelNow(today, meta.hemisphere)
  const soon = deadlinesSoon(g, today, addDays(today, 3)).filter((t) => t.doOn !== today)
  const navReminders = meta.nav.active ? evenInNav(g, addDays(today, 3)) : []
  const coinsToday = dayCoins(g.coinTxs, today)
  const openToday = plan.all.filter((t) => t.status !== 'done')
  const wishesNear = Object.values(g.wishes).filter((x) => x.status === 'dream' && x.sabbat === wheel.current.sabbat).length
  // The coming sabbat shows up two weeks ahead; for three days after one, a word on how it went.
  const sabbatSoon = wheel.daysToNext <= 14
  const afterSabbat = daysBetween(wheel.current.day, today) <= 3
  const noteOf = (sabbat: Sabbat, from: string) => Object.values(g.journal).some((e) => e.tags?.includes(sabbatTag(sabbat)) && e.day >= from)
  const askNote = afterSabbat && !noteOf(wheel.current.sabbat, wheel.current.day)
  // «Что ты писала в прошлый Самайн»: the latest entry about the same sabbat from an earlier turn.
  const memoryFor = sabbatSoon ? wheel.next : afterSabbat ? wheel.current : undefined
  const memory = memoryFor
    ? Object.values(g.journal)
        .filter((e) => e.text && e.tags?.includes(sabbatTag(memoryFor.sabbat)) && e.day < addDays(memoryFor.day, -30))
        .sort((a, b) => b.day.localeCompare(a.day))[0]
    : undefined

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
        {navReminders.length > 0 && (
          <Section title="Даже в нави">
            <SimpleGrid gridTemplateColumns={cardColumns} gap={{ base: '3', md: '4' }}>
              {navReminders.map((t) => (
                <TaskCard key={t.id} t={t} today={today} onOpen={open} compact />
              ))}
            </SimpleGrid>
          </Section>
        )}
        {soon.filter((t) => !t.evenInNav).length > 0 && (
          <Section title="Реальные сроки">
            <SimpleGrid gridTemplateColumns={cardColumns} gap={{ base: '3', md: '4' }}>
              {soon.filter((t) => !t.evenInNav).map((t) => (
                <TaskCard key={t.id} t={t} today={today} onOpen={open} compact />
              ))}
            </SimpleGrid>
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

      {welcome ? (
        <Welcome items={review} today={today} away={meta.awayDays ?? 0} navDays={welcome === 'nav' ? navDays : undefined} />
      ) : (
        review.length > 0 && <MorningReview items={review} today={today} open={open} />
      )}

      {lowEnergy && (
        <Flex mb="4" p="3" borderRadius="l2" bg="bg.muted" align="center" gap="3" wrap="wrap">
          <Text fontSize="sm" flex="1" color="fg.muted">
            Энергии сегодня мало. Можно оставить только главное и лёгкое.
          </Text>
          <Button size="xs" variant={survival ? 'solid' : 'outline'} onClick={() => setSurvival(!survival)}>
            {survival ? 'Показать всё' : 'Режим выживания'}
          </Button>
        </Flex>
      )}

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
                  · {humanDay(t.doOn ?? t.dueAt?.slice(0, 10) ?? today, today)}
                </Text>
              </Text>
            ))
          ) : (
            <Text fontSize="sm" color="fg.subtle">
              Пока ничего. Добавь с «+радость».
            </Text>
          )}
          {sabbatSoon && (
            <Text fontSize="sm" mt="1" color="fg.muted">
              {sabbats[wheel.next.sabbat].symbol} до {sabbats[wheel.next.sabbat].genitive} {days(wheel.daysToNext)}
              {wishesNear ? ` · хотелок отрезка: ${wishesNear}` : ''}
            </Text>
          )}
          {isFullMoon(today) && (
            <HStack gap="1.5" mt="1" fontSize="sm" color="fg.muted">
              <Box color="ember.100">
                <MoonIcon day={today} size={13} />
              </Box>
              <Text as="span">Сегодня полнолуние, эсбат</Text>
            </HStack>
          )}
        </Box>
        <Box p="3" borderRadius="l3" borderWidth="1px" borderColor="border" bg="bg.subtle">
          <Text fontFamily="heading" fontSize="lg" color="ember.100" mb="1">
            Сегодня
          </Text>
          <Text fontSize="sm" color="fg.muted">
            Сделано {plan.all.filter((t) => t.status === 'done').length + plan.habits.filter((t) => t.status === 'done').length} · монет за день {coinsToday > 0 ? `+${coinsToday}` : coinsToday}
          </Text>
          <DayStars today={today} />
          <EveningCall today={today} />
          <Button size="xs" variant="outline" mt="2" onClick={() => setWheelPick(true)}>
            {sabbatSoon ? `Подготовиться к ${sabbats[wheel.next.sabbat].dative}` : 'Дела колеса'}
          </Button>
        </Box>
      </SimpleGrid>

      {(askNote || memory) && (
        <Section>
          {askNote && (
            <Flex gap="3" align="center" wrap="wrap">
              <Text fontSize="sm" flex="1" minW="200px">
                {sabbats[wheel.current.sabbat].symbol} Как прошёл {sabbats[wheel.current.sabbat].name}? Пара слов останется в журнале саббата до следующего года.
              </Text>
              <Button size="xs" variant="outline" onClick={() => setNoteFor(wheel.current.sabbat)}>
                Записать
              </Button>
            </Flex>
          )}
          {memory && memoryFor && (
            <Box mt={askNote ? '3' : '0'}>
              <Text fontSize="xs" color="fg.subtle">
                В прошлый {sabbats[memoryFor.sabbat].name} ({memory.day.slice(0, 4)}) ты писала:
              </Text>
              <Text fontSize="sm" fontStyle="italic" whiteSpace="pre-wrap" lineClamp={4}>
                «{memory.text}»
              </Text>
            </Box>
          )}
        </Section>
      )}

      <Section dense>
        <PlanSection title="Главное" slot="main" tasks={plan.main} today={today} open={open} pick={setPick} />
        <PlanSection title="Дополнительное" slot="extra" tasks={plan.extra} today={today} open={open} pick={setPick} />
        <PlanSection title="Необязательное" slot="optional" tasks={plan.optional} today={today} open={open} pick={setPick} />
        {plan.habits.length > 0 && (
          <Box>
            <Text fontFamily="heading" fontSize="xl" color="ember.100" fontWeight="semibold" mb="1.5">
              {w.rituals}
            </Text>
            <SimpleGrid gridTemplateColumns={cardColumns} gap={{ base: '3', md: '4' }}>
              {plan.habits.map((t) => (
                <TaskCard key={t.id} t={t} today={today} onOpen={open} compact />
              ))}
            </SimpleGrid>
          </Box>
        )}
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
          <SimpleGrid gridTemplateColumns={cardColumns} gap={{ base: '3', md: '4' }}>
            {soon.map((t) => (
              <TaskCard key={t.id} t={t} today={today} onOpen={open} compact />
            ))}
          </SimpleGrid>
        </Section>
      )}

      {pick && <PickFromBacklog slot={pick} today={today} onClose={() => setPick(undefined)} />}
      {dialog}
      {wheelPick && <WheelPick onClose={() => setWheelPick(false)} focus={sabbatSoon ? wheel.next.sabbat : undefined} />}
      {noteFor && <SabbatNoteDialog sabbat={noteFor} onClose={() => setNoteFor(undefined)} />}
    </>
  )
}

/** From the evening time until the day ends, a quiet call to the evening page — gone once it's written. */
function EveningCall({ today }: { today: string }) {
  const meta = useAppSelector((s) => s.grimoire.meta)
  const written = useAppSelector((s) => Object.values(s.grimoire.journal).some((e) => e.day === today && e.type === 'evening'))
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  const at = meta.eveningAt ?? '21:00'
  if (!at || written || meta.nav.active) return null
  const [h, m] = at.split(':').map(Number)
  const mins = now.getHours() * 60 + now.getMinutes()
  // After midnight it is still «today» until the day boundary.
  const evening = mins >= h * 60 + m || now.getHours() < meta.dayBoundaryHour
  if (!evening) return null
  return (
    <Button asChild size="xs" variant="outline" mt="2" mr="2">
      <RouterLink to="/g/mirror/evening">🌙 Вечерняя страница</RouterLink>
    </Button>
  )
}
