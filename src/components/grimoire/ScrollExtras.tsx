// Small blocks of the day scroll: the long event going on, the card of the day (with «сбылось?» once
// the evening comes), the note to come back to, and around Yule — the year's goals.
import { Box, Button, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { addDays, daysBetween } from '@grimoire-core/grimoire/days'
import { cardName } from '@grimoire-core/grimoire/tarot'
import type { TarotReading } from '@grimoire-core/grimoire/types'
import { sabbatDays } from '@grimoire-core/grimoire/wheel'
import { EventDialog, eventDayText, useCurrentEvent } from '../../pages/grimoire/Events'
import { NoteDialog, useNoteOfDay } from '../../pages/grimoire/Notes'
import { blankDay, ReadingDialog } from '../../pages/grimoire/Tarot'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '@grimoire-core/store/grimoireSlice'
import { Panel } from '@shared/components/ui'

function EventBanner({ today }: { today: string }) {
  const e = useCurrentEvent(today)
  const [open, setOpen] = useState(false)
  if (!e) return null
  return (
    <Panel display="flex" alignItems="center" gap="3" mb="3" flexWrap="wrap">
      <Text fontSize="2xl">{e.sigil ?? '🗓️'}</Text>
      <Box flex="1" minW="160px">
        <Text fontWeight="semibold">{e.title}</Text>
        <Text fontSize="sm" color="fg.muted">
          {eventDayText(e, today)}
          {e.from <= today ? ' · ритуалы на паузе, серии не рвутся' : ''}
        </Text>
      </Box>
      <Button size="xs" variant="ghost" onClick={() => setOpen(true)}>
        Изменить
      </Button>
      {open && <EventDialog event={e} onClose={() => setOpen(false)} />}
    </Panel>
  )
}

function CardOfDay({ today }: { today: string }) {
  const tarot = useAppSelector((s) => s.grimoire.tarot)
  const eveningAt = useAppSelector((s) => s.grimoire.meta.eveningAt)
  const dispatch = useAppDispatch()
  const [edit, setEdit] = useState<TarotReading | ReturnType<typeof blankDay>>()
  const card = Object.values(tarot).find((r) => r.type === 'day' && r.day === today)
  const now = new Date()
  const evening = !!eveningAt && `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` >= eveningAt
  return (
    <Panel>
      <Text fontFamily="heading" fontSize="lg" color="ember.100" mb="1">
        Карта дня
      </Text>
      {card ? (
        <Stack gap="1">
          <Text as="button" textAlign="left" fontWeight="semibold" onClick={() => setEdit(card)}>
            {card.cards.map((c) => `${cardName(c.card)}${c.reversed ? ' (перевёрнутая)' : ''}`).join(' · ')}
          </Text>
          {card.meaning && (
            <Text fontSize="sm" color="fg.muted" lineClamp={3}>
              {card.meaning}
            </Text>
          )}
          {evening && !card.came && (
            <HStack gap="1.5" wrap="wrap" mt="1">
              <Text fontSize="sm">Сбылось?</Text>
              {(['yes', 'partly', 'no'] as const).map((k) => (
                <Button key={k} size="2xs" variant="outline" onClick={() => dispatch(A.upsertTarot({ reading: { ...card, came: k } }))}>
                  {{ yes: 'да', partly: 'отчасти', no: 'нет' }[k]}
                </Button>
              ))}
            </HStack>
          )}
        </Stack>
      ) : (
        <Stack gap="1.5" align="flex-start">
          <Text fontSize="sm" color="fg.subtle">
            Вытяни карту из колоды и запиши, что она обещает.
          </Text>
          <Button size="xs" variant="outline" onClick={() => setEdit(blankDay(today))}>
            Записать карту
          </Button>
        </Stack>
      )}
      {edit && <ReadingDialog reading={edit} onClose={() => setEdit(undefined)} />}
    </Panel>
  )
}

function NoteOfDay({ today }: { today: string }) {
  const note = useNoteOfDay(today)
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)
  if (!note) return null
  return (
    <Panel>
      <Text fontFamily="heading" fontSize="lg" color="ember.100" mb="1">
        Вспомнить
      </Text>
      <Text fontFamily="hand" fontSize="md" whiteSpace="pre-wrap" lineClamp={6} cursor="pointer" onClick={() => setOpen(true)}>
        {note.text}
      </Text>
      {note.source && (
        <Text fontSize="xs" color="fg.muted">
          — {note.source}
        </Text>
      )}
      <HStack gap="2" mt="2">
        <Button size="xs" variant="outline" onClick={() => dispatch(A.reviewNote({ id: note.id, remember: true }))}>
          Помню
        </Button>
        <Button size="xs" variant="ghost" onClick={() => dispatch(A.reviewNote({ id: note.id, remember: false }))}>
          Ещё повторить
        </Button>
      </HStack>
      {open && <NoteDialog note={note} onClose={() => setOpen(false)} />}
    </Panel>
  )
}

/** From a week before Yule to the year's end: sum up this year's goals and set the next one's. */
function YuleGoals({ today }: { today: string }) {
  const goals = useAppSelector((s) => s.grimoire.goals)
  const year = Number(today.slice(0, 4))
  // Goals follow the calendar year: the December solstice, wherever she lives.
  const yule = sabbatDays(year, 'north').yule
  const from = addDays(yule, -7)
  if (today < from || today.slice(5) > '12-31') return null
  const next = Object.values(goals).filter((x) => x.year === year + 1).length
  const mine = Object.values(goals).filter((x) => x.year === year)
  const done = mine.filter((x) => x.status === 'done').length
  const left = daysBetween(today, yule)
  return (
    <Panel display="flex" alignItems="center" gap="3" mb="3" flexWrap="wrap">
      <Text fontSize="2xl">🕯</Text>
      <Box flex="1" minW="200px">
        <Text fontWeight="semibold">{left > 0 ? `До Йоля ${left} дн.` : 'Время Йоля'}: подвести итоги года</Text>
        <Text fontSize="sm" color="fg.muted">
          {mine.length ? `Целей ${year}: достигнуто ${done} из ${mine.length}. ` : ''}
          {next ? `На ${year + 1} уже ${next}.` : `Целей на ${year + 1} пока нет.`}
        </Text>
      </Box>
      <Button asChild size="xs" variant="outline">
        <RouterLink to="/g/goals">К целям</RouterLink>
      </Button>
    </Panel>
  )
}

export function ScrollTop({ today }: { today: string }) {
  return (
    <>
      <EventBanner today={today} />
      <YuleGoals today={today} />
    </>
  )
}

export function ScrollSide({ today }: { today: string }) {
  const note = useNoteOfDay(today)
  return (
    <Box display="grid" gridTemplateColumns={{ base: '1fr', md: note ? '1fr 1fr' : '1fr' }} gap="3" mb="4">
      <CardOfDay today={today} />
      <NoteOfDay today={today} />
    </Box>
  )
}
