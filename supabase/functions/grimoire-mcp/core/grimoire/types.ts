// GENERATED from src/grimoire/types.ts by scripts/sync-agent-core.mjs — edit the original, then run: node scripts/sync-agent-core.mjs
// Grimoire of deeds: the personal planner that lives next to the workshop (see the «Гримуар дел» spec).
// Every entity is a row of the same `entities` table as the workshop, with its own `kind`.

/** Calendar day of the grimoire, YYYY-MM-DD, counted with the day boundary from the settings. */
export type DayKey = string
export type ISODateTime = string

export type TaskType = 'deed' | 'joy'
export type TaskSlot = 'main' | 'extra' | 'optional'
export type Want = 'want' | 'need' | 'unsure'
export type TaskOwnerKind = 'mine' | 'person' | 'work' | 'other'
export type TaskStatus = 'open' | 'inProgress' | 'partial' | 'waiting' | 'done' | 'cancelled'
export type TaskSource = 'manual' | 'project' | 'habit' | 'wish' | 'wheel' | 'workshop'
export type Repeat =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: number[] } // 1 = Monday … 7 = Sunday
  | { kind: 'everyN'; n: number }
  | { kind: 'monthly' }

export type PostponeReason =
  | 'unclear'
  | 'tooBig'
  | 'unpleasant'
  | 'hardToDecide'
  | 'needTalk'
  | 'noPlace'
  | 'noEnergy'
  | 'dontKnow'

export interface Postponement {
  at: ISODateTime
  /** The grimoire day the task was moved away from. */
  day: DayKey
  to?: DayKey
  reason?: PostponeReason
}

export interface Task {
  id: string
  title: string
  note?: string
  type: TaskType
  /** A real deadline only: date, optionally with time (YYYY-MM-DD or YYYY-MM-DDTHH:mm). */
  dueAt?: string
  /** The day it is chosen for. Empty means the task waits in the backlog. */
  doOn?: DayKey
  slot?: TaskSlot
  stars: 1 | 2 | 3
  dread: 0 | 1 | 2 | 3
  want?: Want
  ownerKind?: TaskOwnerKind
  why?: string[]
  whyText?: string
  costs?: string[]
  enough?: string
  stopAt?: string
  ifStuck?: string
  prep?: string[]
  wrapUp?: string[]
  estimateMin?: number
  zone?: string
  tags: string[]
  personIds?: string[]
  rewardText?: string
  /** Coins added by hand on top of the formula. */
  extraCoins?: number
  repeat?: Repeat
  /** The first task of a repeating series; every repeat points to it. */
  repeatOf?: string
  status: TaskStatus
  partialNote?: string
  waitUntil?: DayKey
  blockedBy?: string[]
  /** The task this one grew out of («потянуло за собой»). */
  spawnedFrom?: string
  source: TaskSource
  projectId?: string
  parentId?: string
  habitId?: string
  wishId?: string
  practiceId?: string
  createdAt: ISODateTime
  doneAt?: ISODateTime
  doneDay?: DayKey
  /** «Начать понемногу» was paid for this task already. */
  startedPaid?: boolean
  postponements: Postponement[]
  /** Postponements that count for the frog: later days and morning-review returns; reset when unfrogged. */
  postponeCount?: number
  /** A frog: set by the rules (`auto`), by hand (`manual`), or taken off by hand (`off`). */
  frog?: 'auto' | 'manual' | 'off'
  /** «Съесть сегодня»: the day this frog is promised for. */
  eatOn?: DayKey
  /** Reminded even in the навь (a real date that must not be missed). */
  evenInNav?: boolean
  /** «Чистый лист»: put into the «разобрать потом» pack on this day; cleared once it is planned again. */
  later?: DayKey
  order?: number
}

export interface Project {
  id: string
  title: string
  description?: string
  sigil?: string
  color?: string
  targetDate?: DayKey
  status: 'active' | 'paused' | 'done' | 'archived'
  jarId?: string
  createdAt: ISODateTime
  doneAt?: ISODateTime
}

export type HabitSchedule = { kind: 'daily' } | { kind: 'weekdays'; days: number[] } | { kind: 'timesPerWeek'; n: number }

export interface Habit {
  id: string
  title: string
  sigil?: string
  schedule: HabitSchedule
  /** check: done or not; count: a number with a goal (8 glasses, 20 pages). */
  mark: { kind: 'check' } | { kind: 'count'; goal: number; unit?: string }
  stars: 1 | 2 | 3
  dread: 0 | 1 | 2 | 3
  activeFrom?: DayKey
  activeTo?: DayKey
  status: 'active' | 'paused' | 'archived'
  /** Extra shields bought with coins, on top of one free skip a week. */
  shields: number
  /** Streak milestones already paid, so a bonus is never paid twice. */
  paidMilestones?: number[]
  jarId?: string
  createdAt: ISODateTime
}

export interface HabitLog {
  id: string // habitId:YYYY-MM-DD
  habitId: string
  date: DayKey
  value: number
  skipped?: boolean
}

export type Sabbat = 'samhain' | 'yule' | 'imbolc' | 'ostara' | 'beltane' | 'litha' | 'lughnasadh' | 'mabon'

/** A sabbat's correspondences, as on a card. */
export interface SabbatCard {
  meaning: string
  colors: string
  herbs: string
  stones: string
  symbols: string
  food: string
}

export interface WheelPractice {
  id: string
  title: string
  description?: string
  steps?: string[]
  /** A sabbat's segment, or `esbat` — a full moon, the small holiday that comes every month. */
  sabbat: Sabbat | 'esbat'
  /** On the sabbat day, as a habit of the whole segment, or once during the segment. */
  mode: 'day' | 'segment' | 'once'
  /** A household seasonal deed (spring cleaning, preserves) rather than a practice. */
  seasonal?: boolean
  source?: string
  builtIn?: boolean
  hidden?: boolean
}

