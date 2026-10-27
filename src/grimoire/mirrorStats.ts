// The mirror's analytics: plain counts over her own entries, no verdicts. Every view answers one
// question («в какое время чаще страх?»), and none of it is shown until there are enough marks.
import { addDays } from './days.ts'
import { emotionWords, petalOrder, wordPetals, type Petal } from './emotions.ts'
import type { DayKey, GrimoireState, JournalEntry, Sabbat, Task } from './types.ts'
import { moonPhase, sabbatOrder, wheelNow } from './wheel.ts'
import { isFrog } from './coins.ts'

/** Fewer marks than this in a period — «пока мало записей». */
export const minMarks = 10

export type PetalCounts = Record<Petal, number>

const zero = (): PetalCounts => Object.fromEntries(petalOrder.map((p) => [p, 0])) as PetalCounts

/** A mixed feeling counts for both of its petals. */
export function countPetals(entries: JournalEntry[]): PetalCounts {
  const n = zero()
  for (const e of entries) for (const k of e.words ?? []) for (const p of wordPetals(k)) n[p]++
  return n
}

export const total = (c: PetalCounts) => petalOrder.reduce((a, p) => a + c[p], 0)
export const marksIn = (entries: JournalEntry[]) => entries.reduce((a, e) => a + (e.words?.length ?? 0), 0)
export const inDays = (entries: JournalEntry[], from: DayKey, to: DayKey) => entries.filter((e) => e.day >= from && e.day <= to)

/** Rows of «label → petals», in a fixed order, empty rows dropped. */
function grouped<K extends string>(entries: JournalEntry[], keyOf: (e: JournalEntry) => K | K[] | undefined, order: K[]) {
  const by = new Map<K, JournalEntry[]>()
  for (const e of entries) {
    if (!e.words?.length) continue
    const ks = keyOf(e)
    for (const k of Array.isArray(ks) ? ks : ks ? [ks] : []) by.set(k, [...(by.get(k) ?? []), e])
  }
  return order.filter((k) => by.has(k)).map((k) => ({ key: k, counts: countPetals(by.get(k)!), entries: by.get(k)! }))
}

export const dayParts = [
  { key: 'night', label: 'ночь', from: 0 },
  { key: 'morning', label: 'утро', from: 6 },
  { key: 'day', label: 'день', from: 12 },
  { key: 'evening', label: 'вечер', from: 18 },
] as const
export type DayPart = (typeof dayParts)[number]['key']

export const partOf = (iso: string): DayPart => {
  const h = new Date(iso).getHours()
  return h < 6 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'day' : 'evening'
}

/** Ритм дня: which petals at which time of day. */
export const rhythm = (entries: JournalEntry[]) => grouped(entries, (e) => partOf(e.at), dayParts.map((p) => p.key))

/** A deed she dreaded: a frog or a «чудовище». */
export const isHard = (t: Pick<Task, 'frog' | 'dread'>) => isFrog(t) || t.dread >= 3

/**
 * Дела и чувства: for the hard deeds, the words before the start against the words after «Сделала»;
 * and which tags fear and disgust come to before a start.
 */
