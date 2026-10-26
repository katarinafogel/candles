// Domain model of the candle workshop (see spec sections 3–4).

export type ISODate = string

/** Holders, dishes and figurines are cast from plaster; molded candles and decor from wax. */
export type PlasterPurpose = 'holder' | 'dish' | 'figurine'
export type MoldPurpose = PlasterPurpose | 'candle' | 'decor'
/** Shape icon on the cards, drawn from photos of the castings. */
export type MoldIcon =
  | 'pot'
  | 'lantern'
  | 'bird'
  | 'windows'
  | 'cathedral'
  | 'shell'
  | 'bowl'
  | 'monstera'
  | 'leafDish'
  | 'chest'
  | 'roundBox'
  | 'heartDish'
  | 'ornament'
  | 'starJar'
export type WickScheme = 'double05' | 'mixed' | 'double1'

export interface Wick {
  scheme: WickScheme
  lengthCm: number
}

export interface Mold {
  id: string // M-012
  name: string
  purpose: MoldPurpose
  copies: number
  waterVolumeMl: number
  waterPct: number
  waxCapacityG: number
  defaultWick?: Wick
  fragrancePct: number
  dyePct?: number
  plasticizerPct?: number
  /** Shape icon; without it the icon is guessed from the name. */
  icon?: MoldIcon
  /** 1–5 stars; higher-rated molds come first in lists. */
  rating?: number
  /** Archived molds (torn, retired or just not used) are hidden from new mixes and molded candles. */
  archived?: boolean
  comment: string
}

export type MaterialCategory =
  | 'plaster'
  | 'plasticizer'
  | 'defoamer'
  | 'plasterDye'
  | 'varnishIn'
  | 'varnishOut'
  | 'paint'
  | 'cork'
  | 'wick'
  | 'wax'
  | 'fragrance'
  | 'waxDye'
  | 'decor'
  | 'other'

export type Unit = 'g' | 'ml' | 'pcs' | 'cm'

export type MovementKind = 'purchase' | 'use' | 'return' | 'inventory'

export interface Movement {
  id: string
  date: ISODate
  qty: number // signed: + to stock, − from stock
  kind: MovementKind
  /** Groups the uses of one event (mix, pour, stage batch) for the low-stock threshold. */
  eventId?: string
  ref?: string // entity id the movement is about
  price?: number // total price of a purchase
  link?: string
  comment?: string
}

export interface Material {
  id: string
  category: MaterialCategory
  name: string
  maker: string
  unit: Unit
  thresholdOverride?: number
  rating?: number
  review: string
  movements: Movement[]
  // fragrance
  seasons?: string[]
  notes?: string[]
  // wick
  wickWidthCm?: 0.5 | 1
  // dyes
  color?: string
  dyeForm?: 'liquid' | 'solid'
  archived?: boolean
  /** Marked to be bought again («Купить еще»). */
  toBuy?: boolean
}

/** A material amount taken from stock by some step; kept so a step can be undone and costed. */
export interface Consumption {
  materialId?: string
  decorId?: string
  qty: number
}

export interface StageEntry {
  stage: string
  date: ISODate
  params?: Record<string, unknown>
  comment?: string
  consumption: Consumption[]
}

export type DefectReason = 'crack' | 'leak' | 'noLight' | 'tooStrong' | 'chip' | 'other'

export interface Defect {
  stage: string
  reason: DefectReason
  comment: string
  date: ISODate
}

export interface MixPart {
  materialId?: string
  pct: number
  calcG: number
  factG: number
}

export interface PlasterMix {
  id: string // G-0031
  date: ISODate
  moldIds: string[]
  plaster: MixPart
  water: MixPart
  plasticizer: MixPart
  defoamer: MixPart
  dye: MixPart & { color?: string; form?: 'liquid' | 'solid' }
  density: number
  comment: string
  holderIds: string[]
}

export type HolderStage =
  | 'drying'
  | 'dried'
  | 'varnishIn'
  | 'painted'
  | 'varnishOut'
  | 'dampers'
  | 'wicked'
  | 'done'
  | 'defect'

export type VarnishKind = 'gloss' | 'liquidGlass' | 'matte' | 'wax'

