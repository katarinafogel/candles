// Rituals (habit trackers): streaks by schedule, a year of moons instead of squares, today's mark.
import { Box, Button, Flex, HStack, IconButton, Input, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { LuMinus, LuPencil, LuPlus } from 'react-icons/lu'
import { MarkPicker } from '../../components/grimoire/Marks'
import { Chips, confirmAction, Empty, Field, Modal, notify, NumInput, PageHeader, Section, TextInput } from '../../components/ui'
import { useBalance, useToday } from '../../grimoire/act'
import { addDays, dayKey, weekStart } from '../../grimoire/days'
import { habitLogId, habitTaskId, isDone, isScheduled, navTest, streak } from '../../grimoire/habits'
import { words } from '../../grimoire/selectors'
import type { DayKey, Habit, HabitSchedule } from '../../grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'

const SHIELD_PRICE = 50
const dayNames = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

function scheduleText(s: HabitSchedule) {
  if (s.kind === 'daily') return 'каждый день'
  if (s.kind === 'timesPerWeek') return `${s.n} раз в неделю`
  return s.days.map((d) => dayNames[d - 1]).join(', ')
}

type Draft = Omit<Habit, 'id' | 'createdAt' | 'shields'> & Partial<Pick<Habit, 'id' | 'createdAt' | 'shields'>>

const blank: Draft = { title: '', schedule: { kind: 'daily' }, mark: { kind: 'check' }, stars: 1, dread: 0, status: 'active' }

function HabitDialog({ habit, onClose }: { habit: Draft; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [h, setH] = useState<Draft>(habit)
  const set = (p: Partial<Draft>) => setH({ ...h, ...p })
  const s = h.schedule
  return (
    <Modal
      open
      onClose={onClose}
      title={h.id ? h.title : 'Новый ритуал'}
      footer={
        <>
          {h.id && (
            <Button
              variant="ghost"
              colorPalette="red"
              mr="auto"
              onClick={() => {
                if (confirmAction('Удалить ритуал вместе с историей отметок? Можно вместо этого отправить в архив.')) {
                  dispatch(A.deleteHabit(h.id!))
                  onClose()
                }
              }}
            >
              Удалить
            </Button>
          )}
          <Button
            disabled={!h.title.trim() || (s.kind === 'weekdays' && !s.days.length)}
            onClick={() => {
              dispatch(A.upsertHabit({ habit: { ...h, title: h.title.trim() } }))
              onClose()
            }}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <Stack gap="4">
        <Field label="Название">
          <TextInput value={h.title} onChange={(v) => set({ title: v })} placeholder="8 стаканов воды" />
        </Field>
        <Field label="Расписание">
          <Chips
            value={s.kind}
            onChange={(v) =>
              set({ schedule: v === 'weekdays' ? { kind: 'weekdays', days: [1, 3, 5] } : v === 'timesPerWeek' ? { kind: 'timesPerWeek', n: 3 } : { kind: 'daily' } })
            }
            options={[
              { value: 'daily', label: 'каждый день' },
              { value: 'weekdays', label: 'дни недели' },
              { value: 'timesPerWeek', label: 'N раз в неделю' },
            ]}
          />
        </Field>
        {s.kind === 'weekdays' && (
          <Chips multi value={s.days.map(String)} onChange={(v) => set({ schedule: { kind: 'weekdays', days: ((v as string[]) ?? []).map(Number).sort() } })} options={dayNames.map((n, i) => ({ value: String(i + 1), label: n }))} />
        )}
        {s.kind === 'timesPerWeek' && <NumInput value={s.n} onChange={(v) => set({ schedule: { kind: 'timesPerWeek', n: Math.max(1, Math.min(7, Math.round(v ?? 1))) } })} suffix="раз в неделю" />}
        <Field label="Отметка">
          <Chips
            value={h.mark.kind}
            onChange={(v) => set({ mark: v === 'count' ? { kind: 'count', goal: 8 } : { kind: 'check' } })}
            options={[
              { value: 'check', label: 'да / нет' },
              { value: 'count', label: 'количество' },
            ]}
          />
        </Field>
        {h.mark.kind === 'count' && (
          <HStack gap="3">
            <Field label="Цель">
              <NumInput value={h.mark.goal} onChange={(v) => set({ mark: { kind: 'count', goal: Math.max(1, v ?? 1), unit: h.mark.kind === 'count' ? h.mark.unit : undefined } })} />
            </Field>
            <Field label="Единица">
              <TextInput value={h.mark.unit ?? ''} onChange={(v) => set({ mark: { kind: 'count', goal: h.mark.kind === 'count' ? h.mark.goal : 1, unit: v || undefined } })} placeholder="стаканов" />
            </Field>
          </HStack>
        )}
        <Field label="Сложность задач">
          <MarkPicker kind="stars" value={h.stars} onChange={(v) => set({ stars: v as Habit['stars'] })} />
        </Field>
        <Field label="Нехотение">
          <MarkPicker kind="dread" value={h.dread} onChange={(v) => set({ dread: v as Habit['dread'] })} />
        </Field>
        <HStack gap="3">
          <Field label="С">
            <Input type="date" value={h.activeFrom ?? ''} onChange={(e) => set({ activeFrom: e.target.value || undefined })} />
          </Field>
          <Field label="По">
            <Input type="date" value={h.activeTo ?? ''} onChange={(e) => set({ activeTo: e.target.value || undefined })} />
          </Field>
        </HStack>
        {h.id && (
          <Field label="Состояние">
            <Chips value={h.status} onChange={(v) => set({ status: (v as Habit['status']) ?? 'active' })} options={[
              { value: 'active', label: 'активен' },
              { value: 'paused', label: 'на паузе' },
              { value: 'archived', label: 'в архиве' },
            ]} />
          </Field>
        )}
      </Stack>
    </Modal>
  )
}

/** A year of moons: lit — done, ring — skipped, faint — in навь, dim dot — not scheduled or ahead. */
function YearOfMoons({ h, today, inNav }: { h: Habit; today: DayKey; inNav: (d: DayKey) => boolean }) {
  const logs = useAppSelector((s) => s.grimoire.habitLogs)
  const first = weekStart(addDays(today, -7 * 25))
  const weeks = Array.from({ length: 26 }, (_, i) => addDays(first, i * 7))
  return (
    <Box overflowX="auto" pb="1">
      <Flex gap="3px">
        {weeks.map((wk) => (
          <Flex key={wk} direction="column" gap="3px">
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDays(wk, i)
              const log = logs[habitLogId(h.id, d)]
              const done = isDone(h, log)
              const future = d > today
              const nav = inNav(d)
              const sched = isScheduled(h, d)
              return (
                <Box
                  key={d}
                  w="9px"
                  h="9px"
                  borderRadius="full"
                  title={d}
                  bg={done ? 'ember.300' : sched && !future ? 'transparent' : 'border'}
                  borderWidth={!done && sched && !future ? '1px' : 0}
                  borderColor={log?.skipped ? 'fg.subtle' : 'border.emphasized'}
                  opacity={nav ? 0.3 : sched && !future ? 1 : 0.35}
                  boxShadow={done ? '0 0 4px rgba(224,164,85,.5)' : undefined}
                />
              )
            })}
          </Flex>
        ))}
      </Flex>
    </Box>
  )
}

