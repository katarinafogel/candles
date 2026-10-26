// A deed as a tall arcana card, like the workshop's: its colour says what it is at a glance (cardTone):
// swamp frog, nacre joy, wine for the hardest, silver for the needed. Leaf in the corner — done; tap — the
// deed; swipe right — done, swipe left — to the backlog. Every card is the same 5:8 (at most three tags
// on it); postponements and dread stay inside the deed, «съесть сегодня» is set there too.
import { Box, Flex, HStack, Text } from '@chakra-ui/react'
import { useRef, useState } from 'react'
import { LuFlame, LuHourglass, LuLink, LuMoon, LuSparkles, LuSun } from 'react-icons/lu'
import { complete, reopen, toBacklog } from '../../grimoire/act'
import { isFrog, taskCoins } from '../../grimoire/coins'
import { cardTone, isBlocked, stepsOf } from '../../grimoire/selectors'
import type { DayKey, Task } from '../../grimoire/types'
import { useAppSelector } from '../../store'
import { ArcanaCard } from '../ArcanaCard'
import { Sparkle } from '../Magic'
import { LeafMark } from '../ui'
import { Deadline, Stars, Tag } from './Marks'

/**
 * Card grid: two columns on a phone; wider, as many as fit at about the tablet size, so on a big
 * screen the cards stay small instead of stretching.
 */
export const cardColumns = { base: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(auto-fill, minmax(140px, 1fr))', lg: 'repeat(auto-fill, minmax(150px, 1fr))' }

const sourceIcon = { habit: <LuMoon />, wheel: <LuSun />, workshop: <LuFlame /> } as Record<string, JSX.Element>

/** `inBook`: on a book's page a sideways swipe turns the page, and the book's own sigil is not repeated. */
export function TaskCard({ t, today, onOpen, compact, inBook }: { t: Task; today: DayKey; onOpen: (t: Task) => void; compact?: boolean; inBook?: boolean }) {
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
  const coins = done ? 0 : taskCoins(t, today, g.meta.coins).total
  const [dx, setDx] = useState(0)
  const start = useRef<{ x: number; y: number } | null>(null)

  function tick() {
    if (done) return reopen(t)
    complete(t)
  }

  return (
    <Box
      position="relative"
      h="100%"
      transform={`translateX(${dx}px)`}
      transition={dx ? undefined : 'transform .2s'}
      onTouchStart={(e) => (start.current = inBook ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY })}
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
        else if (d < -80 && t.doOn && !done) toBacklog([t.id])
      }}
    >
      {/* What the swipe will do, said over the card. */}
      {Math.abs(dx) > 30 && (
        <Flex position="absolute" inset="0" zIndex="1" align="center" justify="center" pointerEvents="none" borderRadius="10px" bg="rgba(0,0,0,.45)" color="ember.100" fontSize="sm">
          {dx > 0 ? (done ? 'вернуть' : 'сделано') : 'в бэклог'}
        </Flex>
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
        corner={
          coins > 0 ? (
            <HStack gap="0.5" title="награда">
              <Sparkle size={8} />
              <Text as="span">{coins}</Text>
            </HStack>
          ) : undefined
        }
        title={
          <>
            {t.slot === 'main' && !done && (
              <Box as="span" display="inline-block" mr="1" verticalAlign="middle" color="var(--star-on)" title="главное">
                <Sparkle size={11} />
              </Box>
            )}
            {project && (
              <Box as="span" mr="1" title={project.title}>
                {project.sigil || '🌿'}
              </Box>
            )}
            <Box as="span" textDecoration={done ? 'line-through' : undefined}>
              {t.title}
            </Box>
          </>
        }
        fixed
      >
        <HStack gap="1.5" justify="center" wrap="wrap">
          <Stars n={t.stars} size={11} />
          {t.type === 'joy' && (
            <Box display="inline-flex" title="радость">
              <LuSparkles />
            </Box>
          )}
          {sourceIcon[t.source] && <Box display="inline-flex">{sourceIcon[t.source]}</Box>}
        </HStack>
        {!done && t.dueAt && (
          <Text>
            <Deadline dueAt={t.dueAt} today={today} />
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
          <HStack gap="2" mt="1.5" fontSize="2xs">
            <Box flex="1" h="3px" borderRadius="full" bg="var(--card-hover)" overflow="hidden">
              <Box h="100%" w={`${(stepsDone / steps.length) * 100}%`} bg="var(--star-on)" borderRadius="full" transition="width .3s" />
            </Box>
            <Text as="span">
              {stepsDone}/{steps.length}
            </Text>
          </HStack>
        )}
      </ArcanaCard>
    </Box>
  )
}
