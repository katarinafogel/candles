// Form values of a holder or a candle, and what they turn into. The same forms add ready-made items
// and edit existing ones. Neither moves stock: they correct the record, not what was spent.
import type { Candle, DecorUse, Holder, MixPart, Pour, VarnishKind, WaxPart, WickScheme } from '../types'

type DyeForm = 'liquid' | 'solid' | undefined
type MixKey = 'water' | 'plaster' | 'plasticizer' | 'defoamer' | 'dye'

export interface HolderForm {
  comment: string
  grams: Partial<Record<MixKey, number>>
  mat: Partial<Record<MixKey, string>>
  dyeColor: string
  dyeForm: DyeForm
  mixComment: string
  varnishInMat?: string
  varnishInLayers: number
  description: string
  paintIds: string[]
  varnishOutKind: VarnishKind
  varnishOutMat?: string
  varnishOutLayers: number
  dampersMat?: string
  dampersCount?: number
}

export type HolderDetails = Pick<Holder, 'comment' | 'mix' | 'varnishIn' | 'painting' | 'varnishOut' | 'dampers'>

const mixKeys: MixKey[] = ['water', 'plaster', 'plasticizer', 'defoamer', 'dye']

export const emptyHolderForm = (): HolderForm => ({
  comment: '',
  grams: {},
  mat: {},
  dyeColor: '',
  dyeForm: undefined,
  mixComment: '',
  varnishInLayers: 0,
  description: '',
  paintIds: [],
  varnishOutKind: 'gloss',
  varnishOutLayers: 0,
})

export function holderToForm(h: Holder): HolderForm {
  const m = h.mix
  return {
    ...emptyHolderForm(),
    comment: h.comment ?? '',
    grams: m ? Object.fromEntries(mixKeys.map((k) => [k, m[k].factG])) : {},
    mat: m ? Object.fromEntries(mixKeys.map((k) => [k, m[k].materialId])) : {},
    dyeColor: m?.dye.color ?? '',
    dyeForm: m?.dye.form,
    mixComment: m?.comment ?? '',
    varnishInMat: h.varnishIn?.materialId,
    varnishInLayers: h.varnishIn?.layers ?? 0,
    description: h.painting?.description ?? '',
    paintIds: h.painting?.paintIds ?? [],
    varnishOutKind: h.varnishOut?.kind ?? 'gloss',
    varnishOutMat: h.varnishOut?.materialId,
    varnishOutLayers: h.varnishOut?.layers ?? 0,
    dampersMat: h.dampers?.materialId,
    dampersCount: h.dampers?.count,
  }
}

/** An empty section stays absent, so a ready-made item shows only what is known about it. */
export function formToHolder(f: HolderForm, density: number, prev?: Holder): HolderDetails {
  const filled = mixKeys.some((k) => f.grams[k] || f.mat[k]) || !!f.dyeColor || !!f.mixComment
  const part = (k: MixKey): MixPart => {
    const g = f.grams[k] ?? 0
    const old = prev?.mix?.[k]
    return old ? { ...old, materialId: f.mat[k], factG: g } : { materialId: f.mat[k], pct: 0, calcG: g, factG: g }
  }
  const painted = !!f.description || f.paintIds.length > 0
  return {
    comment: f.comment.trim() || undefined,
    mix:
      prev?.mix || filled
        ? {
            density: prev?.mix?.density ?? density,
            lossPct: prev?.mix?.lossPct,
            water: part('water'),
            plaster: part('plaster'),
            plasticizer: part('plasticizer'),
            defoamer: part('defoamer'),
            dye: { ...part('dye'), color: f.dyeColor, form: f.dyeForm },
            comment: f.mixComment,
          }
        : undefined,
    varnishIn: f.varnishInLayers || f.varnishInMat ? { materialId: f.varnishInMat, layers: f.varnishInLayers } : undefined,
    painting: prev?.painting || painted ? { done: painted, description: f.description, paintIds: f.paintIds } : undefined,
    varnishOut: f.varnishOutLayers || f.varnishOutMat ? { kind: f.varnishOutKind, materialId: f.varnishOutMat, layers: f.varnishOutLayers } : undefined,
    dampers: f.dampersCount || f.dampersMat ? { materialId: f.dampersMat, count: f.dampersCount ?? 0 } : undefined,
  }
}

