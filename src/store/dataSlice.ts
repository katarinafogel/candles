import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import type {
  Candle,
  Consumption,
  Counters,
  DataState,
  DecorBatch,
  DecorUse,
  Defect,
  DefectReason,
  Holder,
  HolderStage,
  Instruction,
  Material,
  Mold,
  Person,
  PlasterMix,
  Pour,
  Review,
  Settings,
  VarnishKind,
  Wick,
} from '../types'
import { isPlaster } from '../lib/labels'

export const SCHEMA_VERSION = 2

export const defaultSettings: Settings = {
  plasterDensity: 1.82,
  plasticizerPct: 1,
  defoamerPct: 0.1,
  plasterDyePct: 5,
  waxLossPct: 0,
  fragrancePct: 7,
  waxDyePct: 0,
  varnishMlPerLayer: 5,
  publicUrl: '',
}

export const initialData: DataState = {
  schemaVersion: SCHEMA_VERSION,
  counters: { M: 0, P: 0, S: 0, D: 0, G: 0, W: 0 },
  molds: {},
  materials: {},
  mixes: {},
  holders: {},
  candles: {},
  pours: {},
  decor: {},
  people: {},
  instructions: {
    default: {
      id: 'default',
      title: 'Основная',
      text:
        'Перед первым зажиганием подрежьте фитиль до 5–7 мм.\n' +
        'В первый раз жгите свечу, пока весь верхний слой воска не расплавится (1,5–3 часа).\n' +
        'Не оставляйте горящую свечу без присмотра, держите подальше от сквозняков, детей и животных.\n' +
        'Не жгите больше 4 часов подряд. Если подсвечник сильно греется — потушите и дайте остыть.',
    },
  },
  reviews: {},
  settings: defaultSettings,
}

const pad = (n: number, w: number) => String(n).padStart(w, '0')

export function nextId(s: DataState, prefix: keyof Counters) {
  s.counters[prefix] += 1
  return `${prefix}-${pad(s.counters[prefix], prefix === 'M' ? 3 : 4)}`
}

/** Takes a material amount from stock (qty > 0) and returns the consumption record. */
function take(
  s: DataState,
  materialId: string | undefined,
  qty: number,
  date: string,
  eventId: string,
  ref: string,
): Consumption[] {
  if (!materialId || !qty) return []
  const m = s.materials[materialId]
  if (!m) return []
  m.movements.push({ id: nanoid(), date, qty: -qty, kind: 'use', eventId, ref })
  return [{ materialId, qty }]
}

function takeDecor(s: DataState, d: DecorUse, date: string, eventId: string, ref: string): Consumption[] {
  if (d.decorId) {
    const b = s.decor[d.decorId]
    if (!b) return []
    b.used += d.qty
    return [{ decorId: d.decorId, qty: d.qty }]
  }
  return take(s, d.materialId, d.qty, date, eventId, ref)
}

/** Puts the consumption of an undone step back on the shelf. */
function giveBack(s: DataState, items: Consumption[], date: string, ref: string) {
  for (const c of items) {
    if (c.materialId && s.materials[c.materialId]) {
      s.materials[c.materialId].movements.push({ id: nanoid(), date, qty: c.qty, kind: 'return', ref })
    } else if (c.decorId && s.decor[c.decorId]) {
      s.decor[c.decorId].used -= c.qty
    }
  }
}

// ---------- payload types ----------

export interface MixPayload {
  date: string
  moldIds: string[] // may repeat when several copies of a mold are cast
  mix: Omit<PlasterMix, 'id' | 'date' | 'moldIds' | 'holderIds'>
}

export type HolderStepParams =
  | { step: 'dried'; dryEnd: string }
  | { step: 'varnishIn'; materialId?: string; layers: number }
  | { step: 'painted'; skip: boolean; description: string; paints: { materialId: string; qty: number }[] }
  | { step: 'varnishOut'; kind: VarnishKind; materialId?: string; layers: number }
  | { step: 'dampers'; materialId?: string; count: number }
  | { step: 'done' }
  | {
      step: 'wicked'
      wick: Wick
      materialId?: string
      name: string
      instructionId?: string
    }

