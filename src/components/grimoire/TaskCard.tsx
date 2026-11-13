// A deed as a tall arcana card, like the workshop's: its colour says what it is at a glance (cardTone):
// swamp frog, nacre joy, wine for the hardest, silver for the needed. Leaf in the corner — done; tap — the
// deed; swipe right — done, swipe left — deleted (with «Вернуть» in the toast). Every card is the same 5:8 (at most three tags
// on it); postponements and dread stay inside the deed, «съесть сегодня» is set there too.
import { Box, Flex, HStack, Text } from '@chakra-ui/react'
import { useRef, useState } from 'react'
import { LuCalendarClock, LuCheck, LuFlame, LuHourglass, LuLink, LuMoon, LuSparkles, LuSun } from 'react-icons/lu'
import { complete, remove, reopen } from '../../grimoire/act'
import { isFrog } from '../../grimoire/frog'
import { dueDay } from '../../grimoire/days'
import { cardTone, isBlocked, priorityOf, stepsOf } from '../../grimoire/selectors'
import type { DayKey, Task } from '../../grimoire/types'
import { useAppSelector } from '../../store'
import { ArcanaCard } from '../ArcanaCard'
import { Sparkle } from '../Magic'
import { LeafMark, ProgressLine } from '../ui'
import { HoverTrash } from './HoverTrash'
import { Deadline, PriorityIcon, Stars, Tag } from './Marks'

/**
 * Card grid: two columns on a phone; wider, as many as fit at about the tablet size, so on a big
 * screen the cards stay small instead of stretching.
 */