export interface CoinTx {
  id: string
  at: ISODateTime
  day: DayKey
  amount: number
  reason: string
  /** What the entry is for; `undo` entries reverse an earlier payment for the same ref. */
  tag: 'done' | 'partial' | 'started' | 'complex' | 'project' | 'streak' | 'undo' | 'manual' | 'journal' | 'wish'
  refKind?: 'task' | 'habit' | 'wish' | 'jar' | 'journal' | 'project' | 'manual'
  refId?: string
}

/** Kept for the later stages; the MVP only stores and syncs them. */
export interface Wish {
  id: string
  title: string
  description?: string
  tags: string[]
  price?: number
  status: 'dream' | 'inProgress' | 'fulfilled' | 'released'
  createdAt: ISODateTime
  fulfilledAt?: ISODateTime
  fulfilledNote?: string
  /** Where it lives: a shop page, a place, a post. */
  url?: string
  taskId?: string
  projectId?: string
  jarId?: string
  practiceId?: string
  sabbat?: Sabbat
}

/**
 * A mirror entry: words from the emotion dictionary (see emotions.ts), energy, «что влияет», a text —
 * any of them, at least one. The evening page and «как далось?» are entries too.
 */
export interface JournalEntry {
  id: string
  /** When it was felt: now by default, can be moved back. */
  at: ISODateTime
  day: DayKey
  /** Up to three dictionary keys in order: «anger.1», «dyad.awe». */
  words?: string[]
  energy?: number
  /** Keys of `mirrorFactors`. */
  factors?: string[]
  text?: string
  tags?: string[]
  type: 'entry' | 'taskFeedback' | 'evening'
  /** Where it was written from. */
  source?: 'mirror' | 'task_start' | 'task_done' | 'evening' | 'assistant'
  /** The «+» details: where in the body, what happened, what to do about it, who was there. */
  bodyZones?: string[]
  trigger?: string
  action?: string
  people?: string[]
  taskId?: string
  /** «Как далось?»: real difficulty and dread, compared with what was set when the task was made. */
  realStars?: number
  realDread?: number
  /** Evening page answers. */
  wentWell?: string
  putOff?: string
  grateful?: string
}

export interface Jar {
  id: string
  title: string
  goal: number
  currency: string
  targetDate?: DayKey
  status: 'saving' | 'collected' | 'spent' | 'closed'
  wishId?: string
  projectId?: string
}

export interface JarTx {
  id: string
  jarId: string
  at: ISODateTime
  amount: number
  note?: string
}

export interface CoinRules {
  base: number
  dreadFactor: number
  onTimeBonus: number
  complexBonus: number
  projectBonus: number
  streakBonus: { days: number; coins: number }[]
  startedCoins: number
  wishBonus: number
  /** A frog pays the formula times this, rounded up. */
  frogFactor: number
}

export interface NavPeriod {
  from: ISODateTime
  to?: ISODateTime
}

export interface GrimoireMeta {
  coins: CoinRules
  /** Hour (0–23) when «today» ends, for owls: 4 means the day lasts until 4:00. */
  dayBoundaryHour: number
  /** The owner's time zone (IANA), saved by the app, so the agent counts days the same way. */
  timeZone?: string
  hemisphere: 'north' | 'south'
  planLimit: { main: number; extra: number; optional: number }
  /** How many stars of difficulty a day's plan holds comfortably (0 — no limit shown). */
  dayStars: number
  streaksOn: boolean
  timersOn: boolean
  /** Game words (свиток, квест, ритуал) or plain ones. */
  gameWords: boolean
  zones: string[]
  tagColors: Record<string, string>
  /** This many postponements make a deed a frog. */
  frogPostpones: number
  /** How a done deed is answered: the praise in the toast and the spark that flies to the coins. */
  tone: { praise: 'quiet' | 'normal' | 'warm'; motion: 'off' | 'soft' | 'bright' }
  /** Sabbat cards: the text is the witch's own tradition, so it is editable. */
  sabbatNotes: Partial<Record<Sabbat, string>>
  /** Her own correspondences of a sabbat, field by field; an empty field shows the built-in one. */
  sabbatCards: Partial<Record<Sabbat, Partial<SabbatCard>>>
  /** «Уйти в навь»; `agent` — what the assistant sends meanwhile: a soft «я тут» or nothing at all. */
  nav: { active: boolean; since?: ISODateTime; history: NavPeriod[]; agent?: 'hello' | 'silent' }
  /** Last day the habit tasks were generated for, so it happens once a day. */
  habitsGeneratedFor?: DayKey
  /** Last day the morning review was finished or skipped. */
  reviewedDay?: DayKey
  /** The last day the grimoire was opened, and how many days passed before it (for the welcome back). */
  lastSeenDay?: DayKey
  awayDays?: number
  /** The welcome back was seen (or the clean slate taken) on this day. */
  welcomedDay?: DayKey
  /** Built-in practices were added once; deleting them later must not bring them back. */
  practicesSeeded?: boolean
  /** The built-in esbat practices came later: added once to grimoires seeded before them. */
  esbatsSeeded?: boolean
}

export interface GrimoireState {
  tasks: Record<string, Task>
  projects: Record<string, Project>
  habits: Record<string, Habit>
  habitLogs: Record<string, HabitLog>
  wishes: Record<string, Wish>
  practices: Record<string, WheelPractice>
  journal: Record<string, JournalEntry>
  jars: Record<string, Jar>
  jarTxs: Record<string, JarTx>
  coinTxs: Record<string, CoinTx>
  meta: GrimoireMeta
}
