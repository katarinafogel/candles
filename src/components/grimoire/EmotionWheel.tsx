// The emotion wheel: 8 petals × 3 rings (the centre is the strongest word), mixed feelings named on
// the outer circle between petals. Each ring is its own tap zone; a long press opens the word's card.
// On a narrow screen the words are too small to hit, so a tap opens the petal as three big buttons.
import { Box, Button, Flex, HStack, IconButton, Input, Stack, Text } from '@chakra-ui/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LuInfo, LuX } from 'react-icons/lu'
import { dyadFor, dyads, emotionWords, petalOrder, petals, petalWords, searchWords, wordColor, type Petal } from '../../grimoire/emotions'
import { Sparkle } from '../Magic'

const R0 = 26
const RINGS = [
  [158, 214],
  [96, 158],
  [R0, 96],
] as const
const DYAD_R = 233
const VIEW = 252
const SPAN = 20

const rad = (deg: number) => ((deg - 90) * Math.PI) / 180
const pt = (deg: number, r: number) => [Math.cos(rad(deg)) * r, Math.sin(rad(deg)) * r] as const

function sector(mid: number, r1: number, r2: number) {
  const [a, b] = [mid - SPAN, mid + SPAN]
  const [x1, y1] = pt(a, r2)
  const [x2, y2] = pt(b, r2)
  const [x3, y3] = pt(b, r1)
  const [x4, y4] = pt(a, r1)
  return `M${x1} ${y1}A${r2} ${r2} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${r1} ${r1} 0 0 0 ${x4} ${y4}Z`
}

/** Long press (or right click) → info; a short tap → pick. */
function usePress(onTap: () => void, onLong?: () => void) {
  const timer = useRef<number>()
  const long = useRef(false)
  return {
    onPointerDown: () => {
      long.current = false
      if (onLong)
        timer.current = window.setTimeout(() => {
          long.current = true
          onLong()
        }, 500)
    },
    onPointerUp: () => clearTimeout(timer.current),
    onPointerLeave: () => clearTimeout(timer.current),
    onClick: () => !long.current && onTap(),
    onContextMenu: (e: React.MouseEvent) => {
      if (!onLong) return
      e.preventDefault()
      onLong()
    },
  }
}

/**
 * Where a word's label goes: along the arc where the ring is wide, along the radius in the narrow
 * centre; turned so it never reads upside down, and shrunk to fit its room.
 */
function labelPlace(mid: number, r1: number, r2: number, text: string) {
  const r = (r1 + r2) / 2
  const along = (r * 2 * SPAN * Math.PI) / 180
  const radial = r2 - r1
  const tangential = along > radial
  const room = (tangential ? along : radial) - 10
  let angle = tangential ? mid : mid - 90
  if (tangential ? mid > 90 && mid < 270 : mid > 180) angle += 180
  const fs = Math.max(7.5, Math.min(11, room / (text.length * 0.56)))
  const [x, y] = pt(mid, r)
  return { x, y, angle, fs, squeeze: text.length * fs * 0.56 > room ? room : undefined }
}

function Segment({ wordKey, d, label, place, selected, tint, onTap, onLong }: { wordKey: string; d: string; label: string; place: ReturnType<typeof labelPlace>; selected: boolean; tint: number; onTap: () => void; onLong?: () => void }) {
  const press = usePress(onTap, onLong)
  const color = wordColor(wordKey)
  return (
    <g role="button" tabIndex={0} aria-label={label} aria-pressed={selected} style={{ cursor: 'pointer', outline: 'none' }} {...press} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onTap()}>
      <path d={d} fill={color} fillOpacity={tint} stroke={selected ? '#fff6dc' : 'rgba(20,16,12,.85)'} strokeWidth={selected ? 3 : 1.2} />
      <text
        x={place.x}
        y={place.y}
        transform={`rotate(${place.angle} ${place.x} ${place.y})`}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={place.fs}
        textLength={place.squeeze}
        lengthAdjust="spacingAndGlyphs"
        fill="#fff8ea"
        stroke="rgba(18,14,10,.85)"
        strokeWidth="3"
        paintOrder="stroke"
        style={{ pointerEvents: 'none', fontWeight: selected ? 700 : 500 }}
      >
        {label}
      </text>
    </g>
  )
}

/**
 * The bare wheel. `tint(key)` 0…1 sets how strongly a word is coloured (the dictionary page colours by
 * frequency); by default the strength shows as saturation: the closer to the centre, the richer.
 */
