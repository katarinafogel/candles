// Vertical cards like tarot arcana: a double line frame, stars in the corners, diamonds on the edges,
// leafy vines and an emblem. Molds are indigo, holders pearl white, candles golden green.
// The tones are names only: their colours come from the theme's palette (cardVars in themes.ts).
// The grimoire's deeds wear four tones of their own: swamp (frogs), nacre (joys), wine (the hardest)
// and silver (everything needed); see TaskCard.
import { Box, Flex, Stack, Text, type ButtonProps } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { Sparkle } from '@shared/components/Magic'

export type ArcanaTone = 'indigo' | 'pearl' | 'olive' | 'swamp' | 'nacre' | 'wine' | 'silver'

export interface Palette {
  bg: string
  fg: string
  muted: string
  subtle: string
  line: string
  accent: string
  star: string
  hover: string
  leafOff: string
  /** Lines of the shape icons. */
  ink: string
}

/** A tone's colours: CSS variables of the theme (see cardVars in themes.ts), never colours of its own. */
const toneVars = (tone: ArcanaTone): Palette => {
  const v = (k: string) => `var(--g-card-${tone}-${k})`
  return { bg: v('bg'), fg: v('fg'), muted: v('muted'), subtle: v('subtle'), line: v('line'), accent: v('accent'), star: v('star'), hover: v('hover'), leafOff: v('leaf-off'), ink: v('ink') }
}

const tones: ArcanaTone[] = ['indigo', 'pearl', 'olive', 'swamp', 'nacre', 'wine', 'silver']
export const palettes = Object.fromEntries(tones.map((t) => [t, toneVars(t)])) as Record<ArcanaTone, Palette>

/** Line-art vine with pointed leaves, drawn for the top-left corner; mirrored for the others. */
export function Vine({ color, transform }: { color: string; transform?: string }) {
  const leaf = (x: number, y: number, rot: number, len = 13) => (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d={`M0 0C${len * 0.35} ${-len * 0.32} ${len * 0.75} ${-len * 0.3} ${len} 0C${len * 0.75} ${len * 0.3} ${len * 0.35} ${len * 0.32} 0 0Z`} />
      <path d={`M1 0H${len - 2}`} strokeOpacity=".6" />
    </g>
  )
  return (
    <svg width="74" height="74" viewBox="0 0 74 74" style={{ position: 'absolute', transform }} aria-hidden="true">
      <g fill="none" stroke={color} strokeWidth=".9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 62C10 40 22 22 44 12S66 6 70 8" />
        <path d="M14 70C16 58 22 48 30 42" />
        {leaf(12, 46, -100)}
        {leaf(18, 34, -70, 12)}
        {leaf(28, 22, -40, 13)}
        {leaf(42, 13, -12, 12)}
        {leaf(56, 9, 8, 10)}
        {leaf(22, 52, 20, 10)}
      </g>
      <g fill={color} opacity=".75">
        <circle cx="34" cy="34" r=".9" />
        <circle cx="40" cy="28" r=".7" />
        <circle cx="48" cy="24" r=".9" />
      </g>
    </svg>
  )
}

/**
 * The emblem in the middle of a card: a crescent for molds, a sun for holders, a flame for candles;
 * for deeds a frog, a shell of nacre, three stars in a crown and a quill.
 */
