// The calendar: a year of months, each a landscape card in its sabbat's colours (a month that crosses a
// sabbat fades from one colour into the next), every day with its Moon. Sabbats and esbats are marked;
// tap a day for its phase, holiday and deeds.
import { Box, Button, Flex, Grid, HStack, IconButton, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu'
import { Link as RouterLink } from 'react-router-dom'
import { ArcanaFrame, type Palette } from '../../components/ArcanaCard'
import { useTaskDialog } from '../../components/grimoire/TaskDialog'
import { MoonIcon } from '../../components/grimoire/MoonIcon'
import { Stars } from '../../components/grimoire/Marks'
import { Modal, PageHeader } from '../../components/ui'
import { useToday } from '../../grimoire/act'
import { addDays, days, daysBetween, plainDay, weekday } from '../../grimoire/days'
import type { DayKey, Sabbat } from '../../grimoire/types'
import { isFullMoon, moonPhase, moonPhaseNames, sabbatDays, sabbats, wheelNow } from '../../grimoire/wheel'
import { useAppSelector } from '../../store'

const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const weekdays = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

const key = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
/** A sabbat colour sunk into the night, so light text reads on it. */
const deep = (c: string, share = 52) => `color-mix(in srgb, ${c} ${share}%, #16120e)`

const palette: Palette = {
  bg: '',
  fg: '#f6efe4',
  muted: 'rgba(246, 239, 228, .78)',
  subtle: 'rgba(246, 239, 228, .58)',
  line: 'rgba(246, 230, 200, .45)',
  accent: '#f1d9a8',
  star: '#f4e4c1',
  hover: 'rgba(246, 230, 200, .12)',
  leafOff: 'rgba(246, 230, 200, .5)',
  glow: 'rgba(244, 228, 193, .5)',
  ink: 'rgba(246, 230, 200, .6)',
}

interface MonthInfo {
  year: number
  month: number
  first: DayKey
  length: number
  /** The segment's sabbat on the 1st and on the last day, and the sabbat that falls inside, if any. */
  from: Sabbat
  to: Sabbat
  turn?: { sabbat: Sabbat; day: number }
}

function monthInfo(year: number, month: number, hemisphere: 'north' | 'south', holidays: Record<DayKey, Sabbat>): MonthInfo {
  const first = key(year, month, 1)
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const last = addDays(first, length - 1)
  let turn: MonthInfo['turn']
  for (let d = 1; d <= length; d++) {
    const s = holidays[key(year, month, d)]
    if (s) turn = { sabbat: s, day: d }
  }
  return { year, month, first, length, from: wheelNow(first, hemisphere).current.sabbat, to: wheelNow(last, hemisphere).current.sabbat, turn }
}

/** One colour, or the first fading into the next around the sabbat's day. */
function monthBg(m: MonthInfo) {
  const a = deep(sabbats[m.from].color)
  const glow = 'radial-gradient(120% 80% at 0% 0%, rgba(255,240,215,.10), transparent 60%)'
  if (m.from === m.to) return `${glow}, linear-gradient(165deg, ${a} 0%, ${deep(sabbats[m.from].color, 40)} 100%)`
  const b = deep(sabbats[m.to].color)
  const at = Math.round(((m.turn?.day ?? m.length / 2) / m.length) * 100)
  return `${glow}, linear-gradient(100deg, ${a} 0%, ${a} ${Math.max(0, at - 18)}%, ${b} ${Math.min(100, at + 18)}%, ${b} 100%)`
}

function MonthCard({ m, today, holidays, busy, onDay, refFor }: { m: MonthInfo; today: DayKey; holidays: Record<DayKey, Sabbat>; busy: Set<DayKey>; onDay: (d: DayKey) => void; refFor?: (el: HTMLDivElement | null) => void }) {
  const pad = weekday(m.first) - 1
  const cells = [...Array.from({ length: pad }, () => undefined), ...Array.from({ length: m.length }, (_, i) => addDays(m.first, i))]
  const fullMoons = cells.filter((d): d is DayKey => !!d && isFullMoon(d))
  const p = palette
  return (
    <Box
      ref={refFor}
      position="relative"
      borderRadius="10px"
      background={monthBg(m)}
      color={p.fg}
      boxShadow="0 10px 28px -14px rgba(0,0,0,.75), inset 0 0 0 1px rgba(255,255,255,.06)"
      scrollMarginTop="16px"
      css={{ '--card-solid': deep(sabbats[m.from].color), '--chakra-colors-fg': p.fg, '--chakra-colors-fg-muted': p.muted, '--chakra-colors-fg-subtle': p.subtle }}
    >
      <ArcanaFrame p={p} />
      <Flex position="relative" direction={{ base: 'column', md: 'row' }} gap={{ base: '3', md: '5' }} px={{ base: '5', md: '7' }} py={{ base: '6', md: '7' }}>
        {/* The month's own column: its name and the holidays in it. */}
        <Stack gap="1.5" w={{ md: '30%' }} flexShrink={0} align={{ base: 'center', md: 'flex-start' }} textAlign={{ base: 'center', md: 'left' }} pt={{ md: '2' }}>
          <Text fontFamily="heading" fontWeight="semibold" fontSize={{ base: '2xl', md: '3xl' }} lineHeight="1.05">
            {monthNames[m.month - 1]}
          </Text>
          <Text fontSize="xs" color={p.subtle} letterSpacing=".08em">
            {m.year}
          </Text>
          <Text fontSize="sm" color={p.muted}>
            {m.from === m.to ? `${sabbats[m.from].symbol} время ${sabbats[m.from].genitive}` : `${sabbats[m.from].name} → ${sabbats[m.to].name}`}
          </Text>
          {m.turn && (
            <Text fontSize="sm" color={p.star}>
              {sabbats[m.turn.sabbat].symbol} {sabbats[m.turn.sabbat].name} · {m.turn.day}
            </Text>
          )}
          {fullMoons.map((d) => (
            <HStack key={d} gap="1.5" fontSize="sm" color={p.muted}>
              <MoonIcon day={d} size={12} lit={p.star} />
              <Text as="span">эсбат · {+d.slice(8)}</Text>
            </HStack>
          ))}
        </Stack>
        <Box flex="1" minW="0">
          <Grid templateColumns="repeat(7, minmax(0, 1fr))" gap="1" mb="1">
            {weekdays.map((w) => (
              <Text key={w} fontSize="2xs" textAlign="center" color={p.subtle} textTransform="uppercase" letterSpacing=".06em">
                {w}
              </Text>
            ))}
          </Grid>
          <Grid templateColumns="repeat(7, minmax(0, 1fr))" gap="1">
            {cells.map((d, i) => {
              if (!d) return <Box key={`pad${i}`} />
              const sabbat = holidays[d]
              const full = isFullMoon(d)
              const isToday = d === today
              return (
                <Box
                  as="button"
                  key={d}
                  onClick={() => onDay(d)}
                  aria-label={`${plainDay(d)}, ${moonPhaseNames[moonPhase(d)]}${sabbat ? `, ${sabbats[sabbat].name}` : ''}${full ? ', эсбат' : ''}`}
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  gap="0.5"
                  py="1"
                  borderRadius="6px"
                  borderWidth="1px"
                  borderColor={isToday ? p.star : sabbat ? p.line : 'transparent'}
                  bg={sabbat ? 'rgba(255,240,215,.12)' : isToday ? 'rgba(255,240,215,.08)' : 'transparent'}
                  opacity={d < today ? 0.7 : 1}
                  _hover={{ bg: p.hover }}
                >
                  <Text fontSize="xs" lineHeight="1" fontWeight={isToday ? 'bold' : undefined} color={isToday || sabbat ? p.star : p.fg}>
                    {+d.slice(8)}
                  </Text>
                  <Box filter={full ? `drop-shadow(0 0 4px ${p.glow})` : undefined}>
                    {sabbat ? (
                      <Text fontSize="sm" lineHeight="18px" h="18px">
                        {sabbats[sabbat].symbol}
                      </Text>
                    ) : (
                      <MoonIcon day={d} size={18} lit={full ? '#fff6dc' : 'rgba(246,239,228,.85)'} />
                    )}
                  </Box>
                  <Box w="3px" h="3px" borderRadius="full" bg={busy.has(d) ? p.star : 'transparent'} />
                </Box>
              )
            })}
          </Grid>
        </Box>
      </Flex>
    </Box>
  )
}

function DayDialog({ day, today, holiday, onClose }: { day: DayKey; today: DayKey; holiday?: Sabbat; onClose: () => void }) {
  const g = useAppSelector((s) => s.grimoire)
  const { open, dialog } = useTaskDialog()
  const deeds = Object.values(g.tasks).filter((t) => !t.habitId && t.status !== 'cancelled' && (t.doneDay === day || (t.doOn === day && t.status !== 'done')))
  const notes = Object.values(g.journal).filter((e) => e.day === day)
  const full = isFullMoon(day)
  const n = daysBetween(today, day)
  return (
    <Modal open onClose={onClose} title={plainDay(day)} size="sm">
      <Stack gap="3">
        <HStack gap="2" color="fg.muted" fontSize="sm">
          <Box color="ember.100">
            <MoonIcon day={day} size={20} />
          </Box>
          <Text>
            {moonPhaseNames[moonPhase(day)]}
            {n === 0 ? ' · сегодня' : n > 0 ? ` · через ${days(n)}` : ''}
          </Text>
        </HStack>
        {holiday && (
          <Flex gap="2" align="center" wrap="wrap">
            <Text fontSize="sm" flex="1">
              {sabbats[holiday].symbol} {sabbats[holiday].name}: {sabbats[holiday].theme.toLowerCase()}
            </Text>
            <Button asChild size="xs" variant="outline">
              <RouterLink to={`/g/wheel?s=${holiday}`}>К колесу</RouterLink>
            </Button>
          </Flex>
        )}
        {full && (
          <Flex gap="2" align="center" wrap="wrap">
            <Text fontSize="sm" flex="1">
              Эсбат: полнолуние, малый праздник
            </Text>
            <Button asChild size="xs" variant="outline">
              <RouterLink to="/g/wheel#esbat">Практики</RouterLink>
            </Button>
          </Flex>
        )}
        {deeds.length > 0 && (
          <Stack gap="1">
            <Text fontSize="xs" color="fg.subtle" textTransform="uppercase" letterSpacing=".06em">
              Дела
            </Text>
            {deeds.map((t) => (
              <Flex key={t.id} gap="2" align="center" cursor="pointer" onClick={() => open(t)} opacity={t.status === 'done' ? 0.7 : 1}>
                <Text fontSize="sm" flex="1">
                  {t.status === 'done' ? '✓ ' : ''}
                  {t.title}
                </Text>
                <Stars n={t.stars} size={10} />
              </Flex>
            ))}
          </Stack>
        )}
        {notes.length > 0 && (
          <Text fontSize="sm" color="fg.muted">
            Записей в зеркале: {notes.length}
          </Text>
        )}
        {!holiday && !full && !deeds.length && !notes.length && (
          <Text fontSize="sm" color="fg.subtle">
            Тихий день.
          </Text>
        )}
      </Stack>
      {dialog}
    </Modal>
  )
}

export default function Calendar() {
  const today = useToday()
  const g = useAppSelector((s) => s.grimoire)
  const hemisphere = g.meta.hemisphere
  const [year, setYear] = useState(+today.slice(0, 4))
  const [day, setDay] = useState<DayKey>()
  const holidays = useMemo(() => Object.fromEntries(Object.entries(sabbatDays(year, hemisphere)).map(([s, d]) => [d, s as Sabbat])) as Record<DayKey, Sabbat>, [year, hemisphere])
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => monthInfo(year, i + 1, hemisphere, holidays)), [year, hemisphere, holidays])
  // A dot under days that have deeds: planned or done there.
  const busy = useMemo(() => new Set(Object.values(g.tasks).flatMap((t) => (t.habitId || t.status === 'cancelled' ? [] : [t.status === 'done' ? t.doneDay : t.doOn].filter((d): d is DayKey => !!d)))), [g.tasks])
  const current = useRef<HTMLDivElement | null>(null)
  const thisYear = +today.slice(0, 4)

  // The current month comes into view when the page opens (after the layout's own scroll to the top).
  useEffect(() => {
    if (year !== thisYear) return
    const id = requestAnimationFrame(() => current.current?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(id)
  }, [year])

  return (
    <>
      <PageHeader title="Календарь">
        <HStack gap="1">
          <IconButton size="sm" variant="ghost" aria-label="Прошлый год" onClick={() => setYear(year - 1)}>
            <LuChevronLeft />
          </IconButton>
          <Button size="sm" variant={year === thisYear ? 'ghost' : 'outline'} onClick={() => setYear(thisYear)}>
            {year}
          </Button>
          <IconButton size="sm" variant="ghost" aria-label="Следующий год" onClick={() => setYear(year + 1)}>
            <LuChevronRight />
          </IconButton>
        </HStack>
      </PageHeader>
      <SimpleGrid columns={{ base: 1, '2xl': 2 }} gap="4">
        {months.map((m) => (
          <MonthCard
            key={m.first}
            m={m}
            today={today}
            holidays={holidays}
            busy={busy}
            onDay={setDay}
            refFor={m.year === thisYear && m.month === +today.slice(5, 7) ? (el) => (current.current = el) : undefined}
          />
        ))}
      </SimpleGrid>
      {day && <DayDialog day={day} today={today} holiday={holidays[day]} onClose={() => setDay(undefined)} />}
    </>
  )
}