export interface Holder {
  id: string // P-0042
  moldId: string
  mixId: string
  /** What the mold makes, copied at casting: only holders go on to dampers and a wick, the rest end at «done». */
  purpose: PlasterPurpose
  mix: Omit<PlasterMix, 'holderIds' | 'moldIds' | 'id' | 'date'> // recipe snapshot
  dryStart: ISODate
  dryEnd?: ISODate
  varnishIn?: { materialId?: string; layers: number }
  painting?: { done: boolean; description: string; paintIds: string[] }
  varnishOut?: { kind: VarnishKind; materialId?: string; layers: number }
  dampers?: { materialId?: string; count: number }
  stage: HolderStage
  history: StageEntry[]
  defect?: Defect
  candleId?: string
}

export type CandleStage = 'wicked' | 'curing' | 'decorated' | 'ready' | 'given' | 'defect'

export interface DecorUse {
  decorId?: string
  materialId?: string
  qty: number
  dyed: boolean
}

export interface Candle {
  id: string // S-0042
  holderId?: string
  moldId?: string // for molded candles (no holder)
  name: string
  wick: Wick
  pourId?: string
  decor: DecorUse[]
  instructionId?: string
  pouredAt?: ISODate
  readyAt?: ISODate
  stage: CandleStage
  history: StageEntry[]
  personId?: string
  burnedBySelf?: boolean
  givenAt?: ISODate
  defect?: Defect
}

export interface WaxPart {
  materialId?: string
  share: number // percent of the wax blend
}

export interface Pour {
  id: string // W-0019
  date: ISODate
  candleIds: string[]
  waxes: WaxPart[]
  lossPct: number
  fragrance: { materialId?: string; pct: number }
  dye: { materialId?: string; pct: number; color?: string; form?: 'liquid' | 'solid' }
  tempFragranceC?: number
  tempPourC?: number
  tempMoldC?: number | 'none'
  calc: { totalG: number; waxG: number; fragranceG: number; dyeG: number }
  fact: { waxG: number[]; fragranceG: number; dyeG: number }
  comment: string
}

export type DecorKind = 'wax' | 'stones' | 'glitter' | 'dried' | 'other'

export interface DecorBatch {
  id: string // D-0007
  kind: DecorKind
  name: string
  date: ISODate
  waxMaterialId?: string
  waxG?: number
  dyeMaterialId?: string
  dyePct?: number
  moldId?: string
  qty: number
  used: number
  consumption: Consumption[]
  comment: string
}

export interface Person {
  id: string
  name: string
  contact: string
  notes: string
}

export interface Instruction {
  id: string
  title: string
  text: string
}

export type Scale4 = 'none' | 'weak' | 'nice' | 'strong'

export interface ReviewAnswers {
  overall?: number
  design?: number
  scentCold?: Scale4
  scentHot?: Scale4
  burn?: 'weak' | 'normal' | 'strong'
  wentOut?: 'no' | 'sometimes' | 'often'
  soot?: 'no' | 'little' | 'strong'
  heat?: 'cool' | 'warm' | 'hot'
  crack?: 'no' | 'crack' | 'broken'
  leak?: 'no' | 'yes'
  instructionClear?: 'yes' | 'notReally' | 'didntRead'
  finished?: 'yes' | 'burning'
  comment?: string
  name?: string
}

export interface Review extends ReviewAnswers {
  id: string // UUID made on the recipient's phone
  candleId: string
  date: ISODate
  source: 'qr' | 'manual'
  burnHours?: number
  sessions?: number
  selfExtinguished?: number
  read: boolean
}

export interface Settings {
  plasterDensity: number
  plasticizerPct: number
  defoamerPct: number
  plasterDyePct: number
  waxLossPct: number
  fragrancePct: number
  waxDyePct: number
  varnishMlPerLayer: number
  /** Address of the published app, used in QR links. Empty = the current address. */
  publicUrl: string
  lastBackupAt?: ISODate
}

export interface Counters {
  M: number
  P: number
  S: number
  D: number
  G: number
  W: number
}

export interface DataState {
  schemaVersion: number
  counters: Counters
  molds: Record<string, Mold>
  materials: Record<string, Material>
  mixes: Record<string, PlasterMix>
  holders: Record<string, Holder>
  candles: Record<string, Candle>
  pours: Record<string, Pour>
  decor: Record<string, DecorBatch>
  people: Record<string, Person>
  instructions: Record<string, Instruction>
  reviews: Record<string, Review>
  settings: Settings
}
