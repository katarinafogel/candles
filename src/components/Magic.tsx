// Hand-drawn ornaments: moons, sparkles and eucalyptus sprigs. All decorative, hidden from screen readers.
import { Box, Flex, type BoxProps, type FlexProps } from '@chakra-ui/react'

/** A crescent cut out of a disc, like the moons painted on wood slices. */
export function Crescent({ size = 24, color = 'currentColor' }: { size?: number | string; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15.5 3.2a9 9 0 1 0 5.3 13.6A7.4 7.4 0 0 1 15.5 3.2z" fill={color} />
    </svg>
  )
}

/** A four-pointed sparkle. */
export function Sparkle({ size = 12, color = 'currentColor' }: { size?: number | string; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 1c.6 5.6 2.4 8.4 11 11-8.6 2.6-10.4 5.4-11 11-.6-5.6-2.4-8.4-11-11 8.6-2.6 10.4-5.4 11-11z" fill={color} />
    </svg>
  )
}

/** A moon on a wood slice: bark ring, light end grain and a dark crescent. */
export function MoonSlice({ size = 40, tone = 'wood' }: { size?: number; tone?: 'wood' | 'stone' | 'sage' }) {
  const face = { wood: '#b88a5c', stone: '#4a4540', sage: '#a7b39a' }[tone]
  const ring = { wood: '#9a7049', stone: '#3c3833', sage: '#8f9c83' }[tone]
  const moon = tone === 'stone' ? '#e6dccb' : '#1b1814'
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="#4b3424" />
      <circle cx="20" cy="20" r="16" fill={face} />
      <circle cx="20" cy="20" r="11.5" fill="none" stroke={ring} strokeWidth=".8" />
      <circle cx="20" cy="20" r="6.5" fill="none" stroke={ring} strokeWidth=".6" />
      <path d="M22.5 11.2a9 9 0 1 0 5.6 13.4 7.2 7.2 0 0 1-5.6-13.4z" fill={moon} />
    </svg>
  )
}

/** Waxing to full to waning: the five phases in a row. */
export function MoonPhases({ size = 14, gap = '2', ...rest }: { size?: number; gap?: string } & FlexProps) {
  const r = 9
  // Each phase is a lit disc with a shadow disc shifted across it.
  const shifts = [13, 7, 0, -7, -13]
  return (
    <Flex gap={gap} align="center" aria-hidden="true" {...rest}>
      {shifts.map((dx, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20">
          <defs>
            <mask id={`phase-${i}`}>
              <rect width="20" height="20" fill="#fff" />
              {dx !== 0 && <circle cx={10 + dx} cy="10" r={r} fill="#000" />}
            </mask>
          </defs>
          <circle cx="10" cy="10" r={r} fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="1" />
          <circle cx="10" cy="10" r={r} fill="currentColor" mask={`url(#phase-${i})`} />
        </svg>
      ))}
    </Flex>
  )
}

/** A hanging sprig of dried eucalyptus with round leaves. */
export function Eucalyptus({ width = 120, flip, ...rest }: { width?: number; flip?: boolean } & BoxProps) {
  const leaves: [number, number, number, number][] = [
    // x, y, radius, rotation
    [52, 18, 9, -20],
    [70, 30, 8, 25],
    [46, 44, 10, -35],
    [72, 58, 9, 30],
    [44, 74, 8, -25],
    [68, 88, 9, 20],
    [50, 104, 7, -30],
    [64, 118, 6, 15],
    [56, 132, 5, 0],
  ]
  return (
    <Box
      width={`${width}px`}
      aria-hidden="true"
      pointerEvents="none"
      transform={flip ? 'scaleX(-1)' : undefined}
      {...rest}
    >
      <svg width="100%" viewBox="0 0 120 150">
        <path d="M58 0c-4 30 6 52 0 78s-4 44-2 60" fill="none" stroke="#6b5a45" strokeWidth="1.6" strokeLinecap="round" />
        {leaves.map(([x, y, r, rot], i) => (
          <g key={i} transform={`rotate(${rot} ${x} ${y})`}>
            <ellipse cx={x} cy={y} rx={r} ry={r * 0.92} fill={i % 3 === 1 ? '#7f9474' : '#8ea883'} fillOpacity={0.55 + (i % 3) * 0.12} />
            <path d={`M${x - r * 0.7} ${y}h${r * 1.4}`} stroke="#5a7251" strokeOpacity=".5" strokeWidth=".6" />
          </g>
        ))}
        {/* tiny dried flowers */}
        {[
          [84, 12],
          [88, 20],
          [92, 14],
          [30, 30],
          [26, 38],
          [86, 70],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.6" fill="#d8cdb9" fillOpacity=".55" />
        ))}
        <path d="M60 10c10 0 20 2 26 6M60 34c-12-2-22-2-30 0M60 66c10 0 18 2 24 4" fill="none" stroke="#6b5a45" strokeWidth=".8" strokeOpacity=".7" />
      </svg>
    </Box>
  )
}

/** A thin rule with a crescent and two sparkles in the middle. */
export function Divider(props: FlexProps) {
  return (
    <Flex align="center" gap="3" color="ember.300" opacity=".7" aria-hidden="true" {...props}>
      <Box flex="1" h="1px" bgGradient="to-r" gradientFrom="transparent" gradientTo="ember.700" />
      <Sparkle size={7} />
      <Crescent size={14} />
      <Sparkle size={7} />
      <Box flex="1" h="1px" bgGradient="to-l" gradientFrom="transparent" gradientTo="ember.700" />
    </Flex>
  )
}
