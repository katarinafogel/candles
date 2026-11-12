// Grimoire of deeds: the personal planner that lives next to the workshop (see the «Гримуар дел» spec).
// Every entity is a row of the same `entities` table as the workshop, with its own `kind`.

/** Calendar day of the grimoire, YYYY-MM-DD, counted with the day boundary from the settings. */
export type DayKey = string
export type ISODateTime = string

export type TaskType = 'deed' | 'joy'
/** How urgent a deed is, as in Jira (without Blocker and Trivial); no value means «medium». */
export type TaskPriority = 'highest' | 'high' | 'medium' | 'low' | 'lowest'
/** @deprecated The plan's old parts (главное / дополнительное / необязательное); only read to become a priority. */
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

/** A step of the workshop a deed stands for: a holder's next stage, or a candle's. */
export type WorkshopKind = 'holder' | 'candle'
export interface WorkshopLink {
  kind: WorkshopKind
  /** The item: P-0042 or S-0042. */
  id: string
  /** The step: a holder's target stage (dried, varnishIn, painted, varnishOut, dampers, done, wicked) or a candle's (pour, decorated, ready, given). */
  step: string
  /** Let go by itself — the item went to defects or was deleted; comes back if that is undone. */
  lost?: boolean
}

/** Difficulty, one to three stars. */
export type Stars = 1 | 2 | 3

/** A subtask in a deed's checklist. */
export interface ChecklistItem {
  id: string
  text: string
  done?: boolean
}

export interface Task {
  id: string
  title: string
  /** Put away with its archived book: out of the plan and the backlog until the book comes back. */
  shelved?: boolean
  /** A chain spell's steps still ahead: when this deed is done, the first of them becomes the next deed. */
  chainNext?: SpellStep[]
  note?: string
  checklist?: ChecklistItem[]
  type: TaskType
  /** A real deadline only: date, optionally with time (YYYY-MM-DD or YYYY-MM-DDTHH:mm). */
  dueAt?: string
  /** The day it is chosen for. Empty means the task waits in the backlog. */
  doOn?: DayKey
  /** The time on `doOn` to do it, HH:mm. */
  doAt?: string
  /** No value means «medium». */
  priority?: TaskPriority
  /** @deprecated Read only by priorityOf, for deeds saved before priorities. */
  slot?: TaskSlot
  stars: Stars
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
  /** One item of a workshop deed: ticked by itself when the item takes this step in the workshop. */
  workshop?: WorkshopLink
  /** A workshop deed (the quest over the items): its step, and whether the next one was offered. */
  workshopStep?: { kind: WorkshopKind; step: string; offered?: boolean }
  rewardText?: string
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
  stars: Stars
  dread: 0 | 1 | 2 | 3
  activeFrom?: DayKey
  activeTo?: DayKey
  status: 'active' | 'paused' | 'archived'
  jarId?: string
  /** «Отложить 1000 ₽»: what each tick puts into `jarId`. */
  jarAmount?: number
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
  /** Who it is with or for (people of the workshop's bestiary). */
  personIds?: string[]
  /** After this day the chest asks whether it is still wanted; nothing goes away by itself. */
  relevantUntil?: DayKey
  priority?: TaskPriority
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
  createdAt?: ISODateTime
  tags?: string[]
  personIds?: string[]
}

export interface JarTx {
  id: string
  jarId: string
  at: ISODateTime
  amount: number
  note?: string
  /** Put in by a ritual («отложить 1000 ₽»): its log, so unticking takes it back. */
  habitLogId?: string
}

export interface NavPeriod {
  from: ISODateTime
  to?: ISODateTime
}

