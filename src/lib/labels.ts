import type {
  CandleStage,
  DecorKind,
  DefectReason,
  Holder,
  HolderStage,
  MaterialCategory,
  MoldPurpose,
  PlasterPurpose,
  Unit,
  VarnishKind,
  WickScheme,
} from '../types'

export const moldPurposeLabel: Record<MoldPurpose, string> = {
  holder: 'подсвечник',
  dish: 'тарелка',
  figurine: 'фигурка',
  candle: 'формовая свеча',
  decor: 'декор',
}

/** Group headings on the molds page. */
export const moldPurposePlural: Record<MoldPurpose, string> = {
  holder: 'Подсвечники',
  dish: 'Тарелки',
  figurine: 'Фигурки',
  candle: 'Формовые свечи',
  decor: 'Декор',
}

/** Purposes cast from plaster in a mix. */
export const plasterPurposes: PlasterPurpose[] = ['holder', 'dish', 'figurine']
export const isPlaster = (p: MoldPurpose): p is PlasterPurpose => (plasterPurposes as MoldPurpose[]).includes(p)

export const plasterPurposePlural: Record<PlasterPurpose, string> = moldPurposePlural

export const wickSchemeLabel: Record<WickScheme, string> = {
  double05: 'двойной 0,5 см',
  mixed: '1 см + 0,5 см (полуторный)',
  double1: 'двойной 1 см',
}

export const categoryLabel: Record<MaterialCategory, string> = {
  plaster: 'Гипс',
  plasticizer: 'Пластификатор',
  defoamer: 'Пеногаситель',
  plasterDye: 'Краситель для гипса',
  varnishIn: 'Лак внутренний',
  varnishOut: 'Лак внешний',
  paint: 'Краска для росписи',
  cork: 'Пробка',
  wick: 'Фитиль',
  wax: 'Воск',
  fragrance: 'Отдушка',
  waxDye: 'Краситель для воска',
  decor: 'Декор',
  other: 'Прочее',
}

export const categoryUnit: Record<MaterialCategory, Unit> = {
  plaster: 'g',
  plasticizer: 'g',
  defoamer: 'g',
  plasterDye: 'g',
  varnishIn: 'ml',
  varnishOut: 'ml',
  paint: 'ml',
  cork: 'pcs',
  wick: 'cm',
  wax: 'g',
  fragrance: 'g',
  waxDye: 'g',
  decor: 'pcs',
  other: 'pcs',
}

export const unitLabel: Record<Unit, string> = { g: 'г', ml: 'мл', pcs: 'шт', cm: 'см' }

export const holderStageLabel: Record<HolderStage, string> = {
  drying: 'Сохнет',
  dried: 'Высох · ждёт лака внутри',
  varnishIn: 'Лак внутри · ждёт росписи',
  painted: 'Роспись · ждёт лака снаружи',
  varnishOut: 'Лак снаружи · ждёт демпферов',
  dampers: 'Демпферы · ждёт фитиля',
  wicked: 'Фитиль приклеен · ждёт заливки',
  candle: 'Стал свечой',
  done: 'Готово',
  defect: 'Брак',
}

export const holderStageShort: Record<HolderStage, string> = {
  drying: 'Сохнет',
  dried: 'Ждёт лака внутри',
  varnishIn: 'Ждёт росписи',
  painted: 'Ждёт лака снаружи',
  varnishOut: 'Ждёт демпферов',
  dampers: 'Ждёт фитиля',
  wicked: 'Ждёт заливки',
  candle: 'Стал свечой',
  done: 'Готово',
  defect: 'Брак',
}

/** Title of the step that the "Дальше" button performs from a stage. */
export const holderNextLabel: Partial<Record<HolderStage, string>> = {
  drying: 'Высох',
  dried: 'Лак внутри',
  varnishIn: 'Роспись',
  painted: 'Лак снаружи',
  varnishOut: 'Демпферы',
  dampers: 'Приклеить фитиль',
  wicked: 'Залить',
}

