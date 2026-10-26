// A deed as a list row (deeds are many, so they are rows, not arcana cards).
// Leaf — done; tap — the card; swipe right — done, swipe left — back to the backlog.
import { Badge, Box, Flex, HStack, Text } from '@chakra-ui/react'
import { useRef, useState } from 'react'
import { LuFlame, LuHourglass, LuLink, LuMoon, LuSparkles, LuSun } from 'react-icons/lu'
import { complete, reopen, toBacklog } from '../../grimoire/act'
import { isBlocked, isStuck } from '../../grimoire/selectors'
import type { DayKey, Task } from '../../grimoire/types'
import { useAppSelector } from '../../store'
import { Sparkle } from '../Magic'
import { LeafMark } from '../ui'
import { Deadline, Dread, Stars, Tag } from './Marks'

const sourceIcon = { habit: <LuMoon />, wheel: <LuSun />, workshop: <LuFlame /> } as Record<string, JSX.Element>

export function TaskRow({ t, today, onOpen, compact }: { t: Task; today: DayKey; onOpen: (t: Task) => void; compact?: boolean }) {
  const tasks = useAppSelector((s) => s.grimoire.tasks)
  const people = useAppSelector((s) => s.data.people)
  const done = t.status === 'done'
  const blocked = isBlocked(t, tasks)
  const blocker = blocked ? (t.blockedBy ?? []).map((id) => tasks[id]).find((x) => x && x.status !== 'done' && x.status !== 'cancelled') : undefined
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
    <Box position="relative" overflow="hidden" borderRadius="l2">
      {/* What the swipe will do, revealed under the row. */}
      {dx !== 0 && (
        <Flex position="absolute" inset="0" align="center" justify={dx > 0 ? 'flex-start' : 'flex-end'} px="4" bg={dx > 0 ? 'ember.subtle' : 'bg.muted'} color={dx > 0 ? 'ember.200' : 'fg.muted'} fontSize="sm">
          {dx > 0 ? (done ? 'вернуть' : 'сделано') : 'в бэклог'}
        </Flex>
      )}
      <Flex
        align="flex-start"
        gap="3"
        px="2"
        py={compact ? '1.5' : '2'}
        bg={flash ? 'ember.muted' : 'bg.subtle'}
        transition={dx ? undefined : 'transform .2s, background-color .4s'}
        transform={`translateX(${dx}px)`}
        cursor="pointer"
        onClick={() => onOpen(t)}
        onTouchStart={(e) => (start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
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
          <HStack gap="2" align="center">
            {t.slot === 'main' && !done && (
              <Box color="ember.300" title="главное" flexShrink={0}>
                <Sparkle size={11} />
              </Box>
            )}
            <Text
              fontSize="sm"
              color={done ? 'fg.subtle' : blocked ? 'fg.muted' : 'fg'}
              textDecoration={done ? 'line-through' : undefined}
              lineClamp={2}
              fontWeight={t.slot === 'main' && !done ? 'semibold' : 'normal'}
            >
              {t.title}
            </Text>
          </HStack>
          <HStack gap="2" mt="0.5" wrap="wrap" color="fg.subtle" fontSize="xs">
            <Stars n={t.stars} size={10} />
            <Dread n={t.dread} size={10} />
            {t.type === 'joy' && (
              <Box color="ember.300" display="inline-flex" title="радость">
                <LuSparkles />
              </Box>
            )}
            {sourceIcon[t.source] && <Box display="inline-flex">{sourceIcon[t.source]}</Box>}
            {!done && <Deadline dueAt={t.dueAt} today={today} />}
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
            {isStuck(t) && (
              <Badge size="xs" colorPalette="orange" variant="subtle">
                буксует
              </Badge>
            )}
            {(t.personIds ?? []).map((id) => people[id] && <Text as="span" key={id}>@{people[id].name}</Text>)}
            {!compact && t.tags.map((x) => <Tag key={x} name={x} />)}
          </HStack>
        </Box>
      </Flex>
    </Box>
  )
}