function HabitCard({ h, today, onEdit }: { h: Habit; today: DayKey; onEdit: () => void }) {
  const dispatch = useAppDispatch()
  const g = useAppSelector((s) => s.grimoire)
  const coins = useBalance()
  const inNav = useMemo(() => navTest(g.meta, (iso) => dayKey(new Date(iso), g.meta.dayBoundaryHour)), [g.meta])
  const st = streak(h, g.habitLogs, today, inNav)
  const log = g.habitLogs[habitLogId(h.id, today)]
  const task = g.tasks[habitTaskId(h.id, today)]
  const doneToday = isDone(h, log)
  const scheduled = isScheduled(h, today)

  return (
    <Box p="4" borderRadius="l3" borderWidth="1px" borderColor="emerald.800" bg="bg.subtle" backgroundImage="radial-gradient(16rem 8rem at 100% 0%, rgba(142,168,131,.10), transparent 70%)" opacity={h.status === 'active' ? 1 : 0.6}>
      <Flex justify="space-between" align="flex-start" gap="2" mb="2">
        <Box>
          <Text fontFamily="heading" fontSize="xl" color="emerald.100" fontWeight="semibold" lineHeight="1.2">
            {h.title}
          </Text>
          <Text fontSize="xs" color="fg.muted">
            {scheduleText(h.schedule)}
            {h.status !== 'active' ? ` · ${h.status === 'paused' ? 'на паузе' : 'в архиве'}` : ''}
          </Text>
        </Box>
        <IconButton size="xs" variant="ghost" aria-label="Изменить" onClick={onEdit}>
          <LuPencil />
        </IconButton>
      </Flex>
      <HStack gap="4" mb="3" fontSize="sm">
        <Text>
          <Text as="span" fontFamily="heading" fontSize="2xl" color="ember.200">
            {st.current}
          </Text>{' '}
          серия
        </Text>
        <Text color="fg.muted">лучшая {st.best}</Text>
        <Text color="fg.muted">{Math.round(st.last30 * 100)}% за 30 дней</Text>
      </HStack>
      <YearOfMoons h={h} today={today} inNav={inNav} />
      <Flex mt="3" gap="2" align="center" wrap="wrap">
        {scheduled && h.mark.kind === 'check' && task && (
          <Button size="sm" variant={doneToday ? 'outline' : 'solid'} onClick={() => dispatch(doneToday ? A.reopenTask({ id: task.id }) : A.completeTask({ id: task.id }))}>
            {doneToday ? 'Отмечено сегодня' : 'Отметить сегодня'}
          </Button>
        )}
        {scheduled && h.mark.kind === 'count' && (
          <HStack gap="2">
            <IconButton size="sm" variant="outline" aria-label="Меньше" onClick={() => dispatch(A.setHabitValue({ habitId: h.id, date: today, value: Math.max(0, (log?.value ?? 0) - 1) }))}>
              <LuMinus />
            </IconButton>
            <Text fontSize="sm" minW="16" textAlign="center">
              {log?.value ?? 0} / {h.mark.goal} {h.mark.unit ?? ''}
            </Text>
            <IconButton size="sm" variant="outline" aria-label="Больше" onClick={() => dispatch(A.setHabitValue({ habitId: h.id, date: today, value: (log?.value ?? 0) + 1 }))}>
              <LuPlus />
            </IconButton>
          </HStack>
        )}
        <Text fontSize="xs" color="fg.subtle" ml="auto">
          оберегов: 1 в неделю{h.shields ? ` + ${h.shields}` : ''}
        </Text>
        <Button
          size="xs"
          variant="ghost"
          disabled={coins < SHIELD_PRICE}
          onClick={() => {
            dispatch(A.buyShield({ habitId: h.id, price: SHIELD_PRICE }))
            notify(`Оберег куплен · −${SHIELD_PRICE} 🪙`)
          }}
        >
          купить оберег · {SHIELD_PRICE}
        </Button>
      </Flex>
    </Box>
  )
}