export const cardColumns = { base: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(auto-fill, minmax(140px, 1fr))', lg: 'repeat(auto-fill, minmax(150px, 1fr))' }

const sourceIcon = { habit: <LuMoon />, wheel: <LuSun />, workshop: <LuFlame /> } as Record<string, JSX.Element>

/** `inBook`: on a book's page a sideways swipe turns the page, and the book's own sigil is not repeated. */
/** `pick`: the «Выбрать» mode — a tap marks the card instead of opening it (Shift — the whole run). */
export function TaskCard({
  t,
  today,
  onOpen,
  compact,
  inBook,
  pick,
}: {
  t: Task
  today: DayKey
  onOpen: (t: Task) => void
  compact?: boolean
  inBook?: boolean
  pick?: { on: boolean; toggle: (t: Task, range: boolean) => void }
}) {
  const g = useAppSelector((s) => s.grimoire)
  const people = useAppSelector((s) => s.data.people)
  const tone = cardTone(t)
  const done = t.status === 'done'
  const frog = isFrog(t)
  const eating = frog && t.eatOn === today && !done
  const blocked = isBlocked(t, g.tasks)
  const blocker = blocked ? (t.blockedBy ?? []).map((id) => g.tasks[id]).find((x) => x && x.status !== 'done' && x.status !== 'cancelled') : undefined
  const steps = stepsOf(g, t.id).filter((s) => s.status !== 'cancelled')
  const stepsDone = steps.filter((s) => s.status === 'done').length
  const project = t.projectId && !inBook ? g.projects[t.projectId] : undefined
  const [dx, setDx] = useState(0)
  const start = useRef<{ x: number; y: number } | null>(null)

  function tick() {
    if (done) return reopen(t)
    complete(t)
  }

  return (
    <Box
      position="relative"
      className="group"
      h="100%"
      // Done: not crossed out, just paler (on top of the card's own dim).
      opacity={done ? 0.7 : 1}
      filter={done ? 'saturate(.55)' : undefined}
      transform={`translateX(${dx}px)`}
      transition={dx ? undefined : 'transform .2s'}
      // While dragged the card rides over its neighbours, or the next one hides it and the hint on it.
      zIndex={dx ? 2 : undefined}
      onTouchStart={(e) => (start.current = inBook || pick ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchMove={(e) => {
        if (!start.current) return
        const mx = e.touches[0].clientX - start.current.x
        const my = e.touches[0].clientY - start.current.y
        if (Math.abs(my) > Math.abs(mx) && Math.abs(dx) < 10) {
          start.current = null
          return setDx(0)
        }
        setDx(Math.max(-120, Math.min(120, mx)))
      }}
      onTouchEnd={() => {
        const d = dx
        start.current = null
        setDx(0)
        if (d > 80) tick()
        else if (d < -100) remove(t)
      }}
    >
      {/* What the swipe will do, said over the card. */}
      {Math.abs(dx) > 30 && (
        <Flex
          position="absolute"
          inset="0"
          zIndex="1"
          align="center"
          justify="center"
          pointerEvents="none"
          borderRadius="10px"
          bg={dx < 0 ? `color-mix(in srgb, var(--chakra-colors-red-500) ${dx < -100 ? 55 : 30}%, var(--chakra-colors-bg-veil))` : 'bg.veil'}
          color={dx < 0 ? 'white' : 'ember.100'}
          fontSize="sm"
          fontWeight={dx < -100 ? 'semibold' : undefined}
          transition="background .15s"
        >
          {dx > 0 ? (done ? 'вернуть' : 'сделано') : 'удалить'}
        </Flex>
      )}
      {!pick && <HoverTrash label="Удалить дело" onClick={() => remove(t)} />}
      {pick && (
        <Box
          position="absolute"
          inset="0"
          zIndex="2"
          cursor="pointer"
          borderRadius="10px"
          borderWidth="2px"
          borderColor={pick.on ? 'ember.400' : 'transparent'}
          bg={pick.on ? 'color-mix(in srgb, var(--chakra-colors-ember-400) 14%, transparent)' : undefined}
          onClick={(e) => pick.toggle(t, e.shiftKey)}
          role="checkbox"
          aria-checked={pick.on}
          aria-label={t.title}
        >
          <Flex position="absolute" top="2" left="2" w="5" h="5" align="center" justify="center" borderRadius="md" borderWidth="2px" borderColor={pick.on ? 'ember.400' : 'fg.muted'} bg={pick.on ? 'ember.400' : 'bg.panel'} color="bg" fontSize="xs">
            {pick.on && <LuCheck />}
          </Flex>
        </Box>
      )}
      <ArcanaCard
        tone={tone}
        dim={done}
        selected={eating}
        onClick={() => onOpen(t)}
        select={
          <Box as="button" aria-label={done ? 'Вернуть' : 'Сделано'} onClick={tick} display="inline-flex">
            <LeafMark on={done} />
          </Box>
        }
        title={
          <>
            {project && (
              <Box as="span" mr="1" title={project.title}>
                {project.sigil || '🌿'}
              </Box>
            )}
            <Box as="span">{t.title}</Box>
          </>
        }
        fixed
      >
        <HStack gap="1.5" justify="center" wrap="wrap">
          {/* «Нормальный» is the default and goes unmarked, so the card stays quiet. */}
          {priorityOf(t) !== 'medium' && <PriorityIcon p={priorityOf(t)} size={13} />}
          <Stars n={t.stars} size={11} />
          {t.type === 'joy' && (
            <Box display="inline-flex" title="радость">
              <LuSparkles />
            </Box>
          )}
          {sourceIcon[t.source] && <Box display="inline-flex">{sourceIcon[t.source]}</Box>}
        </HStack>
        {!done && t.dueAt && (
          // The real deadline as a pill, so it is seen at a glance; due today or past — in the star colour.
          <HStack
            alignSelf="center"
            gap="1"
            px="2"
            py="0.5"
            mt="0.5"
            borderRadius="full"
            fontSize="2xs"
            lineHeight="1.2"
            title="сделать до"
            bg={`color-mix(in srgb, ${dueDay(t.dueAt)! <= today ? 'var(--star-on) 28%' : 'var(--card-fg) 14%'}, var(--card-solid))`}
          >
            <LuCalendarClock />
            <Deadline dueAt={t.dueAt} today={today} size="2xs" />
          </HStack>
        )}
        {t.doAt && t.doOn && !done && <Text>в {t.doAt}</Text>}
        {!!t.checklist?.length && (
          <Text>
            ☑ {t.checklist.filter((x) => x.done).length}/{t.checklist.length}
          </Text>
        )}
        {eating && <Text color="var(--star-on)">съесть сегодня</Text>}
        {t.status === 'partial' && <Text lineClamp={1}>часть сделана{t.partialNote ? `: ${t.partialNote}` : ''}</Text>}
        {t.status === 'inProgress' && <Text>в работе</Text>}
        {t.status === 'waiting' && (
          <HStack gap="1" justify="center">
            <LuHourglass />
            <Text as="span">ждёт{t.waitUntil ? ` до ${t.waitUntil.slice(8, 10)}.${t.waitUntil.slice(5, 7)}` : ''}</Text>
          </HStack>
        )}
        {blocker && (
          <HStack gap="1" justify="center">
            <LuLink />
            <Text as="span" lineClamp={1}>
              ждёт: {blocker.title}
            </Text>
          </HStack>
        )}
        {(t.personIds ?? []).length > 0 && <Text lineClamp={1}>{(t.personIds ?? []).map((id) => people[id] && `@${people[id].name}`).filter(Boolean).join(' ')}</Text>}
        {!compact && t.tags.length > 0 && (
          <HStack gap="1" justify="center" wrap="wrap" mt="1">
            {t.tags.slice(0, 3).map((x) => (
              <Tag key={x} name={x} />
            ))}
            {t.tags.length > 3 && <Text as="span" fontSize="2xs">+{t.tags.length - 3}</Text>}
          </HStack>
        )}
        {steps.length > 0 && (
          <Box mt="1.5">
            <ProgressLine done={stepsDone} all={steps.length} h="3px" bg="var(--card-hover)" fill="var(--star-on)" fontSize="2xs" />
          </Box>
        )}
      </ArcanaCard>
    </Box>
  )
}