export function EmotionWheel({
  selected = [],
  onWord,
  onInfo,
  onPetal,
  tint,
  center,
}: {
  selected?: string[]
  onWord: (key: string) => void
  onInfo?: (key: string) => void
  /** Given on a narrow screen: a tap opens the petal instead of picking a tiny word. */
  onPetal?: (p: Petal) => void
  tint?: (key: string) => number
  center?: ReactNode
}) {
  const strength = [0.38, 0.62, 0.92]
  return (
    <Box position="relative" w="100%" maxW="480px" mx="auto">
      <svg viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`} width="100%" role="group" aria-label="Колесо эмоций" style={{ touchAction: 'manipulation', userSelect: 'none' }}>
        {petalOrder.map((p, i) => {
          const mid = i * 45
          return RINGS.map(([r1, r2], ring) => {
            const key = `${p}.${ring + 1}`
            const info = emotionWords[key]
            return (
              <Segment
                key={key}
                wordKey={key}
                d={sector(mid, r1, r2)}
                label={info.word}
                place={labelPlace(mid, r1, r2, info.word)}
                selected={selected.includes(key)}
                tint={tint ? 0.12 + tint(key) * 0.82 : strength[ring]}
                onTap={() => (onPetal ? onPetal(p) : onWord(key))}
                onLong={onInfo && (() => onInfo(key))}
              />
            )
          })
        })}
        {dyads.map((d) => {
          const a = petalOrder.indexOf(d.from[0])
          const [x, y] = pt((a + 0.5) * 45, DYAD_R)
          const key = `dyad.${d.key}`
          const on = selected.includes(key)
          return <DyadLabel key={key} wordKey={key} x={x} y={y} on={on} dim={tint ? tint(key) : 1} onTap={() => onWord(key)} onLong={onInfo && (() => onInfo(key))} />
        })}
        <circle r={R0 - 3} fill="#1a1612" stroke="rgba(246,230,200,.35)" />
      </svg>
      <Flex position="absolute" left="50%" top="50%" transform="translate(-50%, -50%)" color="ember.200" pointerEvents={center ? 'auto' : 'none'}>
        {center ?? <Sparkle size={14} />}
      </Flex>
    </Box>
  )
}

function DyadLabel({ wordKey, x, y, on, dim, onTap, onLong }: { wordKey: string; x: number; y: number; on: boolean; dim: number; onTap: () => void; onLong?: () => void }) {
  const press = usePress(onTap, onLong)
  const w = emotionWords[wordKey].word
  const width = w.length * 6.2 + 12
  return (
    <g role="button" tabIndex={0} aria-label={w} aria-pressed={on} style={{ cursor: 'pointer', outline: 'none' }} opacity={0.45 + dim * 0.55} {...press} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onTap()}>
      <rect x={x - width / 2} y={y - 9} width={width} height={18} rx="9" fill={on ? '#fff6dc' : 'rgba(30,25,20,.92)'} stroke={on ? '#fff6dc' : 'rgba(246,230,200,.4)'} />
      <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill={on ? '#1b1814' : '#f3e8d6'} style={{ pointerEvents: 'none' }}>
        {w}
      </text>
    </g>
  )
}

/** A word as a coloured chip; the dot carries the petal's colour, the word itself the meaning. */
export function WordChip({ wordKey, onClick, onRemove, size = 'sm' }: { wordKey: string; onClick?: () => void; onRemove?: () => void; size?: 'xs' | 'sm' }) {
  const w = emotionWords[wordKey]
  if (!w) return null
  return (
    <HStack
      as={onClick ? 'button' : 'span'}
      onClick={onClick}
      gap="1.5"
      px={size === 'xs' ? '2' : '2.5'}
      py={size === 'xs' ? '0.5' : '1'}
      borderRadius="full"
      borderWidth="1px"
      borderColor={`color-mix(in srgb, ${wordColor(wordKey)} 60%, transparent)`}
      bg={`color-mix(in srgb, ${wordColor(wordKey)} 18%, var(--chakra-colors-bg-subtle))`}
      fontSize={size}
      lineHeight="1.2"
    >
      <Box w="7px" h="7px" borderRadius="full" bg={wordColor(wordKey)} flexShrink={0} />
      <Text as="span">{w.word}</Text>
      {onRemove && (
        <Box
          as="span"
          role="button"
          aria-label={`Убрать «${w.word}»`}
          display="inline-flex"
          color="fg.muted"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          <LuX size={12} />
        </Box>
      )}
    </HStack>
  )
}

/** Track the width of a box, to tell a phone-sized wheel from a roomy one. */
function useNarrow(limit = 420) {
  const ref = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const o = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < limit))
    o.observe(ref.current)
    return () => o.disconnect()
  }, [limit])
  return [ref, narrow] as const
}

/**
 * Picking 1–3 words: the wheel, a search by word or synonym, the chosen ones as chips (a tap removes),
 * and a soft hint of the mixed feeling when two neighbouring petals are chosen.
 */
export function EmotionPicker({ value, onChange, onInfo }: { value: string[]; onChange: (v: string[]) => void; onInfo: (key: string) => void }) {
  const [ref, narrow] = useNarrow()
  const [open, setOpen] = useState<Petal>()
  const [q, setQ] = useState('')
  const full = value.length >= 3
  const toggle = (key: string) => {
    if (value.includes(key)) onChange(value.filter((x) => x !== key))
    else if (!full) onChange([...value, key])
  }
  const hint = !full ? dyadFor(value) : undefined
  const found = searchWords(q)
  // The two mixed feelings on either side of the opened petal.
  const near = open ? dyads.filter((d) => d.from.includes(open)).map((d) => `dyad.${d.key}`) : []

  return (
    <Stack gap="3" ref={ref}>
      <EmotionWheel selected={value} onWord={toggle} onInfo={onInfo} onPetal={narrow ? (p) => setOpen(open === p ? undefined : p) : undefined} />
      {narrow && open && (
        <Box p="2" borderRadius="l2" borderWidth="1px" borderColor={`color-mix(in srgb, ${petals[open].color} 55%, transparent)`} bg="bg.muted">
          <Flex justify="space-between" align="center" mb="1.5">
            <Text fontSize="sm" color="fg.muted">
              {petals[open].name}: насколько сильно?
            </Text>
            <IconButton size="2xs" variant="ghost" aria-label="Свернуть" onClick={() => setOpen(undefined)}>
              <LuX />
            </IconButton>
          </Flex>
          <Stack gap="1.5">
            {[...petalWords(open), ...near.map((k) => emotionWords[k])].map((x, i) => (
              <Flex key={x.key} gap="1" align="center">
                <Button
                  flex="1"
                  justifyContent="flex-start"
                  variant={value.includes(x.key) ? 'solid' : 'outline'}
                  disabled={full && !value.includes(x.key)}
                  onClick={() => toggle(x.key)}
                  borderColor={`color-mix(in srgb, ${wordColor(x.key)} 60%, transparent)`}
                  minH="11"
                >
                  <Box w="8px" h="8px" borderRadius="full" bg={wordColor(x.key)} />
                  {x.word}
                  <Text as="span" fontSize="xs" color={value.includes(x.key) ? undefined : 'fg.subtle'} ml="auto">
                    {i < 3 ? ['слабо', 'средне', 'сильно'][i] : 'смешанное'}
                  </Text>
                </Button>
                <IconButton size="sm" variant="ghost" aria-label={`Что такое «${x.word}»`} onClick={() => onInfo(x.key)}>
                  <LuInfo />
                </IconButton>
              </Flex>
            ))}
          </Stack>
        </Box>
      )}
      <Input size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти слово: «раздраж», «тоска»…" />
      {q.trim() && (
        <Flex gap="1.5" wrap="wrap">
          {found.length ? (
            found.map((x) => <WordChip key={x.key} wordKey={x.key} onClick={() => (toggle(x.key), setQ(''))} />)
          ) : (
            <Text fontSize="xs" color="fg.subtle">
              Такого слова в словаре нет — попробуй ближайшее на колесе.
            </Text>
          )}
        </Flex>
      )}
      <Flex gap="1.5" wrap="wrap" align="center" minH="7">
        {value.length ? (
          value.map((k) => <WordChip key={k} wordKey={k} onClick={() => onInfo(k)} onRemove={() => toggle(k)} />)
        ) : (
          <Text fontSize="xs" color="fg.subtle">
            До трёх слов. Долгое нажатие на слово — что оно значит.
          </Text>
        )}
      </Flex>
      {hint && (
        <Flex gap="2" align="center" wrap="wrap" fontSize="sm">
          <Text color="fg.muted">Похоже на {emotionWords[hint].word} — добавить?</Text>
          <Button size="xs" variant="outline" onClick={() => onChange([...value, hint])}>
            Добавить
          </Button>
        </Flex>
      )}
    </Stack>
  )
}
