// Small marks of a deed: candle-coloured stars for difficulty, weather for dread — one icon that changes
// (sun, cloud, rain, storm) in cool lilac-grey, so it never mixes with the warm stars — a calm deadline, tags.
import { Badge, Box, HStack, Text } from '@chakra-ui/react'
import { LuCloud, LuCloudLightning, LuCloudRain, LuSun } from 'react-icons/lu'
import { dueDay, humanDay } from '../../grimoire/days'
import { dreadLabel, priorityLabel } from '../../grimoire/labels'
import { tagPalette } from '../../grimoire/tags'
import { useAppSelector } from '../../store'
import type { DayKey, TaskPriority } from '../../grimoire/types'

const star = (on: boolean, px: string) => (
  <svg width={px} height={px} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 2.8l2.83 5.73 6.33.92-4.58 4.46 1.08 6.3L12 17.24l-5.66 2.97 1.08-6.3L2.84 9.45l6.33-.92z"
      fill={on ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
)

/** One star in a given colour, filled or as an outline. */
export function StarMark({ filled = true, color, size = 14 }: { filled?: boolean; color: string; size?: number }) {
  return (
    <Box display="inline-flex" color={color}>
      {star(filled, `${size}px`)}
    </Box>
  )
}

export function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return (
    // Cards of other colors set --star-on so the stars stay readable on them.
    <HStack gap="0" color="var(--star-on, var(--chakra-colors-ember-300))" aria-label={`сложность ${n} из 3`}>
      {Array.from({ length: n }, (_, i) => (
        <Box key={i} display="inline-flex">
          {star(true, `${size}px`)}
        </Box>
      ))}
    </HStack>
  )
}

const weather = [LuSun, LuCloud, LuCloudRain, LuCloudLightning]
/** Quiet for laziness and «не хочу», the candle amber for the monster. */
const weatherColor = ['fg.subtle', 'fg.subtle', 'fg.subtle', 'ember.300']

/** One weather icon for the dread; «норм» (0) is drawn only in the picker (`calm`). */
export function Dread({ n, size = 12, calm }: { n: number; size?: number; calm?: boolean }) {
  if (!n && !calm) return null
  const Icon = weather[n]
  return (
    <Box display="inline-flex" fontSize={`${size}px`} color={weatherColor[n]} aria-label={`нехотение: ${dreadLabel[n]}`} title={dreadLabel[n]}>
      <Icon strokeWidth={n === 3 ? 2.4 : 2} />
    </Box>
  )
}

/** Difficulty as a scale of three stars: tapping the second sets 2. */
function StarScale({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <HStack gap="0.5" role="radiogroup" aria-label="Сложность">
      {[1, 2, 3].map((v) => {
        const on = value >= v
        return (
          <Box
            as="button"
            key={v}
            role="radio"
            aria-checked={value === v}
            aria-label={`сложность ${v} из 3`}
            p="1"
            lineHeight="0"
            cursor="pointer"
            color={on ? 'ember.300' : 'fg.subtle'}
            _hover={{ color: 'ember.200' }}
            onClick={() => onChange(v)}
          >
            <StarMark filled={on} color="currentColor" size={24} />
          </Box>
        )
      })}
    </HStack>
  )
}

/** Tap to choose 1–3 (stars, a scale) or 0–3 (dread, the weather icon over its label). */
export function MarkPicker({ kind, value, onChange }: { kind: 'stars' | 'dread'; value: number; onChange: (v: number) => void }) {
  if (kind === 'stars') return <StarScale value={value} onChange={onChange} />
  const values = [0, 1, 2, 3]
  return (
    <HStack gap="1" wrap="wrap">
      {values.map((v) => {
        const on = value === v
        return (
          <Box
            as="button"
            key={v}
            onClick={() => onChange(v)}
            px="2.5"
            py="1.5"
            borderRadius="l2"
            borderWidth="1px"
            borderColor={on ? 'ember.500' : 'border'}
            bg={on ? 'ember.subtle' : 'transparent'}
            display="flex"
            flexDirection="column"
            alignItems="center"
            gap="0.5"
            minH="9"
            minW="16"
            cursor="pointer"
            aria-pressed={on}
          >
            <Dread n={v} size={16} calm />
            <Text fontSize="xs" color={on ? 'ember.100' : 'fg.muted'}>
              {dreadLabel[v]}
            </Text>
          </Box>
        )
      })}
    </HStack>
  )
}

/** A real deadline, said calmly: «до четверга»; close ones get a soft candle tint, never red. */
export function Deadline({ dueAt, today, size = 'xs' }: { dueAt?: string; today: DayKey; size?: '2xs' | 'xs' }) {
  const d = dueDay(dueAt)
  if (!d) return null
  const close = d <= today
  const time = dueAt && dueAt.length > 10 ? ` ${dueAt.slice(11, 16)}` : ''
  return (
    <Text as="span" fontSize={size} color={close ? 'var(--star-on, var(--chakra-colors-ember-200))' : 'fg.muted'} whiteSpace="nowrap">
      до {humanDay(d, today)}
      {time}
    </Text>
  )
}

export function Tag({ name }: { name: string }) {
  const colors = useAppSelector((s) => s.grimoire.meta.tagColors)
  return (
    // The swatch tints the pill; the text is the swatch mixed into the text colour around it
    // (an arcana card's own on a card), so it reads on light paper and on dark cards alike.
    <Badge
      variant="plain"
      bg={`color-mix(in srgb, var(--g-tag-${tagPalette(name, colors)}) 26%, transparent)`}
      color={`color-mix(in srgb, var(--g-tag-${tagPalette(name, colors)}) 45%, var(--card-fg, var(--g-fg)))`}
      fontSize="2xs"
      borderRadius="full"
      px="2"
    >
      #{name}
    </Badge>
  )
}

/** A little line-art frog, the mark of a frog deed. */
export function FrogIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="7" r="2.6" />
      <circle cx="16" cy="7" r="2.6" />
      <circle cx="8" cy="7" r=".8" fill="currentColor" />
      <circle cx="16" cy="7" r=".8" fill="currentColor" />
      <path d="M5.6 8.6C3.6 10.4 3 12.6 3.6 14.8 4.6 18.4 8 20 12 20s7.4-1.6 8.4-5.2c.6-2.2 0-4.4-2-6.2" />
      <path d="M9 14.2c1.8 1.2 4.2 1.2 6 0" />
      <path d="M4 18.6l-2 1.6M20 18.6l2 1.6" />
    </svg>
  )
}

/**
 * A deed's priority as Jira draws it: two arrows up, one up, two bars, one down, two down; in the
 * theme's colours (themes.ts, --g-prio-*), mixed into the text around so it reads on cards too.
 */
export function PriorityIcon({ p, size = 14 }: { p: TaskPriority; size?: number }) {
  const path = {
    highest: 'M6 17l6-5 6 5M6 11l6-5 6 5',
    high: 'M6 15l6-6 6 6',
    medium: 'M6 9.5h12M6 14.5h12',
    low: 'M6 9l6 6 6-6',
    lowest: 'M6 7l6 5 6-5M6 13l6 5 6-5',
  }[p]
  return (
    <Box
      as="span"
      display="inline-flex"
      lineHeight="0"
      color={`color-mix(in srgb, var(--g-prio-${p}) 78%, var(--card-fg, var(--g-fg)))`}
      title={`приоритет: ${priorityLabel[p]}`}
      aria-label={`приоритет: ${priorityLabel[p]}`}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={p === 'highest' || p === 'lowest' ? 2.6 : 2.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={path} />
      </svg>
    </Box>
  )
}
