// Wheel of the year: eight sabbats split the year into eight segments. Solstices and equinoxes are
// computed astronomically (Meeus, «Astronomical Algorithms», ch. 27, accurate to minutes), the
// cross-quarter days are fixed dates. In the southern hemisphere the wheel turns half a year.
import { addDays, dayKey, daysBetween } from './days.ts'
import type { DayKey, Sabbat, WheelPractice } from './types.ts'

export const sabbatOrder: Sabbat[] = ['samhain', 'yule', 'imbolc', 'ostara', 'beltane', 'litha', 'lughnasadh', 'mabon']

export interface SabbatInfo {
  name: string
  /** «подготовиться к Самайну». */
  dative: string
  theme: string
  /** Sector color on the wheel, readable on the dark background. */
  color: string
  symbol: string
}

export const sabbats: Record<Sabbat, SabbatInfo> = {
  samhain: { name: 'Самайн', dative: 'Самайну', theme: 'Память предков, завершение, отпускание', color: '#9c5b3c', symbol: '🎃' },
  yule: { name: 'Йоль', dative: 'Йолю', theme: 'Возвращение света, отдых, надежда', color: '#5f7f8f', symbol: '🕯' },
  imbolc: { name: 'Имболк', dative: 'Имболку', theme: 'Пробуждение, очищение, первые намерения', color: '#b9b2a3', symbol: '🔥' },
  ostara: { name: 'Остара', dative: 'Остаре', theme: 'Равновесие, начала, посев', color: '#8ea883', symbol: '🌱' },
  beltane: { name: 'Белтейн', dative: 'Белтейну', theme: 'Расцвет, страсть, творчество', color: '#b56a6a', symbol: '🌸' },
  litha: { name: 'Лита', dative: 'Лите', theme: 'Пик силы, солнце, изобилие', color: '#d9a441', symbol: '☀' },
  lughnasadh: { name: 'Ламмас', dative: 'Ламмасу', theme: 'Первый урожай, благодарность за труд', color: '#c18a4a', symbol: '🌾' },
  mabon: { name: 'Мабон', dative: 'Мабону', theme: 'Второй урожай, итоги, равновесие', color: '#8a6d4b', symbol: '🍂' },
}

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

const SYNODIC = 29.530588853
const NEW_MOON_2000 = Date.UTC(2000, 0, 6, 18, 14)

/** Age of the Moon in days (0 new … ~14.8 full … 29.5) at noon of the day. */
export function moonAge(day: DayKey) {
  const t = Date.parse(`${day}T12:00:00Z`)
  const age = ((t - NEW_MOON_2000) / 86_400_000) % SYNODIC
  return age < 0 ? age + SYNODIC : age
}

export const moonPhaseNames = ['новолуние', 'растущий серп', 'первая четверть', 'растущая луна', 'полнолуние', 'убывающая луна', 'последняя четверть', 'убывающий серп']

/** Index into moonPhaseNames. */
export const moonPhase = (day: DayKey) => Math.floor(((moonAge(day) / SYNODIC) * 8 + 0.5) % 8)

// ---------- built-in practices ----------

const p = (sabbat: Sabbat, title: string, mode: WheelPractice['mode'] = 'once', seasonal = false): WheelPractice => ({
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
]
