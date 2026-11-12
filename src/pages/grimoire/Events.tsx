// «События»: long stretches of life — a trip, a sick leave. Made in two steps: the dates, then what
// happens with the deeds of those days (keep, move to the day after, to the backlog, let go). Rituals of
// those days are skipped without breaking a series. The scroll and the calendar mark the days.
import { Box, Button, Flex, HStack, Input, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { useAttempt } from '../../components/grimoire/RoundBlocks'
import { confirmAction, Empty, Field, Modal, notify, PageHeader, Section, Select, TextArea, TextInput } from '../../components/ui'
import { useToday } from '../../grimoire/act'
import { addDays, daysBetween, humanDay, plural } from '../../grimoire/days'
import { isOpenTask } from '../../grimoire/selectors'
import type { LifeEvent, Task } from '../../grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'

type Fate = 'keep' | 'after' | 'backlog' | 'cancel'
const fateLabel: Record<Fate, string> = { keep: 'оставить', after: 'на день после', backlog: 'в бэклог', cancel: 'отпустить' }
const sigils = ['🧳', '🤒', '🏖️', '✈️', '🚆', '🏡', '🎓', '🌙']

type Draft = Partial<LifeEvent> & { title: string; from: string; to: string }

/** The deeds planned inside the dates (rituals apart: they are skipped by themselves). */
const deedsIn = (tasks: Record<string, Task>, from: string, to: string) =>
  Object.values(tasks)
    .filter((t) => !t.habitId && isOpenTask(t) && t.doOn && t.doOn >= from && t.doOn <= to)
    .sort((a, b) => a.doOn!.localeCompare(b.doOn!))

export function EventDialog({ event, onClose }: { event: Draft; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const tasks = useAppSelector((s) => s.grimoire.tasks)
  const [e, setE] = useState<Draft>(event)
  const [step, setStep] = useState<'dates' | 'deeds'>('dates')
  const [fate, setFate] = useState<Record<string, Fate>>({})
  const check = useAttempt()
  const set = (p: Partial<Draft>) => setE((x) => ({ ...x, ...p }))
  const ok = !!e.title.trim() && !!e.from && !!e.to && e.to >= e.from
  const inside = ok ? deedsIn(tasks, e.from, e.to) : []
  const save = () => {
    dispatch(A.upsertEvent({ event: { ...e, title: e.title.trim() }, fate }))
    const moved = Object.values(fate).filter((f) => f !== 'keep').length
    notify(e.id ? 'Событие сохранено' : 'Событие добавлено', 'success', moved ? `Дел передвинуто: ${moved}` : undefined)
    onClose()
  }
  const next = () =>
    check.attempt(ok, () => {
      if (!inside.length) return save()
      setFate(Object.fromEntries(inside.map((t) => [t.id, fate[t.id] ?? 'keep'])))
      setStep('deeds')
    })

  if (step === 'deeds')
    return (
      <Modal
        open
        onClose={onClose}
        title="Что с делами на эти дни?"
        size="lg"
        footer={
          <>
            <Button variant="ghost" mr="auto" onClick={() => setStep('dates')}>
              Назад
            </Button>
            <Button onClick={save}>Сохранить</Button>
          </>
        }
      >
        <Stack gap="3">
          <HStack gap="2" wrap="wrap">
            <Text fontSize="sm" color="fg.muted">
              Всем:
            </Text>
            {(Object.keys(fateLabel) as Fate[]).map((f) => (
              <Button key={f} size="xs" variant="outline" onClick={() => setFate(Object.fromEntries(inside.map((t) => [t.id, f])))}>
                {fateLabel[f]}
              </Button>
            ))}
          </HStack>
          {inside.map((t) => (
            <Flex key={t.id} gap="2" align="center" wrap="wrap" p="2" borderRadius="l2" borderWidth="1px" borderColor="border">
              <Box flex="1" minW="160px">
                <Text>{t.title}</Text>
                <Text fontSize="xs" color="fg.muted">
                  {humanDay(t.doOn!, e.from)}
                </Text>
              </Box>
              <Box w="170px">
                <Select size="sm" value={fate[t.id] ?? 'keep'} onChange={(v) => setFate({ ...fate, [t.id]: (v as Fate) || 'keep' })} options={(Object.keys(fateLabel) as Fate[]).map((f) => ({ value: f, label: fateLabel[f] }))} />
              </Box>
            </Flex>
          ))}
          <Text fontSize="xs" color="fg.subtle">
            Ритуалы этих дней пропускаются сами, серии не рвутся. «На день после» — {humanDay(addDays(e.to, 1), e.to)}.
          </Text>
        </Stack>
      </Modal>
    )

  return (
    <Modal
      open
      onClose={onClose}
      title={e.id ? e.title : 'Новое событие'}
      footer={
        <>
          {e.id && (
            <Button
              variant="ghost"
              colorPalette="red"
              mr="auto"
              onClick={async () => {
                if (await confirmAction('Удалить событие? Дела, которые уже передвинуты, останутся там, где они сейчас.')) {
                  dispatch(A.deleteEvent(e.id!))
                  onClose()
                }
              }}
            >
              Удалить
            </Button>
          )}
          <Button onClick={next}>{inside.length ? 'Дальше' : 'Сохранить'}</Button>
        </>
      }
    >
      <Stack gap="4">
        <Field label="Что это" invalid={check.missing(!e.title.trim())} error="Назови событие">
          <TextInput value={e.title} onChange={(title) => set({ title })} />
        </Field>
        <HStack gap="1" wrap="wrap">
          {sigils.map((x) => (
            <Box as="button" key={x} onClick={() => set({ sigil: e.sigil === x ? undefined : x })} fontSize="xl" w="9" h="9" borderRadius="l2" borderWidth="1px" borderColor={e.sigil === x ? 'ember.500' : 'border'} bg={e.sigil === x ? 'ember.subtle' : 'transparent'}>
              {x}
            </Box>
          ))}
        </HStack>
        <HStack gap="3" wrap="wrap" align="flex-start">
          <Field label="С" w="190px" invalid={check.missing(!e.from)} error="С какого дня?">
            <Input type="date" value={e.from} onChange={(ev) => set({ from: ev.target.value, ...(e.to && ev.target.value > e.to ? { to: ev.target.value } : {}) })} />
          </Field>
          <Field label="По" w="190px" invalid={check.missing(!e.to || e.to < e.from)} error="По какой день?">
            <Input type="date" value={e.to} min={e.from || undefined} onChange={(ev) => set({ to: ev.target.value })} />
          </Field>
        </HStack>
        <Field label="Заметка">
          <TextArea value={e.note ?? ''} onChange={(note) => set({ note: note || undefined })} rows={2} />
        </Field>
        {ok && (
          <Text fontSize="sm" color="fg.muted">
            {plural(daysBetween(e.from, e.to) + 1, 'день', 'дня', 'дней')}
            {inside.length ? ` · дел в эти дни: ${inside.length} — дальше решишь, что с ними` : ' · дел на эти дни нет'}
          </Text>
        )}
      </Stack>
    </Modal>
  )
}

/** The event going on today (or the nearest one ahead within 3 days). */
export function useCurrentEvent(today: string) {
  const events = useAppSelector((s) => s.grimoire.events)
  const list = Object.values(events).filter((e) => e.to >= today && e.from <= addDays(today, 3))
  return list.sort((a, b) => a.from.localeCompare(b.from))[0]
}

export function eventDayText(e: LifeEvent, today: string) {
  if (today < e.from) return `${humanDay(e.from, today)} начинается`
  return `день ${daysBetween(e.from, today) + 1} из ${daysBetween(e.from, e.to) + 1}`
}

export const blankEvent = (today: string): Draft => ({ title: '', from: today, to: addDays(today, 6) })

export default function Events() {
  const events = useAppSelector((s) => s.grimoire.events)
  const today = useToday()
  const [edit, setEdit] = useState<Draft>()
  const list = Object.values(events).sort((a, b) => b.from.localeCompare(a.from))
  const ahead = list.filter((e) => e.to >= today).reverse()
  const past = list.filter((e) => e.to < today)
  const row = (e: LifeEvent) => (
    <Flex key={e.id} as="button" onClick={() => setEdit(e)} textAlign="left" gap="3" align="center" p="3" borderRadius="l2" borderWidth="1px" borderColor="border" bg="bg.subtle" _hover={{ bg: 'bg.muted' }} w="full">
      <Text fontSize="2xl">{e.sigil ?? '🗓️'}</Text>
      <Box flex="1">
        <Text fontWeight="semibold">{e.title}</Text>
        <Text fontSize="sm" color="fg.muted">
          {e.from.slice(8)}.{e.from.slice(5, 7)} — {e.to.slice(8)}.{e.to.slice(5, 7)}.{e.to.slice(0, 4)}
          {e.from <= today && e.to >= today ? ` · ${eventDayText(e, today)}` : ''}
        </Text>
      </Box>
    </Flex>
  )
  return (
    <>
      <PageHeader title="События" />
      <Text fontSize="sm" color="fg.muted" mb="4">
        Поездка, больничный — то, что занимает несколько дней. Добавить — через плюсик внизу.
      </Text>
      <Section title="Сейчас и впереди">{ahead.length ? <Stack gap="2">{ahead.map(row)}</Stack> : <Empty>Ничего не запланировано.</Empty>}</Section>
      {past.length > 0 && (
        <Section title="Прошедшие">
          <Stack gap="2">{past.map(row)}</Stack>
        </Section>
      )}
      {edit && <EventDialog event={edit} onClose={() => setEdit(undefined)} />}
    </>
  )
}
