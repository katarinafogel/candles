// The 78 cards of a tarot deck, by key, for picking the card she drew from a real deck. Meanings
// are not built in: hers accumulate in the readings (the card's page shows what she wrote before).
import type { TarotReading } from './types.ts'

export interface TarotCard {
  key: string
  name: string
  arcana: 'major' | 'minor'
  suit?: 'wands' | 'cups' | 'swords' | 'pentacles'
}

const major = [
  'Шут', 'Маг', 'Верховная Жрица', 'Императрица', 'Император', 'Иерофант', 'Влюблённые', 'Колесница', 'Сила', 'Отшельник', 'Колесо Фортуны',
  'Справедливость', 'Повешенный', 'Смерть', 'Умеренность', 'Дьявол', 'Башня', 'Звезда', 'Луна', 'Солнце', 'Суд', 'Мир',
]

export const suits = { wands: 'Жезлов', cups: 'Кубков', swords: 'Мечей', pentacles: 'Пентаклей' } as const
export const suitNames = { wands: 'Жезлы', cups: 'Кубки', swords: 'Мечи', pentacles: 'Пентакли' } as const
const ranks = ['Туз', 'Двойка', 'Тройка', 'Четвёрка', 'Пятёрка', 'Шестёрка', 'Семёрка', 'Восьмёрка', 'Девятка', 'Десятка', 'Паж', 'Рыцарь', 'Королева', 'Король']

export const tarotCards: TarotCard[] = [
  ...major.map((name, i) => ({ key: `m${i}`, name: `${toRoman(i)} ${name}`, arcana: 'major' as const })),
  ...(Object.keys(suits) as (keyof typeof suits)[]).flatMap((suit) =>
    ranks.map((r, i) => ({ key: `${suit}${i + 1}`, name: `${r} ${suits[suit]}`, arcana: 'minor' as const, suit })),
  ),
]

export const cardByKey: Record<string, TarotCard> = Object.fromEntries(tarotCards.map((c) => [c.key, c]))

export const cardName = (key: string) => cardByKey[key]?.name ?? key

function toRoman(n: number) {
  if (n === 0) return '0'
  const map: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let out = ''
  for (const [v, s] of map)
    while (n >= v) {
      out += s
      n -= v
    }
  return out
}

/** Built-in layouts; her own ones live in meta.tarotLayouts. */
export const tarotLayouts: { name: string; positions: string[] }[] = [
  { name: '3 карты', positions: ['Прошлое', 'Настоящее', 'Будущее'] },
  { name: 'Ситуация · совет · итог', positions: ['Ситуация', 'Совет', 'Итог'] },
  {
    name: 'Кельтский крест',
    positions: ['Ситуация', 'Препятствие', 'Основа', 'Прошлое', 'Возможное', 'Ближайшее будущее', 'Я', 'Окружение', 'Надежды и страхи', 'Итог'],
  },
]

/** Every time a card came up, newest first: the reading and the card as it lay. */
export function cardHistory(readings: Record<string, TarotReading>, key: string) {
  return Object.values(readings)
    .flatMap((r) => r.cards.filter((c) => c.card === key).map((c) => ({ reading: r, pick: c })))
    .sort((a, b) => b.reading.day.localeCompare(a.reading.day) || b.reading.createdAt.localeCompare(a.reading.createdAt))
}
