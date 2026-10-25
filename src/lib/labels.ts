import type {
  CandleStage,
  DecorKind,
  DefectReason,
  HolderStage,
  MaterialCategory,
  MoldPurpose,
  MoldStatus,
  Unit,
  VarnishKind,
  WickScheme,
} from '../types'

export const moldPurposeLabel: Record<MoldPurpose, string> = {
  holder: 'подсвечник',
  lid: 'крышка',
  decor: 'декор',
  candle: 'формовая свеча',
}

export const moldStatusLabel: Record<MoldStatus, string> = {
  active: 'в работе',
  torn: 'порвалась',
  retired: 'списана',
}

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
  wicked: 'Фитиль приклеен',
  lidDone: 'Крышка готова',
  defect: 'Брак',
}

export const holderStageShort: Record<HolderStage, string> = {
  drying: 'Сохнет',
  dried: 'Ждёт лака внутри',
  varnishIn: 'Ждёт росписи',
  painted: 'Ждёт лака снаружи',
  varnishOut: 'Ждёт демпферов',
  dampers: 'Ждёт фитиля',
  wicked: 'Стал свечой',
  lidDone: 'Крышка готова',
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
}

export const holderStageOrder: HolderStage[] = [
  'drying',
  'dried',
  'varnishIn',
  'painted',
  'varnishOut',
  'dampers',
  'wicked',
  'lidDone',
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

export const seasons = ['зима', 'весна', 'лето', 'осень']
export const scentNotes = ['цветочные', 'фруктовые', 'цитрусовые', 'древесные', 'пряные', 'сладкие', 'свежие', 'травяные', 'гурманские', 'мускусные']

export const reviewQuestions = {
  scentCold: { label: 'Аромат холодной свечи', options: { none: 'не чувствуется', weak: 'слабый', nice: 'приятный', strong: 'слишком сильный' } },
  scentHot: { label: 'Аромат горящей свечи', options: { none: 'не чувствуется', weak: 'слабый', nice: 'приятный', strong: 'слишком сильный' } },
  burn: { label: 'Как горела?', options: { weak: 'слабо, огонёк маленький', normal: 'нормально', strong: 'сильно, огонь высокий' } },
  wentOut: { label: 'Тухла ли в процессе?', options: { no: 'нет', sometimes: 'иногда', often: 'часто' } },
  soot: { label: 'Коптила?', options: { no: 'нет', little: 'немного', strong: 'сильно' } },
  heat: { label: 'Сильно ли грелся подсвечник?', options: { cool: 'почти не грелся', warm: 'тёплый', hot: 'горячий, страшно трогать' } },
  crack: { label: 'Треснул ли подсвечник?', options: { no: 'нет', crack: 'появилась трещина', broken: 'раскололся' } },
  leak: { label: 'Протекал ли воск?', options: { no: 'нет', yes: 'да, были пятна' } },
  instructionClear: { label: 'Понятна ли инструкция?', options: { yes: 'да', notReally: 'не очень', didntRead: 'не читал(а)' } },
  finished: { label: 'Свеча догорела?', options: { yes: 'да', burning: 'ещё горю' } },
} as const

export type ChoiceQuestion = keyof typeof reviewQuestions
