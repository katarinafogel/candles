// A deed as a card in the arcana manner, laid sideways so a day of them still fits on a phone.
// Its colour says what it is at a glance (cardTone): swamp frog, nacre joy, wine for the hardest,
// silver for the needed. Leaf — done; tap — the card; swipe right — done, swipe left — to the backlog.
// The face shows what helps to choose; postponements and dread stay inside the deed.
import { Box, Flex, HStack, Text } from '@chakra-ui/react'
import { useRef, useState } from 'react'
import { LuFlame, LuHourglass, LuLink, LuMoon, LuSparkles, LuSun } from 'react-icons/lu'
import { complete, reopen, toBacklog } from '../../grimoire/act'
import { isFrog, taskCoins } from '../../grimoire/coins'
import { cardTone, isBlocked, stepsOf } from '../../grimoire/selectors'
import type { DayKey, Task } from '../../grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { palettes, solidOf } from '../ArcanaCard'
import { Sparkle } from '../Magic'
import { LeafMark } from '../ui'
import { Deadline, FrogIcon, Stars, Tag } from './Marks'

const sourceIcon = { habit: <LuMoon />, wheel: <LuSun />, workshop: <LuFlame /> } as Record<string, JSX.Element>

/** `inBook`: on a book's page a sideways swipe turns the page, and the book's own sigil is not repeated. */
export function TaskCard({ t, today, onOpen, compact, inBook }: { t: Task; today: DayKey; onOpen: (t: Task) => void; compact?: boolean; inBook?: boolean }) {
  const dispatch = useAppDispatch()
  const g = useAppSelector((s) => s.grimoire)
  const people = useAppSelector((s) => s.data.people)
  const tone = cardTone(t)
  const p = palettes[tone]
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
  const [flash, setFlash] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)

  function tick() {
    if (done) return reopen(t)
    setFlash(true)
    setTimeout(() => setFlash(false), 650)
    complete(t)
  }

  return (
    <Box position="relative" borderRadius="10px" overflow="hidden" h="100%">
      {/* What the swipe will do, revealed under the card. */}
      {dx !== 0 && (
        <Flex position="absolute" inset="0" align="center" justify={dx > 0 ? 'flex-start' : 'flex-end'} px="4" bg={dx > 0 ? 'ember.subtle' : 'bg.muted'} color={dx > 0 ? 'ember.200' : 'fg.muted'} fontSize="sm">
          {dx > 0 ? (done ? 'вернуть' : 'сделано') : 'в бэклог'}
        </Flex>
      )}
      <Box
        position="relative"
        h="100%"
        borderRadius="10px"
        background={p.bg}
        color={p.fg}
        opacity={done ? 0.6 : 1}
        cursor="pointer"
        transform={`translateX(${dx}px)`}
        transition={dx ? undefined : 'transform .2s, box-shadow .3s, filter .4s'}
        filter={flash ? 'brightness(1.25)' : undefined}
        boxShadow={eating ? `0 0 0 2px ${p.star}, 0 0 22px -4px ${p.glow}` : '0 8px 22px -14px rgba(0,0,0,.8), inset 0 0 0 1px rgba(255,255,255,.06)'}
        css={{
          '--card-fg': p.fg,
          '--card-line': p.line,
          '--card-solid': solidOf[tone],
          '--leaf-on': p.star,
          '--leaf-off': p.leafOff,
          '--leaf-glow': p.glow,
          '--star-on': p.star,
          '--chakra-colors-fg': p.fg,
          '--chakra-colors-fg-muted': p.muted,
          '--chakra-colors-fg-subtle': p.subtle,
          '--chakra-colors-border': p.line,
        }}
        onClick={() => onOpen(t)}
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
        {/* The arcana frame: two lines and stars in the corners. */}
        <Box position="absolute" inset="5px" borderWidth="1px" borderColor={p.line} borderRadius="6px" pointerEvents="none" />
        <Box position="absolute" inset="8px" borderWidth="1px" borderColor={p.line} borderRadius="4px" opacity=".45" pointerEvents="none" />
        <Box position="absolute" top="11px" right="11px" color={p.star} pointerEvents="none" opacity=".9">
          {frog ? <FrogIcon size={compact ? 16 : 20} /> : <Sparkle size={8} />}
        </Box>
        <Box position="absolute" bottom="11px" right="11px" color={p.star} pointerEvents="none" opacity=".6">
          <Sparkle size={6} />
        </Box>

        <Flex position="relative" align="flex-start" gap="3" pl="4" pr="9" py={compact ? '3' : '3.5'} minH={compact ? undefined : '84px'}>
          <Box
            as="button"
            aria-label={done ? 'Вернуть' : 'Сделано'}
            mt="0.5"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              tick()
            }}
          >
            <LeafMark on={done} />
          </Box>
          <Box flex="1" minW="0">
            <HStack gap="1.5" align="center">
              {t.slot === 'main' && !done && (
                <Box color={p.star} title="главное" flexShrink={0}>
                  <Sparkle size={11} />
                </Box>
              )}
              {project && (
                <Text as="span" fontSize="sm" title={project.title} flexShrink={0}>
                  {project.sigil || '🌿'}
                </Text>
              )}
              <Text
                fontFamily="heading"
                fontSize={compact ? 'md' : 'lg'}
                fontWeight="semibold"
                lineHeight="1.2"
                color={blocked ? p.muted : p.fg}
                textDecoration={done ? 'line-through' : undefined}
                lineClamp={2}
                wordBreak="break-word"
              >
                {t.title}
              </Text>
            </HStack>
            <HStack gap="2" mt="1" wrap="wrap" color={p.subtle} fontSize="xs">
              <Stars n={t.stars} size={10} />
              {t.type === 'joy' && (
                <Box color={p.accent} display="inline-flex" title="радость">
                  <LuSparkles />
                </Box>
              )}
              {sourceIcon[t.source] && <Box display="inline-flex">{sourceIcon[t.source]}</Box>}
              {!done && <Deadline dueAt={t.dueAt} today={today} />}
              {coins > 0 && (
                <HStack as="span" gap="0.5" color={p.star} title="награда">
                  <Sparkle size={8} />
                  <Text as="span">{coins}</Text>
                </HStack>
              )}
              {eating && <Text as="span" color={p.star}>съесть сегодня</Text>}
              {frog && !done && !eating && t.doOn === today && (
                <Box
                  as="button"
                  fontSize="2xs"
                  px="1.5"
                  borderWidth="1px"
                  borderColor={p.line}
                  borderRadius="full"
                  color={p.fg}
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation()
                    dispatch(A.eatFrog({ id: t.id, day: today }))
                  }}
                >
                  съесть сегодня
                </Box>
              )}
              {t.status === 'partial' && <Text as="span">часть сделана{t.partialNote ? `: ${t.partialNote}` : ''}</Text>}
              {t.status === 'inProgress' && <Text as="span">в работе</Text>}
              {t.status === 'waiting' && (
                <HStack gap="1">
                  <LuHourglass />
                  <Text as="span">ждёт{t.waitUntil ? ` до ${t.waitUntil.slice(8, 10)}.${t.waitUntil.slice(5, 7)}` : ''}</Text>
                </HStack>
              )}
              {blocker && (
                <HStack gap="1">
                  <LuLink />
                  <Text as="span" lineClamp={1}>
                    ждёт: {blocker.title}
                  </Text>
                </HStack>
              )}
              {(t.personIds ?? []).map((id) => people[id] && <Text as="span" key={id}>@{people[id].name}</Text>)}
              {!compact && t.tags.map((x) => <Tag key={x} name={x} />)}
            </HStack>
            {steps.length > 0 && (
              <HStack gap="2" mt="2" fontSize="2xs" color={p.subtle}>
                <Box flex="1" h="3px" borderRadius="full" bg={p.hover} overflow="hidden">
                  <Box h="100%" w={`${(stepsDone / steps.length) * 100}%`} bg={p.star} borderRadius="full" transition="width .3s" />
                </Box>
                <Text as="span">
                  {stepsDone}/{steps.length}
                </Text>
              </HStack>
            )}
          </Box>
        </Flex>
      </Box>
    </Box>
  )
}
