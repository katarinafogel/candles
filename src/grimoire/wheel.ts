// Wheel of the year: eight sabbats split the year into eight segments. Solstices and equinoxes are
// computed astronomically (Meeus, «Astronomical Algorithms», ch. 27, accurate to minutes), the
// cross-quarter days are fixed dates. In the southern hemisphere the wheel turns half a year.
import { addDays, dayKey, daysBetween } from './days.ts'
import type { DayKey, Sabbat, SabbatCard, WheelPractice } from './types.ts'

export const sabbatOrder: Sabbat[] = ['samhain', 'yule', 'imbolc', 'ostara', 'beltane', 'litha', 'lughnasadh', 'mabon']

export interface SabbatInfo {
  name: string
  /** «до Самайна». */
  genitive: string
  /** «подготовиться к Самайну». */
  dative: string
  theme: string
  /** Sector color on the wheel, readable on the dark background. */
  color: string
  symbol: string
}

export const sabbats: Record<Sabbat, SabbatInfo> = {
  samhain: { name: 'Самайн', genitive: 'Самайна', dative: 'Самайну', theme: 'Память предков, завершение, отпускание', color: '#9c5b3c', symbol: '🎃' },
  yule: { name: 'Йоль', genitive: 'Йоля', dative: 'Йолю', theme: 'Возвращение света, отдых, надежда', color: '#5f7f8f', symbol: '🕯' },
  imbolc: { name: 'Имболк', genitive: 'Имболка', dative: 'Имболку', theme: 'Пробуждение, очищение, первые намерения', color: '#b9b2a3', symbol: '🔥' },
  ostara: { name: 'Остара', genitive: 'Остары', dative: 'Остаре', theme: 'Равновесие, начала, посев', color: '#8ea883', symbol: '🌱' },
  beltane: { name: 'Бельтайн', genitive: 'Бельтайна', dative: 'Бельтайну', theme: 'Расцвет, страсть, творчество', color: '#b56a6a', symbol: '🌸' },
  litha: { name: 'Лита', genitive: 'Литы', dative: 'Лите', theme: 'Пик силы, солнце, изобилие', color: '#d9a441', symbol: '☀' },
  lughnasadh: { name: 'Ламмас', genitive: 'Ламмаса', dative: 'Ламмасу', theme: 'Первый урожай, благодарность за труд', color: '#c18a4a', symbol: '🌾' },
  mabon: { name: 'Мабон', genitive: 'Мабона', dative: 'Мабону', theme: 'Второй урожай, итоги, равновесие', color: '#8a6d4b', symbol: '🍂' },
}

/** The built-in correspondences, shown until she writes her own into a field. */
export const sabbatCardDefaults: Record<Sabbat, SabbatCard> = {
  samhain: { meaning: 'Конец года, память предков, тонкая грань между мирами', colors: 'чёрный, оранжевый, тёмно-красный', herbs: 'полынь, розмарин, шалфей', stones: 'обсидиан, оникс, гагат', symbols: 'тыква, свеча, череп, яблоко', food: 'тыква, яблоки, орехи, хлеб' },
  yule: { meaning: 'Самая долгая ночь и возвращение света', colors: 'зелёный, красный, золотой, белый', herbs: 'ель, омела, остролист, корица', stones: 'гранат, рубин, гематит', symbols: 'полено, свечи, вечнозелёный венок', food: 'глинтвейн, пряники, орехи' },
  imbolc: { meaning: 'Пробуждение земли, очищение, первые намерения', colors: 'белый, светло-жёлтый, бледно-зелёный', herbs: 'розмарин, ангелика, базилик', stones: 'аметист, лунный камень, горный хрусталь', symbols: 'свечи Бригид, крест Бригид, подснежник', food: 'молоко, сыр, семена, хлеб' },
  ostara: { meaning: 'Равноденствие, равновесие, посев и начала', colors: 'пастельные: зелёный, жёлтый, розовый', herbs: 'фиалка, нарцисс, жасмин', stones: 'розовый кварц, аквамарин, авантюрин', symbols: 'яйцо, заяц, ростки', food: 'яйца, зелень, мёд' },
  beltane: { meaning: 'Расцвет, страсть, плодородие, творчество', colors: 'красный, белый, зелёный', herbs: 'боярышник, роза, сирень', stones: 'изумруд, малахит, сердолик', symbols: 'майское дерево, венок, костёр', food: 'молоко, мёд, овсяные лепёшки, ягоды' },
  litha: { meaning: 'Солнцестояние, пик силы и света', colors: 'золотой, жёлтый, оранжевый', herbs: 'зверобой, лаванда, ромашка', stones: 'цитрин, янтарь, тигровый глаз', symbols: 'солнце, огонь, венок из трав', food: 'свежие ягоды, мёд, летние овощи' },
  lughnasadh: { meaning: 'Первый урожай, благодарность за труд', colors: 'золотой, оранжевый, коричневый', herbs: 'пшеница, подсолнух, мята', stones: 'цитрин, авантюрин, сердолик', symbols: 'колос, хлеб, серп', food: 'хлеб, зерно, ежевика' },
  mabon: { meaning: 'Равноденствие, второй урожай, итоги и благодарность', colors: 'бордовый, оранжевый, коричневый', herbs: 'шалфей, мирра, листья клёна', stones: 'сапфир, лазурит, жёлтый топаз', symbols: 'рог изобилия, жёлуди, листья', food: 'яблоки, виноград, тыква, вино' },
}

