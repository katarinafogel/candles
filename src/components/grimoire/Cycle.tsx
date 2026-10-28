// The cycle in the grimoire: a chip by the Moon in the scroll's header, the dialog to mark a period
// (start, end, how heavy, how it felt) with the forecast and the history, and the scroll's hint on
// days that are usually low on energy — a lighter plan, frogs moved to a stronger phase.
import { Box, Button, Flex, HStack, IconButton, Input, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuTrash2 } from 'react-icons/lu'
import { useToday, withUndo } from '../../grimoire/act'
import { cycleDay, cyclePhases, cycleStats, cycleSymptoms, openPeriod, periodsOf } from '../../grimoire/cycle'
import { addDays, daysBetween, humanDay, plural } from '../../grimoire/days'
import { isFrog } from '../../grimoire/coins'
import { cycleEnergy } from '../../grimoire/mirrorStats'
import type { CycleEntry } from '../../grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { Chips, confirmAction, Field, Modal } from '../ui'

const ddmm = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}`

/** «день 12 · фоллик.» by the Moon; «+ цикл» before anything is marked. */
export function CycleChip({ onOpen }: { onOpen: () => void }) {
  const cycles = useAppSelector((s) => s.grimoire.cycles)
  const today = useToday()
  const c = cycleDay(cycles ?? {}, today)
  return (
    <Button size="2xs" variant="ghost" color="fg.muted" px="1.5" onClick={onOpen}>
      {c ? (
        <>
          <Box w="7px" h="7px" borderRadius="full" bg={cyclePhases[c.phase].color} />
          день {c.n} · {cyclePhases[c.phase].short}
        </>
      ) : (
        '+ цикл'
      )}
    </Button>
  )
}

function DateInput({ value, max, onChange }: { value: string; max?: string; onChange: (v: string) => void }) {
  return (
    <Input size="sm" type="date" w="160px" value={value} max={max} onChange={(e) => e.target.value && onChange(e.target.value)} style={{ colorScheme: 'dark' }} />
  )
}

function PeriodRow({ p, today }: { p: CycleEntry; today: string }) {
  const dispatch = useAppDispatch()
  const [edit, setEdit] = useState(false)
  const save = (patch: Partial<CycleEntry>) => dispatch(A.upsertCycle({ ...p, ...patch }))
  return (
    <Box py="1.5" borderBottomWidth="1px" borderColor="border.muted">
      <HStack gap="2" fontSize="sm">
        <Text flex="1" cursor="pointer" onClick={() => setEdit(!edit)}>
          {ddmm(p.start)} — {p.end ? `${ddmm(p.end)} · ${plural(daysBetween(p.start, p.end) + 1, 'день', 'дня', 'дней')}` : 'идут'}
          {p.flow ? ` · ${['легко', 'средне', 'обильно'][p.flow - 1]}` : ''}
        </Text>
        <IconButton size="2xs" variant="ghost" aria-label="Удалить" onClick={() => confirmAction('Удалить эту отметку цикла?') && dispatch(A.deleteCycle(p.id))}>
          <LuTrash2 />
        </IconButton>
      </HStack>
      {edit && (
        <Flex gap="2" mt="1.5" wrap="wrap" align="center" fontSize="xs" color="fg.muted">
          начало <DateInput value={p.start} max={today} onChange={(start) => save({ start })} />
          конец <DateInput value={p.end ?? ''} max={today} onChange={(end) => save({ end })} />
        </Flex>
      )}
    </Box>
  )
}

export function CycleDialog({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch()
  const cycles = useAppSelector((s) => s.grimoire.cycles) ?? {}
  const today = useToday()
  const [on, setOn] = useState(today)
  const stats = cycleStats(cycles)
  const c = cycleDay(cycles, today, stats)
  const open = openPeriod(cycles)
  const history = periodsOf(cycles).reverse()
  const toNext = c ? daysBetween(today, c.nextStart) : undefined
  return (
    <Modal open onClose={onClose} title="Цикл">
      <Stack gap="5">
        {c ? (
          <Box>
            <HStack gap="2">
              <Box w="10px" h="10px" borderRadius="full" bg={cyclePhases[c.phase].color} />
              <Text fontWeight="semibold">
                День {c.n} · {cyclePhases[c.phase].name}
              </Text>
            </HStack>
            {c.predicted && (
              <Text fontSize="sm" color="ember.200" mt="1">
                По прогнозу месячные начались {humanDay(c.start, today)} — отметь, когда начнутся на самом деле.
              </Text>
            )}
            <Text fontSize="sm" color="fg.muted" mt="1">
              Следующие {toNext! <= 0 ? 'могут начаться уже' : `примерно ${humanDay(c.nextStart, today)}`} · цикл {stats.length} дн., месячные {stats.period} дн.
              {stats.approx ? ` — пока примерно: циклов отмечено ${stats.cycles} из 3` : ` — по ${plural(stats.cycles, 'последнему циклу', 'последним циклам', 'последним циклам')}`}
            </Text>
          </Box>
        ) : (
          <Text fontSize="sm" color="fg.muted">
            Отметь начало месячных — гримуар посчитает фазы и подскажет, когда энергии обычно меньше. Это подсказка по твоим данным, не медицинский прогноз.
          </Text>
        )}

        {open ? (
          <Stack gap="3" p="3" borderRadius="l2" borderWidth="1px" borderColor="border" bg="bg.subtle">
            <Text fontSize="sm">{open.start === today ? 'Начались сегодня' : `Идут с ${ddmm(open.start)}`}</Text>
            <Field label="Интенсивность">
              <Chips value={open.flow ? String(open.flow) : undefined} onChange={(v) => dispatch(A.upsertCycle({ id: open.id, start: open.start, flow: v ? (Number(v) as 1 | 2 | 3) : undefined }))} options={[
                { value: '1', label: 'легко' },
                { value: '2', label: 'средне' },
                { value: '3', label: 'обильно' },
              ]} />
            </Field>
            <Field label="Самочувствие">
              <Chips multi value={open.symptoms ?? []} onChange={(v) => dispatch(A.upsertCycle({ id: open.id, start: open.start, symptoms: (v as string[])?.length ? (v as string[]) : undefined }))} options={cycleSymptoms.map((x) => ({ value: x.key, label: x.label }))} />
            </Field>
            <Flex gap="2" align="center" wrap="wrap">
              <Button size="sm" onClick={() => dispatch(A.upsertCycle({ ...open, end: on < open.start ? open.start : on }))}>
                Закончились {on === today ? 'сегодня' : ddmm(on)}
              </Button>
              <DateInput value={on} max={today} onChange={setOn} />
            </Flex>
          </Stack>
        ) : (
          <Flex gap="2" align="center" wrap="wrap">
            <Button size="sm" onClick={() => dispatch(A.upsertCycle({ start: on }))}>
              Начались {on === today ? 'сегодня' : ddmm(on)}
            </Button>
            <DateInput value={on} max={today} onChange={setOn} />
          </Flex>
        )}

        {history.length > 0 && (
          <Box>
            <Text fontSize="xs" color="fg.subtle" textTransform="uppercase" letterSpacing=".06em" mb="1">
              Отмечено
            </Text>
            {history.slice(0, 12).map((p) => (
              <PeriodRow key={p.id} p={p} today={today} />
            ))}
          </Box>
        )}
      </Stack>
    </Modal>
  )
}

/**
 * On a day that by her past cycles is usually low on energy: offer a lighter plan (the day's stars
 * limit halved) and to move today's frogs and «чудовища» to the coming stronger phase. Hers to decide.
 */
export function CycleHint({ today }: { today: string }) {
  const dispatch = useAppDispatch()
  const g = useAppSelector((s) => s.grimoire)
  const [gone, setGone] = useState(false)
  const cycles = g.cycles ?? {}
  const stats = cycleStats(cycles)
  const c = cycleDay(cycles, today, stats)
  if (gone || !c || stats.cycles < 3 || g.meta.nav.active) return null
  const energy = cycleEnergy(Object.values(g.journal), cycles)
  const here = energy.byPhase[c.phase]
  if (here == null || energy.all == null || here > energy.all - 0.4) return null
  // The strongest phase ahead within this cycle and the next: its first day.
  const best = (Object.entries(energy.byPhase) as [keyof typeof cyclePhases, number | undefined][]).filter(([, v]) => v != null).sort((a, b) => b[1]! - a[1]!)[0]?.[0]
  let strong: string | undefined
  for (let i = 1; i <= stats.length && best; i++) {
    const d = addDays(today, i)
    if (cycleDay(cycles, d, stats)?.phase === best) {
      strong = d
      break
    }
  }
  const frogs = Object.values(g.tasks).filter((t) => t.doOn === today && t.status !== 'done' && t.status !== 'cancelled' && !t.habitId && (isFrog(t) || t.dread >= 3))
  const easy = g.meta.easyDay === today
  if (easy && !frogs.length) return null
  return (
    <Box p="3" mb="4" borderRadius="l3" borderWidth="1px" borderColor="border" bg="bg.subtle">
      <Text fontSize="sm" mb="2">
        {cyclePhases[c.phase].during[0].toUpperCase() + cyclePhases[c.phase].during.slice(1)} энергия у тебя по прошлым циклам обычно ниже ({here.toFixed(1).replace('.', ',')} против {energy.all.toFixed(1).replace('.', ',')}). Облегчить сегодня?
      </Text>
      <Flex gap="2" wrap="wrap">
        {!easy && (
          <Button size="xs" onClick={() => dispatch(A.updateMeta({ easyDay: today }))}>
            Лёгкий план: звёзд вдвое меньше
          </Button>
        )}
        {frogs.length > 0 && strong && (
          <Button
            size="xs"
            variant="outline"
            onClick={() => withUndo(`Жабы перенесены на ${humanDay(strong!, today)}`, () => frogs.forEach((t) => dispatch(A.planTask({ id: t.id, day: strong!, slot: t.slot }))))}
          >
            Жаб ({frogs.length}) — на {humanDay(strong, today)}, {cyclePhases[best!].during}
          </Button>
        )}
        <Button size="xs" variant="ghost" onClick={() => setGone(true)}>
          Справлюсь
        </Button>
      </Flex>
    </Box>
  )
}