export interface PourPayload {
  pour: Omit<Pour, 'id'>
}

export type CandleStepParams =
  | { step: 'decorated'; decor: DecorUse[] }
  | { step: 'ready'; readyAt: string }
  | { step: 'given'; personId?: string; burnedBySelf: boolean; givenAt: string }

const nextHolderStage = (h: Holder): HolderStage | undefined => {
  switch (h.stage) {
    case 'drying':
      return 'dried'
    case 'dried':
      return 'varnishIn'
    case 'varnishIn':
      return 'painted'
    case 'painted':
      return 'varnishOut'
    case 'varnishOut':
      return h.purpose === 'holder' ? 'dampers' : 'done'
    case 'dampers':
      return h.purpose === 'holder' ? 'wicked' : undefined
    default:
      return undefined
  }
}

export { nextHolderStage }

function newCandle(
  s: DataState,
  p: { holderId?: string; moldId?: string; name: string; wick: Wick; instructionId?: string },
): Candle {
  const id = nextId(s, 'S')
  const c: Candle = {
    id,
    holderId: p.holderId,
    moldId: p.moldId,
    name: p.name,
    wick: p.wick,
    decor: [],
    instructionId: p.instructionId,
    stage: 'wicked',
    history: [],
  }
  s.candles[id] = c
  return c
}