export const sabbatCardFields: { key: keyof SabbatCard; label: string }[] = [
  { key: 'meaning', label: 'Смысл' },
  { key: 'colors', label: 'Цвета' },
  { key: 'herbs', label: 'Травы' },
  { key: 'stones', label: 'Камни' },
  { key: 'symbols', label: 'Символы' },
  { key: 'food', label: 'Еда' },
]

// Meeus table 27.C: periodic terms A, B, C.
const terms: [number, number, number][] = [
  [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186], [182, 27.85, 445267.112],
  [156, 73.14, 45036.886], [136, 171.52, 22518.443], [77, 222.54, 65928.934], [74, 296.72, 3034.906],
  [70, 243.58, 9037.513], [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
  [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417], [18, 155.12, 67555.328],
  [17, 288.79, 4562.452], [16, 198.04, 62894.029], [14, 199.76, 31436.921], [12, 95.39, 14577.848],
  [12, 287.11, 31931.756], [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074],
]

const rad = (deg: number) => (deg * Math.PI) / 180

/** Moment of an equinox or solstice: 0 March, 1 June, 2 September, 3 December. */
export function seasonMoment(year: number, which: 0 | 1 | 2 | 3): Date {
  const y = (year - 2000) / 1000
  const jde0 = [
    2451623.80984 + 365242.37404 * y + 0.05169 * y ** 2 - 0.00411 * y ** 3 - 0.00057 * y ** 4,
    2451716.56767 + 365241.62603 * y + 0.00325 * y ** 2 + 0.00888 * y ** 3 - 0.0003 * y ** 4,
    2451810.21715 + 365242.01767 * y - 0.11575 * y ** 2 + 0.00337 * y ** 3 + 0.00078 * y ** 4,
    2451900.05952 + 365242.74049 * y - 0.06223 * y ** 2 - 0.00823 * y ** 3 + 0.00032 * y ** 4,
  ][which]
  const t = (jde0 - 2451545.0) / 36525
  const w = rad(35999.373 * t - 2.47)
  const dl = 1 + 0.0334 * Math.cos(w) + 0.0007 * Math.cos(2 * w)
  const s = terms.reduce((acc, [a, b, c]) => acc + a * Math.cos(rad(b + c * t)), 0)
  const jde = jde0 + (0.00001 * s) / dl
  // Terrestrial time is about a minute ahead of UTC; it doesn't move the date in practice.
  return new Date((jde - 2440587.5) * 86_400_000 - 69_000)
}

const fixed = (year: number, m: number, d: number): DayKey => `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** Sabbat days of a calendar year in local time. */
export function sabbatDays(year: number, hemisphere: 'north' | 'south' = 'north'): Record<Sabbat, DayKey> {
  const season = (w: 0 | 1 | 2 | 3) => dayKey(seasonMoment(year, w), 0)
  const north: Record<Sabbat, DayKey> = {
    imbolc: fixed(year, 2, 1),
    ostara: season(0),
    beltane: fixed(year, 5, 1),
    litha: season(1),
    lughnasadh: fixed(year, 8, 1),
    mabon: season(2),
    samhain: fixed(year, 10, 31),
    yule: season(3),
  }
  if (hemisphere === 'north') return north
  // Southern wheel: each sabbat falls on its opposite's date.
  return {
    samhain: north.beltane,
    yule: north.litha,
    imbolc: north.lughnasadh,
    ostara: north.mabon,
    beltane: north.samhain,
    litha: north.yule,
    lughnasadh: north.imbolc,
    mabon: north.ostara,
  }
}

export interface SabbatDate {
  sabbat: Sabbat
  day: DayKey
}

/** All sabbats from the year before to the year after, in time order. */
function timeline(year: number, hemisphere: 'north' | 'south'): SabbatDate[] {
  const out: SabbatDate[] = []
  for (const y of [year - 1, year, year + 1]) {
    const d = sabbatDays(y, hemisphere)
    for (const s of sabbatOrder) out.push({ sabbat: s, day: d[s] })
  }
  return out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
}

export interface WheelNow {
  /** The segment we are in: from its sabbat up to the next one. */
  current: SabbatDate
  next: SabbatDate
  daysToNext: number
  /** 0–1: how far the year has turned since Samhain (for the «today» hand). */
  turn: number
}

export function wheelNow(today: DayKey, hemisphere: 'north' | 'south' = 'north'): WheelNow {
  const tl = timeline(+today.slice(0, 4), hemisphere)
  let i = tl.length - 1
  while (i > 0 && tl[i].day > today) i--
  const current = tl[i]
  const next = tl[i + 1]
  // Position on the drawn wheel: each sector is an eighth, filled by the time passed in it.
  const sector = sabbatOrder.indexOf(current.sabbat)
  const within = daysBetween(current.day, today) / Math.max(1, daysBetween(current.day, next.day))
  return { current, next, daysToNext: daysBetween(today, next.day), turn: (sector + within) / 8 }
}

/** The days a segment spans: its sabbat up to the day before the next one. */
export function segmentOf(sabbat: Sabbat, today: DayKey, hemisphere: 'north' | 'south' = 'north') {
  const tl = timeline(+today.slice(0, 4), hemisphere)
  const now = wheelNow(today, hemisphere)
  // The coming or current occurrence of this sabbat.
  const idx = tl.findIndex((x) => x.sabbat === sabbat && x.day >= now.current.day)
  const from = tl[idx]
  const to = tl[idx + 1]
  return { from: from.day, to: addDays(to.day, -1) }
}

// ---------- the Moon ----------

const SYNODIC = 29.530588861

/**
 * Moment of a true new moon (integer k) or full moon (k + 0.5), counted from January 2000 (Meeus,
 * ch. 49, without the planetary terms: within a minute or two).
 */
export function lunarPhaseMoment(k: number): Date {
  const T = k / 1236.85
  const jde = 2451550.09766 + SYNODIC * k + 0.00015437 * T ** 2 - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4
  const E = 1 - 0.002516 * T - 0.0000074 * T ** 2
  const M = rad(2.5534 + 29.1053567 * k - 0.0000014 * T ** 2)
  const Mp = rad(201.5643 + 385.81693528 * k + 0.0107582 * T ** 2)
  const F = rad(160.7108 + 390.67050284 * k - 0.0016118 * T ** 2)
  const O = rad(124.7746 - 1.5637558 * k + 0.0020672 * T ** 2)
  const full = k % 1 !== 0
  const c = full
    ? [-0.40614, 0.17302, 0.01614, 0.01043, 0.00734, -0.00515, 0.00209]
    : [-0.4072, 0.17241, 0.01608, 0.01039, 0.00739, -0.00514, 0.00208]
  const corr =
    c[0] * Math.sin(Mp) +
    c[1] * E * Math.sin(M) +
    c[2] * Math.sin(2 * Mp) +
    c[3] * Math.sin(2 * F) +
    c[4] * E * Math.sin(Mp - M) +
    c[5] * E * Math.sin(Mp + M) +
    c[6] * E * E * Math.sin(2 * M) -
    0.00111 * Math.sin(Mp - 2 * F) -
    0.00057 * Math.sin(Mp + 2 * F) +
    0.00056 * E * Math.sin(2 * Mp + M) -
    0.00042 * Math.sin(3 * Mp) +
    0.00042 * E * Math.sin(M + 2 * F) +
    0.00038 * E * Math.sin(M - 2 * F) -
    0.00024 * E * Math.sin(2 * Mp - M) -
    0.00017 * Math.sin(O)
  // Terrestrial time is about a minute ahead of UTC.
  return new Date((jde + corr - 2440587.5) * 86_400_000 - 69_000)
}

/** Local noon of a day: the moment its Moon is drawn for. */
const noonOf = (day: DayKey) => new Date(`${day}T12:00:00`).getTime()

/** The lunation a day's noon falls in: the new moons around it and its full moon. */
function lunation(day: DayKey) {
  const t = noonOf(day)
  let k = Math.floor((t / 86_400_000 + 2440587.5 - 2451550.09766) / SYNODIC)
  while (lunarPhaseMoment(k).getTime() > t) k--
  while (lunarPhaseMoment(k + 1).getTime() <= t) k++
  return { t, prev: lunarPhaseMoment(k).getTime(), next: lunarPhaseMoment(k + 1).getTime(), full: lunarPhaseMoment(k + 0.5) }
}

/** Age of the Moon in days at noon of the day (0 new … ~14.8 full … ~29.5). */
export function moonAge(day: DayKey) {
  const l = lunation(day)
  return (l.t - l.prev) / 86_400_000
}

/** Share of the cycle passed at noon of the day, 0 new … 0.5 full … 1. */
export function moonCycle(day: DayKey) {
  const l = lunation(day)
  return (l.t - l.prev) / (l.next - l.prev)
}

export const moonPhaseNames = ['новолуние', 'растущий серп', 'первая четверть', 'растущая луна', 'полнолуние', 'убывающая луна', 'последняя четверть', 'убывающий серп']

/** The full moon's own day (the esbat): the local day its moment falls in. */
export const isFullMoon = (day: DayKey) => dayKey(lunation(day).full, 0) === day

const isNewMoon = (day: DayKey) => {
  const l = lunation(day)
  return dayKey(new Date(l.prev), 0) === day || dayKey(new Date(l.next), 0) === day
}

/**
 * Index into moonPhaseNames. The new moon, the full moon and the quarters are one day each, so the
 * scroll never says «полнолуние» on a day the calendar does not mark as the esbat; between them —
 * a crescent or a growing / waning moon.
 */
export function moonPhase(day: DayKey) {
  if (isNewMoon(day)) return 0
  if (isFullMoon(day)) return 4
  const l = lunation(day)
  const c = (l.t - l.prev) / (l.next - l.prev)
  // Half a day, as a share of this cycle.
  const half = (0.5 * 86_400_000) / (l.next - l.prev)
  if (Math.abs(c - 0.25) < half) return 2
  if (Math.abs(c - 0.75) < half) return 6
  return c < 0.25 ? 1 : c < 0.5 ? 3 : c < 0.75 ? 5 : 7
}

/** The nearest full moon on or after `day`. */
export function nextFullMoon(day: DayKey): DayKey {
  let d = day
  for (let i = 0; i < 32 && !isFullMoon(d); i++) d = addDays(d, 1)
  return d
}

// ---------- built-in practices ----------

const p = (sabbat: Sabbat | 'esbat', title: string, mode: WheelPractice['mode'] = 'once', seasonal = false): WheelPractice => ({
  id: `builtin:${sabbat}:${title}`.slice(0, 64),
  sabbat,
  title,
  mode,
  seasonal,
  builtIn: true,
})

/** The starter set from the spec; the witch adds her own and hides what isn't hers. */
export const builtInPractices: WheelPractice[] = [
  p('samhain', 'Алтарь памяти', 'day'),
  p('samhain', 'Немая трапеза', 'day'),
  p('samhain', 'Список того, что отпускаю'),
  p('yule', 'Ночное бдение со свечой', 'day'),
  p('yule', 'Йольское полено', 'day'),
  p('yule', 'Дары близким'),
  p('imbolc', 'Уборка-очищение дома', 'once', true),
  p('imbolc', 'Свечи Бригид', 'day'),
  p('imbolc', 'Намерения на весну'),
  p('ostara', 'Посадить семена', 'once', true),
  p('ostara', 'Расписать яйца', 'day'),
  p('ostara', 'Баланс дел'),
  p('beltane', 'Сплести венок', 'day'),
  p('beltane', 'Костёр или свеча', 'day'),
  p('beltane', 'Творческий проект'),
  p('litha', 'Встретить рассвет', 'day'),
  p('litha', 'Собрать травы', 'once', true),
  p('litha', 'Солнечная вода', 'day'),
  p('lughnasadh', 'Испечь хлеб', 'day'),
  p('lughnasadh', 'Подвести первые итоги проектов'),
  p('mabon', 'Список благодарностей', 'day'),
  p('mabon', 'Заготовки', 'once', true),
  p('mabon', 'Разбор запасов', 'once', true),
  // Esbats: the full moon of every month, a small holiday.
  p('esbat', 'Лунная вода', 'day'),
  p('esbat', 'Очистить кристаллы под луной', 'day'),
  p('esbat', 'Записать и отпустить ненужное', 'day'),
  p('esbat', 'Итоги лунного цикла', 'day'),
  p('esbat', 'Прогулка под полной луной', 'day'),
]
