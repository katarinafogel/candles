// Small marks of a deed: candle-glow stars for difficulty, skulls for dread (never confused with stars),
// a calm deadline, tags.
import { Badge, Box, HStack, Text } from '@chakra-ui/react'
import { LuSkull } from 'react-icons/lu'
import { dueDay, humanDay } from '../../grimoire/days'
import { dreadLabel } from '../../grimoire/labels'
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
    <HStack gap="0" color="ember.300" aria-label={`сложность ${n} из 3`}>
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
export function Deadline({ dueAt, today }: { dueAt?: string; today: DayKey }) {
  const d = dueDay(dueAt)
  if (!d) return null
  const close = d <= today
  const time = dueAt && dueAt.length > 10 ? ` ${dueAt.slice(11, 16)}` : ''
  return (
    <Text as="span" fontSize="xs" color={close ? 'ember.200' : 'fg.muted'} whiteSpace="nowrap">
      до {humanDay(d, today)}
      {time}
    </Text>
  )
}

export function Tag({ name }: { name: string }) {
  return (
    <Badge variant="subtle" colorPalette="emerald" fontSize="2xs" borderRadius="full" px="2">
      #{name}
    </Badge>
  )
}