const slice = createSlice({
  name: 'data',
  initialState: initialData,
  reducers: {
    replaceAll: (_s, a: PayloadAction<DataState>) => a.payload,

    updateSettings(s, a: PayloadAction<Partial<Settings>>) {
      Object.assign(s.settings, a.payload)
    },
    markBackup(s, a: PayloadAction<string>) {
      s.settings.lastBackupAt = a.payload
    },

    // ----- molds -----
    upsertMold(s, a: PayloadAction<Omit<Mold, 'id'> & { id?: string }>) {
      const id = a.payload.id ?? nextId(s, 'M')
      s.molds[id] = { ...a.payload, id }
      // A corrected type also applies to casts that have not passed the outer varnish yet.
      const p = a.payload.purpose
      if (isPlaster(p))
        for (const h of Object.values(s.holders))
          if (h.moldId === id && h.purpose !== p && ['drying', 'dried', 'varnishIn', 'painted', 'varnishOut'].includes(h.stage))
            h.purpose = p
    },

    // ----- materials -----
    upsertMaterial(s, a: PayloadAction<Omit<Material, 'id' | 'movements'> & { id?: string; initialQty?: number }>) {
      const { initialQty, ...rest } = a.payload
      const id = rest.id ?? nanoid(8)
      const prev = s.materials[id]
      s.materials[id] = { ...prev, ...rest, id, movements: prev?.movements ?? [] }
      if (!prev && initialQty) {
        s.materials[id].movements.push({
          id: nanoid(),
          date: new Date().toISOString(),
          qty: initialQty,
          kind: 'inventory',
          comment: 'начальный остаток',
        })
      }
    },
    purchase(
      s,
      a: PayloadAction<{ materialId: string; date: string; qty: number; price?: number; link?: string; comment?: string }>,
    ) {
      const { materialId, ...p } = a.payload
      s.materials[materialId]?.movements.push({ id: nanoid(), kind: 'purchase', ...p })
    },
    inventory(s, a: PayloadAction<{ materialId: string; date: string; actual: number; comment?: string }>) {
      const m = s.materials[a.payload.materialId]
      if (!m) return
      const cur = m.movements.reduce((x, mv) => x + mv.qty, 0)
      const delta = a.payload.actual - cur
      if (Math.abs(delta) < 1e-9) return
      m.movements.push({
        id: nanoid(),
        date: a.payload.date,
        qty: delta,
        kind: 'inventory',
        comment: a.payload.comment || 'инвентаризация',
      })
    },
    removeMovement(s, a: PayloadAction<{ materialId: string; movementId: string }>) {
      const m = s.materials[a.payload.materialId]
      if (m) m.movements = m.movements.filter((mv) => mv.id !== a.payload.movementId)
    },

    // ----- people, instructions -----
    upsertPerson(s, a: PayloadAction<Omit<Person, 'id'> & { id?: string }>) {
      const id = a.payload.id ?? nanoid(8)
      s.people[id] = { ...a.payload, id }
    },
    deletePerson(s, a: PayloadAction<string>) {
      delete s.people[a.payload]
    },
    upsertInstruction(s, a: PayloadAction<Omit<Instruction, 'id'> & { id?: string }>) {
      const id = a.payload.id ?? nanoid(8)
      s.instructions[id] = { ...a.payload, id }
    },
    deleteInstruction(s, a: PayloadAction<string>) {
      delete s.instructions[a.payload]
    },

    // ----- decor -----
    addDecorBatch(s, a: PayloadAction<Omit<DecorBatch, 'id' | 'used' | 'consumption'>>) {
      const id = nextId(s, 'D')
      const p = a.payload
      const consumption = [
        ...take(s, p.waxMaterialId, p.waxG ?? 0, p.date, id, id),
        ...take(s, p.dyeMaterialId, ((p.waxG ?? 0) * (p.dyePct ?? 0)) / 100, p.date, id, id),
      ]
      s.decor[id] = { ...p, id, used: 0, consumption }
    },
    updateDecorBatch(s, a: PayloadAction<Pick<DecorBatch, 'id' | 'name' | 'qty' | 'comment'>>) {
      const d = s.decor[a.payload.id]
      if (d) Object.assign(d, a.payload)
    },

    // ----- plaster mix → holders -----
    createMix(s, a: PayloadAction<MixPayload>) {
      const { date, moldIds, mix } = a.payload
      const id = nextId(s, 'G')
      const totalVol = moldIds.reduce((x, m) => x + (s.molds[m]?.waterVolumeMl ?? 0), 0) || 1
      const holderIds: string[] = []
      for (const moldId of moldIds) {
        const mold = s.molds[moldId]
        if (!mold) continue
        const share = mold.waterVolumeMl / totalVol
        const hid = nextId(s, 'P')
        const parts = [mix.plaster, mix.plasticizer, mix.defoamer, mix.dye]
        const consumption = parts.flatMap((p) => take(s, p.materialId, p.factG * share, date, id, hid))
        s.holders[hid] = {
          id: hid,
          moldId,
          mixId: id,
          purpose: isPlaster(mold.purpose) ? mold.purpose : 'holder',
          mix,
          dryStart: date,
          stage: 'drying',
          history: [{ stage: 'drying', date, consumption, params: { mixId: id } }],
        }
        holderIds.push(hid)
      }
      s.mixes[id] = { ...mix, id, date, moldIds, holderIds }
    },

    advanceHolders(s, a: PayloadAction<{ ids: string[]; date: string; params: HolderStepParams; comment?: string }>) {
      const { ids, date, params, comment } = a.payload
      const eventId = nanoid()
      for (const hid of ids) {
        const h = s.holders[hid]
        if (!h || nextHolderStage(h) !== params.step) continue
        let consumption: Consumption[] = []
        const stored: Record<string, unknown> = {}
        switch (params.step) {
          case 'dried':
            h.dryEnd = params.dryEnd
            break
          case 'varnishIn':
            h.varnishIn = { materialId: params.materialId, layers: params.layers }
            consumption = take(s, params.materialId, params.layers * s.settings.varnishMlPerLayer, date, eventId, hid)
            break
          case 'painted':
            h.painting = {
              done: !params.skip,
              description: params.skip ? '' : params.description,
              paintIds: params.skip ? [] : params.paints.map((p) => p.materialId),
            }
            if (!params.skip)
              consumption = params.paints.flatMap((p) => take(s, p.materialId, p.qty, date, eventId, hid))
            break
          case 'varnishOut':
            h.varnishOut = { kind: params.kind, materialId: params.materialId, layers: params.layers }
            consumption = take(s, params.materialId, params.layers * s.settings.varnishMlPerLayer, date, eventId, hid)
            break
          case 'dampers':
            h.dampers = { materialId: params.materialId, count: params.count }
            consumption = take(s, params.materialId, params.count, date, eventId, hid)
            break
          case 'done':
            break
          case 'wicked': {
            const c = newCandle(s, {
              holderId: hid,
              name: params.name,
              wick: params.wick,
              instructionId: params.instructionId,
            })
            c.history.push({
              stage: 'wicked',
              date,
              consumption: take(s, params.materialId, params.wick.lengthCm * 2, date, eventId, c.id),
              params: { wick: params.wick },
            })
            h.candleId = c.id
            stored.candleId = c.id
            break
          }
        }
        h.stage = params.step
        h.history.push({ stage: params.step, date, params: { ...params, ...stored }, comment, consumption })
      }
    },

    undoHolder(s, a: PayloadAction<{ id: string; date: string }>) {
      const h = s.holders[a.payload.id]
      if (!h || h.history.length < 2) return
      const last = h.history[h.history.length - 1]
      if (last.stage === 'wicked' && h.candleId) {
        const c = s.candles[h.candleId]
        // Only an unpoured candle can be turned back into a holder.
        if (c && c.stage !== 'wicked') return
        if (c) {
          giveBack(s, c.history.flatMap((e) => e.consumption), a.payload.date, c.id)
          delete s.candles[c.id]
        }
        h.candleId = undefined
      }
      if (last.stage === 'defect') h.defect = undefined
      if (last.stage === 'dried') h.dryEnd = undefined
      giveBack(s, last.consumption, a.payload.date, h.id)
      h.history.pop()
      h.stage = h.history[h.history.length - 1].stage as HolderStage
    },

    markDefect(
      s,
      a: PayloadAction<{ kind: 'holder' | 'candle'; ids: string[]; reason: DefectReason; comment: string; date: string }>,
    ) {
      const { kind, ids, reason, comment, date } = a.payload
      for (const id of ids) {
        const e = kind === 'holder' ? s.holders[id] : s.candles[id]
        if (!e || e.stage === 'defect') continue
        const defect: Defect = { stage: e.stage, reason, comment, date }
        e.defect = defect
        e.history.push({ stage: 'defect', date, params: { ...defect }, comment, consumption: [] })
        e.stage = 'defect'
      }
    },

    // ----- candles -----
    createMoldedCandle(
      s,
      a: PayloadAction<{ moldId: string; name: string; wick: Wick; materialId?: string; instructionId?: string; date: string }>,
    ) {
      const p = a.payload
      const c = newCandle(s, p)
      c.history.push({
        stage: 'wicked',
        date: p.date,
        consumption: take(s, p.materialId, p.wick.lengthCm * 2, p.date, c.id, c.id),
        params: { wick: p.wick },
      })
    },

    updateCandle(s, a: PayloadAction<Partial<Candle> & { id: string }>) {
      const c = s.candles[a.payload.id]
      if (c) Object.assign(c, a.payload)
    },

    createPour(s, a: PayloadAction<PourPayload>) {
      const p = a.payload.pour
      const id = nextId(s, 'W')
      const cap = (cid: string) => {
        const c = s.candles[cid]
        const moldId = c?.holderId ? s.holders[c.holderId]?.moldId : c?.moldId
        return (moldId && s.molds[moldId]?.waxCapacityG) || 0
      }
      const totalCap = p.candleIds.reduce((x, c) => x + cap(c), 0)
      for (const cid of p.candleIds) {
        const c = s.candles[cid]
        if (!c || c.stage !== 'wicked') continue
        const share = totalCap ? cap(cid) / totalCap : 1 / p.candleIds.length
        const consumption = [
          ...p.waxes.flatMap((w, i) => take(s, w.materialId, (p.fact.waxG[i] ?? 0) * share, p.date, id, cid)),
          ...take(s, p.fragrance.materialId, p.fact.fragranceG * share, p.date, id, cid),
          ...take(s, p.dye.materialId, p.fact.dyeG * share, p.date, id, cid),
        ]
        c.pourId = id
        c.pouredAt = p.date
        c.stage = 'curing'
        c.history.push({ stage: 'curing', date: p.date, consumption, params: { pourId: id } })
      }
      s.pours[id] = { ...p, id }
    },

    advanceCandles(s, a: PayloadAction<{ ids: string[]; date: string; params: CandleStepParams; comment?: string }>) {
      const { ids, date, params, comment } = a.payload
      const eventId = nanoid()
      for (const cid of ids) {
        const c = s.candles[cid]
        if (!c) continue
        let consumption: Consumption[] = []
        if (params.step === 'decorated') {
          if (c.stage !== 'curing') continue
          c.decor = params.decor
          consumption = params.decor.flatMap((d) => takeDecor(s, d, date, eventId, cid))
        } else if (params.step === 'ready') {
          if (c.stage !== 'curing' && c.stage !== 'decorated') continue
          c.readyAt = params.readyAt
        } else if (params.step === 'given') {
          if (c.stage !== 'ready') continue
          c.personId = params.personId
          c.burnedBySelf = params.burnedBySelf
          c.givenAt = params.givenAt
        }
        c.stage = params.step
        c.history.push({ stage: params.step, date, params: { ...params }, comment, consumption })
      }
    },

    undoCandle(s, a: PayloadAction<{ id: string; date: string }>) {
      const c = s.candles[a.payload.id]
      if (!c || !c.history.length) return
      const last = c.history[c.history.length - 1]
      giveBack(s, last.consumption, a.payload.date, c.id)
      if (c.history.length === 1) {
        // Undoing the wick: a holder candle goes back to its holder, a molded one disappears.
        const h = c.holderId ? s.holders[c.holderId] : undefined
        if (h && h.stage === 'wicked') {
          const he = h.history[h.history.length - 1]
          giveBack(s, he.consumption, a.payload.date, h.id)
          h.history.pop()
          h.stage = h.history[h.history.length - 1].stage as HolderStage
          h.candleId = undefined
        }
        delete s.candles[c.id]
        return
      }
      switch (last.stage) {
        case 'curing':
          if (c.pourId && s.pours[c.pourId]) {
            s.pours[c.pourId].candleIds = s.pours[c.pourId].candleIds.filter((x) => x !== c.id)
          }
          c.pourId = undefined
          c.pouredAt = undefined
          break
        case 'decorated':
          c.decor = []
          break
        case 'ready':
          c.readyAt = undefined
          break
        case 'given':
          c.personId = undefined
          c.burnedBySelf = undefined
          c.givenAt = undefined
          break
        case 'defect':
          c.defect = undefined
          break
      }
      c.history.pop()
      c.stage = c.history[c.history.length - 1].stage as Candle['stage']
    },

    // ----- reviews -----
    addReviews(s, a: PayloadAction<Review[]>) {
      for (const r of a.payload) {
        if (s.reviews[r.id]) continue
        s.reviews[r.id] = r
      }
    },
    setReviewRead(s, a: PayloadAction<{ ids: string[]; read: boolean }>) {
      for (const id of a.payload.ids) if (s.reviews[id]) s.reviews[id].read = a.payload.read
    },
    reassignReview(s, a: PayloadAction<{ id: string; candleId: string }>) {
      if (s.reviews[a.payload.id]) s.reviews[a.payload.id].candleId = a.payload.candleId
    },
    deleteReview(s, a: PayloadAction<string>) {
      delete s.reviews[a.payload]
    },
  },
})

export const actions = slice.actions
export default slice.reducer