function Emblem({ tone, p }: { tone: ArcanaTone; p: Palette }) {
  if (tone === 'swamp')
    return (
      <svg width="50" height="46" viewBox="0 0 50 46" fill="none" aria-hidden="true">
        <g stroke={p.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="17" cy="13" r="6" fill={p.accent} fillOpacity=".2" />
          <circle cx="33" cy="13" r="6" fill={p.accent} fillOpacity=".2" />
          <path d="M11.5 17C7 21 5.6 26 7 31c2 7 9.4 10 18 10s16-3 18-10c1.4-5 0-10-4.5-14" fill={p.accent} fillOpacity=".25" />
          <path d="M19 30c3.6 2.4 8.4 2.4 12 0" />
          <path d="M8 38l-5 4M42 38l5 4" />
        </g>
        <circle cx="17" cy="13" r="2" fill={p.star} />
        <circle cx="33" cy="13" r="2" fill={p.star} />
      </svg>
    )
  if (tone === 'nacre')
    return (
      <svg width="50" height="46" viewBox="0 0 50 46" aria-hidden="true">
        <g stroke={p.accent} strokeWidth="1.3" strokeLinecap="round" fill="none">
          <path d="M25 40L6 18C10 9 17 5 25 5s15 4 19 13z" fill={p.accent} fillOpacity=".18" />
          <path d="M25 40L13 10M25 40L19 6M25 40V5M25 40l6-34M25 40l12-30" />
          <path d="M20 40h10l-2 4h-6z" fill={p.accent} fillOpacity=".4" />
        </g>
        <path d="M41 4c.3 1.8 1 2.5 2.8 2.8-1.8.3-2.5 1-2.8 2.8-.3-1.8-1-2.5-2.8-2.8 1.8-.3 2.5-1 2.8-2.8z" fill={p.star} />
      </svg>
    )
  if (tone === 'wine')
    return (
      <svg width="52" height="46" viewBox="0 0 52 46" aria-hidden="true">
        <path d="M8 34l4-18 8 9 6-15 6 15 8-9 4 18z" fill="none" stroke={p.accent} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M8 38h36" stroke={p.accent} strokeWidth="1.4" strokeLinecap="round" />
        {[
          [12, 12],
          [26, 6],
          [40, 12],
        ].map(([x, y]) => (
          <path key={x} d={`M${x} ${y - 4}l1.2 2.8 3 .3-2.3 2 .7 3-2.6-1.6-2.6 1.6.7-3-2.3-2 3-.3z`} fill={p.star} />
        ))}
      </svg>
    )
  if (tone === 'silver')
    return (
      <svg width="46" height="46" viewBox="0 0 46 46" fill="none" aria-hidden="true">
        <path d="M36 4C24 8 15 18 11 34l3 1C20 22 28 13 36 4z" fill={p.accent} fillOpacity=".3" stroke={p.accent} strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M30 10c-2 4-5 7-9 9M25 16c-1.6 3-4 5.4-7 7" stroke={p.accent} strokeWidth="1" strokeLinecap="round" />
        <path d="M11 34l-2 8M7 42h12" stroke={p.star} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    )
  if (tone === 'indigo')
    return (
      <svg width="46" height="46" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M30 6a18 18 0 1 0 12 30A15 15 0 0 1 30 6z" fill={p.accent} fillOpacity=".9" />
        <path d="M13 12c.4 3 1.4 4 4.4 4.4-3 .4-4 1.4-4.4 4.4-.4-3-1.4-4-4.4-4.4 3-.4 4-1.4 4.4-4.4z" fill={p.star} />
        <circle cx="10" cy="30" r="1" fill={p.star} />
        <circle cx="20" cy="40" r=".8" fill={p.star} />
      </svg>
    )
  if (tone === 'pearl')
    return (
      <svg width="50" height="50" viewBox="0 0 50 50" aria-hidden="true">
        <g stroke={p.accent} strokeWidth="1.6" strokeLinecap="round" fill="none">
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i * Math.PI) / 8
            const r1 = 13
            const r2 = i % 2 ? 19 : 23
            const c = Math.cos(a)
            const s = Math.sin(a)
            // Wavy rays like the hand-drawn sun.
            return (
              <path
                key={i}
                d={`M${25 + c * r1} ${25 + s * r1}Q${25 + c * (r1 + r2) / 2 - s * 2} ${25 + s * (r1 + r2) / 2 + c * 2} ${25 + c * r2} ${25 + s * r2}`}
              />
            )
          })}
        </g>
        <circle cx="25" cy="25" r="10.5" fill={p.accent} fillOpacity=".85" />
      </svg>
    )
  return (
    <svg width="46" height="46" viewBox="0 0 48 48" aria-hidden="true">
      <g stroke={p.star} strokeWidth="1" strokeLinecap="round" opacity=".7">
        <path d="M24 3v4M10 10l3 3M38 10l-3 3M5 24h4M43 24h-4" />
      </g>
      <path d="M24 9c5 7 8 11.5 8 16a8 8 0 0 1-16 0c0-4.5 3-9 8-16z" fill={p.accent} />
      <path d="M24 18c2.2 3.2 3.4 5.2 3.4 7.3a3.4 3.4 0 0 1-6.8 0c0-2.1 1.2-4.1 3.4-7.3z" fill={p.star} />
      <rect x="17" y="35" width="14" height="9" rx="1.5" fill="none" stroke={p.star} strokeWidth="1.2" />
      <path d="M24 33v2" stroke={p.star} strokeWidth="1.2" />
    </svg>
  )
}