export function deedsAndFeelings(g: Pick<GrimoireState, 'tasks'>, entries: JournalEntry[]) {
  const before = entries.filter((e) => e.taskId && e.source === 'task_start')
  const after = entries.filter((e) => e.taskId && (e.type === 'taskFeedback' || e.source === 'task_done'))
  const hard = (e: JournalEntry) => !!g.tasks[e.taskId!] && isHard(g.tasks[e.taskId!])
  const tags = new Map<string, number>()
  for (const e of before) {
    const t = g.tasks[e.taskId!]
    const dark = (e.words ?? []).some((k) => wordPetals(k).some((p) => p === 'fear' || p === 'disgust'))
    if (t && dark) for (const tag of t.tags ?? []) tags.set(tag, (tags.get(tag) ?? 0) + 1)
  }
  return {
    before: countPetals(before.filter(hard)),
    after: countPetals(after.filter(hard)),
    tags: [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
  }
}

/**
 * Саботаж: the words written on the days a deed was postponed, before the postponement — against all
 * the words of the period. Only a coincidence, never a cause.
 */
export function postponeFeelings(g: Pick<GrimoireState, 'tasks'>, entries: JournalEntry[], from: DayKey, to: DayKey) {
  const moves = Object.values(g.tasks).flatMap((t) => t.postponements.filter((p) => p.day >= from && p.day <= to))
  const near = entries.filter((e) => moves.some((m) => m.day === e.day && e.at <= m.at))
  return { moves: moves.length, near: countPetals(near), all: countPetals(entries) }
}

/** Люди: which petals come with whom (people tied through «+» or @). */
export function peopleFeelings(entries: JournalEntry[], names: Record<string, { name: string }>) {
  const ids = [...new Set(entries.flatMap((e) => e.people ?? []))].filter((id) => names[id])
  return grouped(entries, (e) => e.people?.filter((id) => names[id]), ids).sort((a, b) => total(b.counts) - total(a.counts))
}

/** Колесо года: petals by the segment of the wheel the day fell into. */
export const bySabbat = (entries: JournalEntry[], hemisphere: 'north' | 'south') =>
  grouped<Sabbat>(entries, (e) => wheelNow(e.day, hemisphere).current.sabbat, sabbatOrder)

export const moonGroups = [
  { key: 'new', label: 'новолуние', phases: [0] },
  { key: 'waxing', label: 'растущая', phases: [1, 2, 3] },
  { key: 'full', label: 'полнолуние', phases: [4] },
  { key: 'waning', label: 'убывающая', phases: [5, 6, 7] },
] as const
type MoonGroup = (typeof moonGroups)[number]['key']

export const byMoon = (entries: JournalEntry[]) =>
  grouped<MoonGroup>(entries, (e) => moonGroups.find((m) => (m.phases as readonly number[]).includes(moonPhase(e.day)))!.key, moonGroups.map((m) => m.key))

/** «Что влияет»: petals and the mean energy next to each factor. */
export function byFactor(entries: JournalEntry[], factorKeys: string[]) {
  return factorKeys
    .map((k) => {
      const xs = entries.filter((e) => e.factors?.includes(k))
      const en = xs.filter((e) => e.energy).map((e) => e.energy!)
      return { key: k, count: xs.length, counts: countPetals(xs), energy: en.length ? en.reduce((a, b) => a + b, 0) / en.length : undefined }
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
}

/** Словарный запас: different words over the last 30 days, and how many were weak or strong, not middle. */
export function vocabulary(entries: JournalEntry[], today: DayKey) {
  const span = (from: DayKey, to: DayKey) => {
    const ws = inDays(entries, from, to).flatMap((e) => e.words ?? [])
    const petalWords = ws.filter((k) => emotionWords[k]?.intensity)
    const precise = petalWords.filter((k) => emotionWords[k].intensity !== 2).length
    return { distinct: new Set(ws).size, marks: ws.length, precise: petalWords.length ? precise / petalWords.length : undefined }
  }
  return { now: span(addDays(today, -29), today), before: span(addDays(today, -59), addDays(today, -30)) }
}

const cell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * The mirror as CSV, one row per entry: words by name and by key, petals, energy, factors and the «+»
 * details. Semicolons, with a BOM, so a Russian Excel opens it as it is.
 */
export function mirrorCsv(g: Pick<GrimoireState, 'journal' | 'tasks'>, people: Record<string, { name: string }>, labels: { factor: (k: string) => string; body: (k: string) => string; action: (k: string) => string }) {
  const head = ['время', 'день', 'тип', 'откуда', 'слова', 'ключи слов', 'лепестки', 'энергия', 'что влияет', 'где в теле', 'что случилось', 'что сделаю', 'дело', 'люди', 'сложность на деле', 'нехотение на деле', 'получилось', 'отложила', 'благодарна', 'запись', 'теги']
  const rows = Object.values(g.journal)
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((e) => [
      e.at,
      e.day,
      e.type,
      e.source,
      (e.words ?? []).map((k) => emotionWords[k]?.word ?? k).join(', '),
      (e.words ?? []).join(', '),
      [...new Set((e.words ?? []).flatMap(wordPetals))].join(', '),
      e.energy,
      (e.factors ?? []).map(labels.factor).join(', '),
      (e.bodyZones ?? []).map(labels.body).join(', '),
      e.trigger,
      e.action && labels.action(e.action),
      e.taskId && g.tasks[e.taskId]?.title,
      (e.people ?? []).map((id) => people[id]?.name).filter(Boolean).join(', '),
      e.realStars,
      e.realDread,
      e.wentWell,
      e.putOff,
      e.grateful,
      e.text,
      (e.tags ?? []).join(', '),
    ])
  return '﻿' + [head, ...rows].map((r) => r.map(cell).join(';')).join('\r\n')
}
