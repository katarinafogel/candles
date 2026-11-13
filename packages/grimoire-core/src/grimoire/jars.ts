// A jar's plan: with a date — how much a week is still needed; without — when the current pace
// (the last 8 weeks) fills it. Real money: the app only counts it, never touches it.
import { addDays, daysBetween } from './days.ts'
import type { DayKey, Jar, JarTx } from './types.ts'

export const money = (n: number, currency = '₽') => `${Math.round(n).toLocaleString('ru')} ${currency}`

export function jarPlan(j: Jar, txs: JarTx[], today: DayKey) {
  const mine = txs.filter((x) => x.jarId === j.id)
  const balance = mine.reduce((a, x) => a + x.amount, 0)
  const need = Math.max(0, j.goal - balance)
  const pct = j.goal > 0 ? Math.min(100, (balance / j.goal) * 100) : 0
  if (!need) return { balance, need, pct, text: 'Собрано!' }
  if (j.targetDate) {
    const weeks = Math.max(1, Math.ceil(daysBetween(today, j.targetDate) / 7))
    const late = j.targetDate < today
    return { balance, need, pct, perWeek: Math.ceil(need / weeks), text: late ? `Срок прошёл, осталось ${money(need, j.currency)}` : `Откладывать ${money(Math.ceil(need / weeks), j.currency)} в неделю — успеешь к сроку` }
  }
  const from = addDays(today, -56)
  const put = mine.filter((x) => x.amount > 0 && x.at.slice(0, 10) >= from).reduce((a, x) => a + x.amount, 0)
  const perWeek = put / 8
  if (perWeek <= 0) return { balance, need, pct, text: 'Пока без темпа: пополнений за 8 недель не было' }
  const when = addDays(today, Math.ceil((need / perWeek) * 7))
  return { balance, need, pct, perWeek, when, text: `При нынешнем темпе (${money(perWeek, j.currency)} в неделю) соберёшь к ${when.slice(8)}.${when.slice(5, 7)}.${when.slice(0, 4)}` }
}