/** Title of the next step for this item: dishes and figurines are finished after the outer varnish. */
export const holderNextTitle = (h: Pick<Holder, 'stage' | 'purpose'>) =>
  h.stage === 'varnishOut' && h.purpose !== 'holder' ? 'Готово' : holderNextLabel[h.stage]

export const holderStageOrder: HolderStage[] = [
  'drying',
  'dried',
  'varnishIn',
  'painted',
  'varnishOut',
  'dampers',
  'wicked',
  'candle',
  'done',
  'defect',
]

export const candleStageLabel: Record<CandleStage, string> = {
  wicked: 'Фитиль приклеен',
  curing: 'Залита, дозревает',
  decorated: 'Украшена',
  ready: 'Готова',
  given: 'Подарена / сожжена',
  defect: 'Брак',
}

export const candleNextLabel: Partial<Record<CandleStage, string>> = {
  curing: 'Украсить',
  decorated: 'Готова',
  ready: 'Подарить',
}

export const candleStageOrder: CandleStage[] = ['wicked', 'curing', 'decorated', 'ready', 'given', 'defect']

/** A holder is not a candle yet: it can only crack or chip. */
export const holderDefectReasons: DefectReason[] = ['crack', 'chip', 'other']
export const candleDefectReasons: DefectReason[] = ['crack', 'leak', 'noLight', 'tooStrong', 'chip', 'other']

export const defectReasonLabel: Record<DefectReason, string> = {
  crack: 'трещина',
  leak: 'протёк воск',
  noLight: 'не разгорелась',
  tooStrong: 'горит слишком сильно',
  chip: 'скол',
  other: 'другое',
}

export const varnishKindLabel: Record<VarnishKind, string> = {
  gloss: 'глянец',
  liquidGlass: 'жидкое стекло',
  matte: 'матовый',
  wax: 'воск',
}

export const decorKindLabel: Record<DecorKind, string> = {
  wax: 'восковой',
  stones: 'камешки',
  glitter: 'блёстки',
  dried: 'сухоцветы',
  other: 'другое',
}

export const seasons = ['зима', 'весна', 'лето', 'осень', 'универсальный']
/** Colours a tester can like; the same list is checked by submit_tester in the database. */
export const candleColors = ['белый', 'молочный', 'бежевый', 'розовый', 'красный', 'бордовый', 'оранжевый', 'жёлтый', 'зелёный', 'голубой', 'синий', 'фиолетовый', 'серый', 'чёрный', 'золотой']

export const scentNotes = ['цветочный', 'ягодный/фруктовый', 'древесный', 'пряный', 'сладкий', 'гурманский', 'парфюм', 'озон/свежесть', 'зеленый', 'пудровый']

export const reviewQuestions = {
  scentCold: { label: 'Аромат холодной свечи', options: { none: 'не чувствуется', weak: 'слабый', nice: 'приятный', strong: 'слишком сильный' } },
  scentHot: { label: 'Аромат горящей свечи', options: { none: 'не чувствуется', weak: 'слабый', nice: 'приятный', strong: 'слишком сильный' } },
  burn: { label: 'Как горела?', options: { weak: 'слабо, огонёк маленький', normal: 'нормально', strong: 'сильно, огонь высокий' } },
  wentOut: { label: 'Тухла ли в процессе?', options: { no: 'нет', sometimes: 'иногда', often: 'часто' } },
  soot: { label: 'Коптила?', options: { no: 'нет', little: 'немного', strong: 'сильно' } },
  heat: { label: 'Сильно ли грелся подсвечник?', options: { cool: 'почти не грелся', warm: 'тёплый', hot: 'горячий, страшно трогать' } },
  crack: { label: 'Треснул ли подсвечник?', options: { no: 'нет', crack: 'да' } },
  leak: { label: 'Протекал ли воск?', options: { no: 'нет', yes: 'да, были пятна' } },
  instructionClear: { label: 'Понятна ли инструкция?', options: { yes: 'да', notReally: 'не очень', didntRead: 'не читал(а)' } },
  finished: { label: 'Свеча догорела?', options: { yes: 'да', burning: 'нет' } },
} as const

export type ChoiceQuestion = keyof typeof reviewQuestions