/** A diamond on the frame line with a tiny star inside, like the marks on the reference card. */
function Diamond({ p, ...pos }: { p: Palette; top?: string; bottom?: string }) {
  return (
    <Flex
      position="absolute"
      left="50%"
      transform="translateX(-50%) rotate(45deg)"
      w="14px"
      h="14px"
      borderWidth="1px"
      borderColor={p.line}
      bg="var(--card-solid)"
      align="center"
      justify="center"
      {...pos}
    >
      <Box transform="rotate(-45deg)" color={p.star} lineHeight="0">
        <Sparkle size={7} />
      </Box>
    </Flex>
  )
}

/** Buttons inside a card take its colors. */
export const arcanaButton: ButtonProps = {
  size: 'xs',
  variant: 'outline',
  color: 'var(--card-fg)',
  borderColor: 'var(--card-line)',
  // Solid so the vines pass behind the buttons.
  bg: 'var(--card-solid)',
  _hover: { bg: 'var(--card-solid)', borderColor: 'var(--card-fg)' },
}

export const solidOf = Object.fromEntries(tones.map((t) => [t, `var(--g-card-${t}-solid)`])) as Record<ArcanaTone, string>

/** The card's frame: two lines, corner stars, edge diamonds and vines; inside a relative box. */
export function ArcanaFrame({ p }: { p: Palette }) {
  return (
    <>
      <Box position="absolute" inset="7px" borderWidth="1px" borderColor={p.line} borderRadius="3px" pointerEvents="none" />
      <Box position="absolute" inset="11px" borderWidth="1px" borderColor={p.line} opacity=".55" pointerEvents="none" />
      <Box position="absolute" inset="0" pointerEvents="none" color={p.star}>
        <Box position="absolute" top="15px" left="15px"><Sparkle size={9} /></Box>
        <Box position="absolute" top="15px" right="15px"><Sparkle size={9} /></Box>
        <Box position="absolute" bottom="15px" left="15px"><Sparkle size={9} /></Box>
        <Box position="absolute" bottom="15px" right="15px"><Sparkle size={9} /></Box>
        <Diamond p={p} top="0px" />
        <Diamond p={p} bottom="0px" />
        <Box position="absolute" top="10px" right="10px" opacity=".85">
          <Vine color={p.line} transform="translate(-64px, 0) scaleX(-1)" />
        </Box>
        <Box position="absolute" bottom="10px" left="10px" opacity=".55">
          <Vine color={p.line} transform="translate(0, -74px) scaleY(-1)" />
        </Box>
      </Box>
    </>
  )
}