export default function Rituals() {
  const g = useAppSelector((s) => s.grimoire)
  const today = useToday()
  const [edit, setEdit] = useState<Draft>()
  const [archived, setArchived] = useState(false)
  const w = words(g.meta)
  const habits = Object.values(g.habits)
    .filter((h) => (archived ? h.status === 'archived' : h.status !== 'archived'))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const archivedCount = Object.values(g.habits).filter((h) => h.status === 'archived').length

  return (
    <>
      <PageHeader title={w.rituals}>
        <Button size="sm" onClick={() => setEdit({ ...blank, activeFrom: today })}>
          <LuPlus /> Новый
        </Button>
      </PageHeader>
      {g.meta.nav.active && (
        <Section>
          <Text fontSize="sm" color="fg.muted">
            Ты в нави: серии заморожены, ритуалы не создают задач и не пишут пропусков.
          </Text>
        </Section>
      )}
      {habits.length ? (
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap="3">
          {habits.map((h) => (
            <HabitCard key={h.id} h={h} today={today} onEdit={() => setEdit(h)} />
          ))}
        </SimpleGrid>
      ) : (
        <Empty>{archived ? 'Архив пуст.' : 'Ритуалов пока нет. Активный ритуал сам кладёт дело в свиток в свои дни.'}</Empty>
      )}
      {(archivedCount > 0 || archived) && (
        <Button size="xs" variant="ghost" mt="4" onClick={() => setArchived(!archived)}>
          {archived ? '← к активным' : `Архив · ${archivedCount}`}
        </Button>
      )}
      {edit && <HabitDialog habit={edit} onClose={() => setEdit(undefined)} />}
    </>
  )
}
