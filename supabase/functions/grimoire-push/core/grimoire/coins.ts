// GENERATED from src/grimoire/coins.ts by scripts/sync-agent-core.mjs — edit the original, then run: node scripts/sync-agent-core.mjs
// Coins: the nastier the deed, the bigger the reward.
//   coins = base · stars · (1 + dreadFactor · dread) + bonuses
// The balance is never stored: it is the sum of the coin journal (coin_tx), so offline edits on two
// devices can't lose a payment, and undoing a deed writes a reverse entry.
import { dueDay } from './days.ts'
import type { CoinRules, CoinTx, DayKey, Task } from './types.ts'

export const defaultCoinRules: CoinRules = {
  base: 10,
  dreadFactor: 0.5,
  onTimeBonus: 5,
  complexBonus: 20,
  projectBonus: 50,
  streakBonus: [
    { days: 7, coins: 15 },
    { days: 30, coins: 60 },
    { days: 100, coins: 200 },
  ],
  startedCoins: 2,
  wishBonus: 30,
  frogFactor: 1.5,
}

/** A frog is a deed she really does not want to do, or keeps putting off; it stays one until done. */
export const isFrog = (t: Pick<Task, 'frog'>) => t.frog === 'auto' || t.frog === 'manual'

/** The formula part only: base · stars · (1 + dreadFactor · dread), times frogFactor for a frog (rounded up). */
export function baseCoins(t: Pick<Task, 'stars' | 'dread' | 'frog'>, r: CoinRules = defaultCoinRules) {
  const plain = Math.round(r.base * t.stars * (1 + r.dreadFactor * t.dread))
  return isFrog(t) ? Math.ceil(plain * (r.frogFactor ?? defaultCoinRules.frogFactor)) : plain
}

/** Done before (or on the day of) a real deadline. */
export const isOnTime = (t: Pick<Task, 'dueAt'>, day: DayKey) => {
  const due = dueDay(t.dueAt)
  return !!due && day <= due
}

export interface CoinBreakdown {
  base: number
  onTime: number
  extra: number
  total: number
}

/** What closing a task pays. A joy pays like a deed: it is still something you made happen. */
export function taskCoins(t: Task, day: DayKey, r: CoinRules = defaultCoinRules, partial = false): CoinBreakdown {
  const base = partial ? Math.round(baseCoins(t, r) / 2) : baseCoins(t, r)
  const onTime = !partial && isOnTime(t, day) ? r.onTimeBonus : 0
  const extra = partial ? 0 : (t.extraCoins ?? 0)
  return { base, onTime, extra, total: base + onTime + extra }
}

export const balance = (txs: Record<string, CoinTx>) => Object.values(txs).reduce((s, x) => s + x.amount, 0)

/** Net coins already paid for one reference (a task, a habit): payments minus reversals. */
export const paidFor = (txs: Record<string, CoinTx>, refId: string) =>
  Object.values(txs).reduce((s, x) => (x.refId === refId ? s + x.amount : s), 0)

export const dayCoins = (txs: Record<string, CoinTx>, day: DayKey) =>
  Object.values(txs).reduce((s, x) => (x.day === day ? s + x.amount : s), 0)