export function ArcanaCard({
  tone,
  title,
  sub,
  corner,
  select,
  selected,
  dim,
  figure,
  onClick,
  children,
  footer,
  fixed,
}: {
  tone: ArcanaTone
  title: ReactNode
  /** Small line under the title, like the id. */
  sub?: ReactNode
  /** Top-right slot: a rating, a badge. */
  corner?: ReactNode
  /** Top-left slot: the selection leaf. Clicks on it do not open the card. */
  select?: ReactNode
  selected?: boolean
  /** Archived or defective: shown faded. */
  dim?: boolean
  /** Shape icon of the casting, between the emblem and the title. */
  figure?: ReactNode
  onClick?: () => void
  children?: ReactNode
  footer?: ReactNode
  /** Exactly 5:8, whatever the text: what does not fit is cut off, so a grid of them is even. */
  fixed?: boolean
}) {
  const p = palettes[tone]
  return (
    <Box
      position="relative"
      // At least 5:8 tall via an invisible spacer; taller when the text needs it,
      // and a grid row stretches every card to its tallest one.
      display="flex"
      _before={fixed ? undefined : { content: '""', w: '0', pt: '160%' }}
      aspectRatio={fixed ? '5 / 8' : undefined}
      overflow={fixed ? 'hidden' : undefined}
      borderRadius="10px"
      background={p.bg}
      color={p.fg}
      cursor={onClick ? 'pointer' : undefined}
      onClick={onClick}
      opacity={dim ? 0.62 : 1}
      outline={selected ? `2px solid ${p.star}` : undefined}
      transition="transform .18s ease"
      _hover={onClick ? { transform: 'translateY(-2px)' } : undefined}
      css={{
        '--card-fg': p.fg,
        '--card-line': p.line,
        '--card-hover': p.hover,
        '--card-solid': solidOf[tone],
        '--card-ink': p.ink,
        '--leaf-on': p.star,
        '--leaf-off': p.leafOff,
        '--star-on': p.star,
        '--chakra-colors-fg': p.fg,
        '--chakra-colors-fg-muted': p.muted,
        '--chakra-colors-fg-subtle': p.subtle,
        '--chakra-colors-border': p.line,
      }}
    >
      <ArcanaFrame p={p} />

      <Stack position="relative" flex="1" minW="0" minH={fixed ? '0' : undefined} gap="0" px="5" pt="5" pb="6" align="center" textAlign="center" css={{ '& > *': { flexShrink: 0 } }}>
        <Flex w="100%" justify="space-between" align="flex-start" minH="26px">
          <Box onClick={(e) => e.stopPropagation()}>{select}</Box>
          <Box fontSize="xs" color={p.star} fontWeight="semibold">
            {corner}
          </Box>
        </Flex>
        {/* A fixed card is short of room: its emblem is a little smaller. */}
        <Box mt={fixed ? '0' : '1'} mb={fixed ? '1' : '2'} transform={fixed ? 'scale(.8)' : undefined}>
          <Emblem tone={tone} p={p} />
        </Box>
        {figure && (
          <Box mb="2" lineHeight="0">
            {figure}
          </Box>
        )}
        <Text fontFamily="heading" fontWeight="semibold" fontSize={{ base: 'lg', md: 'xl' }} lineHeight="1.15" lineClamp={2} wordBreak="break-word">
          {title}
        </Text>
        {sub && (
          <Text fontSize="2xs" color={p.muted} fontFamily="mono" mt="1" letterSpacing=".04em">
            {sub}
          </Text>
        )}
        <Flex align="center" gap="1.5" my="2" color={p.star} opacity=".7">
          <Box w="18px" h="1px" bg={p.line} />
          <Sparkle size={6} />
          <Box w="18px" h="1px" bg={p.line} />
        </Flex>
        <Stack gap="0.5" fontSize="xs" color={p.muted} flex="1" w="100%" lineHeight="short" minH={fixed ? '0' : undefined} overflow={fixed ? 'hidden' : undefined} flexShrink={fixed ? 1 : undefined}>
          {children}
        </Stack>
        {footer && (
          <Flex mt="2" gap="1.5" justify="center" wrap="wrap" w="100%" onClick={(e) => e.stopPropagation()}>
            {footer}
          </Flex>
        )}
      </Stack>
    </Box>
  )
}