export interface CandleForm {
  name: string
  scheme?: WickScheme
  lengthCm?: number
  instructionId?: string
  comment: string
  decor: (DecorUse & { key: string })[]
  waxes: WaxPart[]
  fragranceId?: string
  fragrancePct?: number
  dyeId?: string
  dyePct?: number
  dyeColor: string
  dyeForm: DyeForm
  tFrag?: number
  tPour?: number
  tMold?: number
  noHeat: boolean
  pourComment: string
}

export type PourDetails = Omit<Pour, 'id' | 'date' | 'candleIds'>

export const emptyCandleForm = (): CandleForm => ({
  name: '',
  instructionId: 'default',
  comment: '',
  decor: [],
  waxes: [{ share: 100 }],
  dyeColor: '',
  dyeForm: undefined,
  noHeat: false,
  pourComment: '',
})

export function candleToForm(c: Candle, pour?: Pour): CandleForm {
  return {
    ...emptyCandleForm(),
    name: c.name,
    scheme: c.wick.scheme,
    lengthCm: c.wick.lengthCm,
    instructionId: c.instructionId,
    comment: c.comment ?? '',
    decor: c.decor.map((x) => ({ ...x, key: x.decorId ? `d:${x.decorId}` : `m:${x.materialId}` })),
    ...(pour && {
      waxes: pour.waxes,
      fragranceId: pour.fragrance.materialId,
      fragrancePct: pour.fragrance.pct,
      dyeId: pour.dye.materialId,
      dyePct: pour.dye.pct,
      dyeColor: pour.dye.color ?? '',
      dyeForm: pour.dye.form,
      tFrag: pour.tempFragranceC,
      tPour: pour.tempPourC,
      tMold: pour.tempMoldC === 'none' ? undefined : pour.tempMoldC,
      noHeat: pour.tempMoldC === 'none',
      pourComment: pour.comment,
    }),
  }
}

export const formToDecor = (f: CandleForm): DecorUse[] =>
  f.decor
    .filter((i) => i.key)
    .map((i) => ({
      decorId: i.key.startsWith('d:') ? i.key.slice(2) : undefined,
      materialId: i.key.startsWith('m:') ? i.key.slice(2) : undefined,
      qty: i.qty,
      dyed: i.dyed,
    }))

/** Undefined when nothing about the pour is known and there is no pour yet. */
export function formToPour(f: CandleForm, prev?: Pour): PourDetails | undefined {
  const filled =
    f.waxes.some((w) => w.materialId) || !!f.fragranceId || !!f.dyeId || !!f.dyeColor || !!f.tFrag || !!f.tPour || !!f.tMold || f.noHeat || !!f.pourComment
  if (!prev && !filled) return undefined
  return {
    waxes: f.waxes,
    lossPct: prev?.lossPct ?? 0,
    fragrance: { materialId: f.fragranceId, pct: f.fragrancePct ?? 0 },
    dye: { materialId: f.dyeId, pct: f.dyePct ?? 0, color: f.dyeColor, form: f.dyeForm },
    tempFragranceC: f.tFrag,
    tempPourC: f.tPour,
    tempMoldC: f.noHeat ? 'none' : f.tMold,
    calc: prev?.calc ?? { totalG: 0, waxG: 0, fragranceG: 0, dyeG: 0 },
    fact: prev?.fact ?? { waxG: [], fragranceG: 0, dyeG: 0 },
    comment: f.pourComment,
  }
}
