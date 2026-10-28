// The cycle from her own marks: the length of the cycle and of a period by the last six cycles (28
// and 5 days, «примерно», until there are three), the phase of any day, the next start. A hint from
// her data, not a medical forecast.
import { addDays, daysBetween } from './days.ts'
import type { CycleEntry, DayKey } from './types.ts'

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal'

export const cyclePhases: Record<CyclePhase, { name: string; short: string; during: string; color: string }> = {
  menstrual: { name: 'менструальная', short: 'менстр.', during: 'в менструальную фазу', color: '#c2566b' },
  follicular: { name: 'фолликулярная', short: 'фоллик.', during: 'в фолликулярную фазу', color: '#7fae6a' },
  ovulation: { name: 'овуляция', short: 'овуляция', during: 'в овуляцию', color: '#e0b04f' },
  luteal: { name: 'лютеиновая', short: 'лютеин.', during: 'в лютеиновую фазу', color: '#8a7bb8' },
}
export const phaseOrder: CyclePhase[] = ['menstrual', 'follicular', 'ovulation', 'luteal']

export const cycleSymptoms: { key: string; label: string }[] = [
  { key: 'pain', label: 'боль' },
  { key: 'tired', label: 'усталость' },
  { key: 'sweet', label: 'тяга к сладкому' },
  { key: 'mood', label: 'перепады настроения' },
  { key: 'head', label: 'голова' },
  { key: 'sleep', label: 'плохо сплю' },
]

const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)

/** The periods by start, oldest first. */
export const periodsOf = (cycles: Record<string, CycleEntry>) => Object.values(cycles).sort((a, b) => a.start.localeCompare(b.start))

export interface CycleStats {
  /** Cycle length in days, and a period's. */
  length: number
  period: number
  /** Fewer than three whole cycles: the 28 days are a guess. */
  approx: boolean
  /** Whole cycles seen (between starts). */
  cycles: number
}

export function cycleStats(cycles: Record<string, CycleEntry>): CycleStats {
  const ps = periodsOf(cycles)
  const lengths = ps
    .slice(1)
    .map((p, i) => daysBetween(ps[i].start, p.start))
    // A gap of months is a missed mark, not a cycle.
    .filter((n) => n >= 15 && n <= 60)
    .slice(-6)
  const periods = ps
    .filter((p) => p.end)
    .map((p) => daysBetween(p.start, p.end!) + 1)
    .filter((n) => n >= 1 && n <= 12)
    .slice(-6)
  const approx = lengths.length < 3
  return { length: approx ? 28 : avg(lengths), period: periods.length ? avg(periods) : 5, approx, cycles: lengths.length }
}

/** The phase of day `n` (1-based) in a cycle: the ovulation two weeks before the next start. */
export function phaseOfDay(n: number, s: Pick<CycleStats, 'length' | 'period'>): CyclePhase {
  const ovu = Math.max(s.period + 2, s.length - 14)
  if (n <= s.period) return 'menstrual'
  if (n < ovu - 1) return 'follicular'
  if (n <= ovu + 1) return 'ovulation'
  return 'luteal'
}

export interface CycleDay {
  /** Day of the cycle, 1-based. */
  n: number
  phase: CyclePhase
  /** Past the last marked start by more than a cycle: a predicted cycle, not a marked one. */
  predicted: boolean
  approx: boolean
  start: DayKey
  nextStart: DayKey
}

/** Where a day falls; nothing before the first marked period. */
export function cycleDay(cycles: Record<string, CycleEntry>, day: DayKey, stats = cycleStats(cycles)): CycleDay | undefined {
  const ps = periodsOf(cycles).filter((p) => p.start <= day)
  const last = ps.at(-1)
  if (!last) return undefined
  const since = daysBetween(last.start, day)
  // A later start that is already marked closes this cycle; otherwise cycles roll on by the average.
  const k = Math.floor(since / stats.length)
  const start = addDays(last.start, k * stats.length)
  const n = daysBetween(start, day) + 1
  // A marked end wins over the usual length of a period, longer or shorter.
  const phase = k === 0 && last.end ? (day <= last.end ? 'menstrual' : phaseOfDay(Math.max(n, stats.period + 1), stats)) : phaseOfDay(n, stats)
  return { n, phase, predicted: k > 0, approx: stats.approx, start, nextStart: addDays(start, stats.length) }
}

/** The period going on today, if one is marked without an end. */
export const openPeriod = (cycles: Record<string, CycleEntry>) => periodsOf(cycles).filter((p) => !p.end).at(-1)