export interface GrimoireMeta {
  /** Hour (0–23) when «today» ends, for owls: 4 means the day lasts until 4:00. */
  dayBoundaryHour: number
  /** The owner's time zone (IANA), saved by the app, so the agent counts days the same way. */
  timeZone?: string
  hemisphere: 'north' | 'south'
  /** How many open deeds a day's plan holds before the grimoire asks what to move (0 — no limit). */
  planMax: number
  /** @deprecated The old per-part limits; only read to set planMax once. */
  planLimit?: { main: number; extra: number; optional: number }
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
  /** «С каким чувством берёшься?» and «Как теперь?» at a deed: for none, only frogs and «чудовища», or all. */
  emotionAsk: 'off' | 'hard' | 'all'
  /** From this time (HH:MM) the scroll offers the evening page until the day ends; empty — never. */
  eveningAt: string
  /** Templates («заклинания»): single deeds, quests and chains. */
  spells: Spell[]
  /** Her tarot decks, to note which one a reading was made with. */
  tarotDecks?: string[]
  /** Her own spread layouts: a name and the places of the cards in order. */
  tarotLayouts?: { name: string; positions: string[] }[]
  /** The bestiary's circles: семья, друзья… — an editable list. */
  circles: string[]
  /** Asked on the first sign-in; the cycle can be turned on only for «f». */
  gender?: 'f' | 'm'
  /** The cycle is kept: its mark on the evening page. */
  cycleOn?: boolean
  /** The cycle is shown to the assistant (phase in the morning plan); off — it never leaves the app. */
  cycleToAgent: boolean
  /** «Лёгкий план» taken for this day: the day's stars limit is halved. */
  easyDay?: DayKey
  /**
   * Push notifications (sent by the server to every device she turned them on): the morning plan, the
   * afternoon check, the evening (at `eveningAt`), deadlines and sabbats. An empty time is off.
   */
  notify: { morning: string; afternoon: string; evening: boolean; deadlines: boolean; sabbats: boolean }
  /** How a done deed is answered: the praise in the toast and the buzz of the phone. */
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

/** «Заклинание»: a quest kept as a template — its own marks and its steps in order — to cast again. */
/** One step of a spell (template). */
export interface SpellStep {
  title: string
  stars: Stars
  dread: 0 | 1 | 2 | 3
}

/**
 * «Заклинания» — templates. With no steps it is one deed («вынести мусор»); with steps it is a quest
 * (all the steps at once), or with `chain` a chain: one deed at a time, the next appears when the one
 * before is done (постирать → развесить → снять и разложить).
 */
export interface Spell {
  id: string
  title: string
  stars: Stars
  dread: 0 | 1 | 2 | 3
  tags: string[]
  steps: SpellStep[]
  chain?: boolean
  zone?: string
  /** How many times it was cast: suggestions put the used ones first. */
  uses?: number
  createdAt: ISODateTime
}

/**
 * A long event — a trip, a sick leave. Kind `event`. What happens to the deeds of these days is
 * decided once, when it is created; its days are marked on the scroll and in the calendar.
 */
export interface LifeEvent {
  id: string
  title: string
  sigil?: string
  from: DayKey
  to: DayKey
  note?: string
  createdAt: ISODateTime
}

/** One card on the table: its key from the deck list (tarot.ts), upside down or not, its place in a spread. */
export interface TarotCardPick {
  card: string
  reversed?: boolean
  position?: string
}

/**
 * A reading with a real deck, written down (kind `tarot`): the card of the day or a spread. The app
 * never draws cards itself.
 */
export interface TarotReading {
  id: string
  type: 'day' | 'spread'
  day: DayKey
  deck?: string
  question?: string
  /** A spread's layout name: «3 карты», «Кельтский крест» or her own. */
  layout?: string
  cards: TarotCardPick[]
  meaning?: string
  /** Later: how it went. For the card of the day — asked in the evening. */
  came?: 'yes' | 'partly' | 'no'
  outcome?: string
  createdAt: ISODateTime
}

/** A goal for a calendar year (kind `goal`), tied to what moves it: books, wishes, jars, rituals. */
export interface Goal {
  id: string
  year: number
  title: string
  description?: string
  status: 'active' | 'done' | 'dropped'
  projectIds?: string[]
  wishIds?: string[]
  jarIds?: string[]
  habitIds?: string[]
  createdAt: ISODateTime
  doneAt?: ISODateTime
}

/**
 * A note, a quote, an important moment (kind `note`). With `repeat` it comes back on the scroll, one a
 * day, less and less often while she says «помню»: 1, 3, 7, 21, 60 days.
 */
export interface Note {
  id: string
  text: string
  source?: string
  tags: string[]
  repeat?: boolean
  /** Place on the 1-3-7-21-60 ladder. */
  step?: number
  nextOn?: DayKey
  createdAt: ISODateTime
}

/** A dated line on a person's card: a fact, a scar, a kindness, a question to ask. */
export interface PersonLine {
  id: string
  day: DayKey
  text: string
  /** A scar «отпустила» on this day: kept in the history, gone from the warnings. */
  released?: DayKey
  /** A question already asked on this day. */
  asked?: DayKey
}

/** The dated lists of a person's card. */
export type PersonList = 'gifts' | 'ask' | 'facts' | 'scars' | 'kindness'

/**
 * The bestiary's memo about a workshop person (kind `person_notes`, id = the person's id). Lives in
 * the grimoire, not on `person`: it is the witch's alone, under her role, and never reaches a
 * candle's public page.
 */
export interface PersonNotes {
  id: string
  nickname?: string
  circle?: string
  /** «MM-DD», or «YYYY-MM-DD» when the year is known. */
  birthday?: string
  dates?: { id: string; label: string; date: string }[]
  likes?: string
  dislikes?: string
  gifts?: PersonLine[]
  ask?: PersonLine[]
  facts?: PersonLine[]
  scars?: PersonLine[]
  kindness?: PersonLine[]
}

/** One period: from its first day to its last, and how it felt. Kind `cycle`, under the witch role. */
export interface CycleEntry {
  id: string
  start: DayKey
  /** Empty while it goes on. */
  end?: DayKey
  /** 1 light · 2 medium · 3 heavy. */
  flow?: 1 | 2 | 3
  /** Keys of `cycleSymptoms`: pain, tired, sweet… */
  symptoms?: string[]
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
  personNotes: Record<string, PersonNotes>
  cycles: Record<string, CycleEntry>
  events: Record<string, LifeEvent>
  tarot: Record<string, TarotReading>
  goals: Record<string, Goal>
  notes: Record<string, Note>
  meta: GrimoireMeta
}
