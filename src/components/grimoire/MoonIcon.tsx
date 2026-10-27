// The Moon as it looks that day: the lit part drawn from the cycle, waxing on the right (as seen
// from the north), the dark part a faint disc so a new moon is still a shape.
import { moonCycle } from '../../grimoire/wheel'
import type { DayKey } from '../../grimoire/types'

export function MoonIcon({ day, size = 14, lit = 'currentColor', dark = 'rgba(255,255,255,.12)' }: { day: DayKey; size?: number; lit?: string; dark?: string }) {
  const c = moonCycle(day)
  const r = 10
  // The terminator is a half-ellipse: its width goes r → 0 → r from new to quarter to full.
  const rx = Math.abs(Math.cos(c * 2 * Math.PI)) * r
  const waxing = c < 0.5
  // Lit limb: the right half while waxing, the left one while waning.
  const limb = waxing ? 1 : 0
  // Crescent: the terminator bulges toward the lit limb; gibbous: away from it.
  const gibbous = c > 0.25 && c < 0.75
  const term = waxing === gibbous ? 1 : 0
  const d = `M12 2A${r} ${r} 0 0 ${limb} 12 22A${rx} ${r} 0 0 ${term} 12 2Z`
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block' }}>
      <circle cx="12" cy="12" r={r} fill={dark} />
      {c > 0.02 && c < 0.98 && <path d={d} fill={lit} />}
    </svg>
  )
}
