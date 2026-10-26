// Small marks of a deed: candle-glow stars for difficulty, skulls for dread (never confused with stars),
// a calm deadline, tags.
import { Badge, Box, HStack, Text } from '@chakra-ui/react'
import { LuSkull } from 'react-icons/lu'
import { dueDay, humanDay } from '../../grimoire/days'
import { dreadLabel } from '../../grimoire/labels'
import { tagPalette } from '../../grimoire/tags'
import { useAppSelector } from '../../store'
import type { DayKey } from '../../grimoire/types'

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

export function Dread({ n, size = 12 }: { n: number; size?: number }) {
  if (!n) return null
  return (
    <HStack gap="0" color={n === 3 ? 'red.300' : 'fg.muted'} aria-label={`нехотение: ${dreadLabel[n]}`} title={dreadLabel[n]}>
      {Array.from({ length: n }, (_, i) => (
        <Box key={i} display="inline-flex" fontSize={`${size}px`}>
          <LuSkull />
        </Box>
      ))}
    </HStack>
  )
}

/** Tap to choose 1–3 (stars) or 0–3 (dread); the label under it says what the number means. */
export function MarkPicker({ kind, value, onChange }: { kind: 'stars' | 'dread'; value: number; onChange: (v: number) => void }) {
  const values = kind === 'stars' ? [1, 2, 3] : [0, 1, 2, 3]
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
            alignItems="center"
            gap="1.5"
            minH="9"
            aria-pressed={on}
          >
            {kind === 'stars' ? <Stars n={v} size={14} /> : v ? <Dread n={v} size={14} /> : null}
            <Text fontSize="xs" color={on ? 'ember.100' : 'fg.muted'}>
              {kind === 'stars' ? `${v}` : dreadLabel[v]}
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
    <Badge variant="subtle" colorPalette={tagPalette(name, colors)} fontSize="2xs" borderRadius="full" px="2">
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
