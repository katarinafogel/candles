// GENERATED from src/grimoire/emotions.ts by scripts/sync-agent-core.mjs — edit the original, then run: node scripts/sync-agent-core.mjs
// The emotion dictionary (see the «Гримуар: словарь эмоций» spec): Plutchik's wheel — 8 petals with
// three words each by strength, and 8 mixed feelings between neighbouring petals. 32 words, no others.
// It lives in code, not in the database: a mirror entry stores only the keys («anger.1», «dyad.awe»).
// The texts are approved as they are and read-only in the app.

export type Petal = 'joy' | 'trust' | 'fear' | 'surprise' | 'sadness' | 'disgust' | 'anger' | 'anticipation'
export type Dyad = 'optimism' | 'love' | 'submission' | 'awe' | 'disapproval' | 'remorse' | 'contempt' | 'aggressiveness'
/** 1 — weak (outer ring), 2 — middle, 3 — strong (centre). */
export type Intensity = 1 | 2 | 3

export interface PetalInfo {
  key: Petal
  name: string
  color: string
  opposite: Petal
}

/** Clockwise from the top, as on the wheel. */
export const petalOrder: Petal[] = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation']

export const petals: Record<Petal, PetalInfo> = {
  joy: { key: 'joy', name: 'Радость', color: '#F2C318', opposite: 'sadness' },
  trust: { key: 'trust', name: 'Доверие', color: '#8CC63F', opposite: 'disgust' },
  fear: { key: 'fear', name: 'Страх', color: '#2E9E5B', opposite: 'anger' },
  surprise: { key: 'surprise', name: 'Удивление', color: '#2BA3C8', opposite: 'anticipation' },
  sadness: { key: 'sadness', name: 'Грусть', color: '#2D7CC0', opposite: 'joy' },
  disgust: { key: 'disgust', name: 'Отвращение', color: '#8E5BA6', opposite: 'trust' },
  anger: { key: 'anger', name: 'Гнев', color: '#E2235A', opposite: 'fear' },
  anticipation: { key: 'anticipation', name: 'Ожидание', color: '#F08A24', opposite: 'surprise' },
}

/** A mixed feeling sits between two neighbouring petals (the first one clockwise before it). */
export const dyads: { key: Dyad; from: [Petal, Petal] }[] = [
  { key: 'optimism', from: ['anticipation', 'joy'] },
  { key: 'love', from: ['joy', 'trust'] },
  { key: 'submission', from: ['trust', 'fear'] },
  { key: 'awe', from: ['fear', 'surprise'] },
  { key: 'disapproval', from: ['surprise', 'sadness'] },
  { key: 'remorse', from: ['sadness', 'disgust'] },
  { key: 'contempt', from: ['disgust', 'anger'] },
  { key: 'aggressiveness', from: ['anger', 'anticipation'] },
]

export interface WordInfo {
  key: string
  word: string
  /** Petal and strength; mixed feelings have none. */
  petal?: Petal
  intensity?: Intensity
  dyad?: Dyad
  explain: string
  body: string
  /** Everyday words that lead here in the search («бесит» → досада, злость). */
  synonyms: string[]
}

const w = (key: string, word: string, explain: string, body: string, synonyms: string[] = []): WordInfo => {
  const [head, tail] = key.split('.')
  return head === 'dyad'
    ? { key, word, dyad: tail as Dyad, explain, body, synonyms }
    : { key, word, petal: head as Petal, intensity: Number(tail) as Intensity, explain, body, synonyms }
}

const list: WordInfo[] = [
  w('joy.1', 'безмятежность', 'тихо и спокойно, ничего не нужно, всё на своих местах', 'расслабленные плечи, медленное ровное дыхание', ['спокойствие', 'покой', 'умиротворение', 'расслабленность', 'тишина']),
  w('joy.2', 'радость', 'светло и приятно, хочется улыбаться и делиться', 'тепло в груди, лёгкость, улыбка появляется сама', ['счастье', 'хорошо', 'приятно', 'довольство', 'удовольствие']),
  w('joy.3', 'восторг', 'радость через край, переполняет, хочется прыгать и кричать', 'сердце стучит чаще, энергия в руках и ногах, трудно усидеть', ['эйфория', 'ликование', 'экстаз', 'кайф']),
  w('trust.1', 'принятие', '«окей, так тоже можно»: не сопротивляешься тому, что есть', 'мягкий выдох, отпускает напряжение в животе', ['смирение', 'согласие', 'терпимость']),
  w('trust.2', 'доверие', 'можно опереться на человека или ситуацию, подвоха не ждёшь', 'открытая поза, спокойное дыхание, расслабленное лицо', ['безопасность', 'опора', 'уверенность', 'надёжность']),
  w('trust.3', 'восхищение', 'смотришь на кого-то или что-то с теплом и уважением, немного снизу вверх', 'расправленная грудь, широко открытые глаза, тянет подойти ближе', ['уважение', 'преклонение', 'обожание', 'гордость']),
  w('fear.1', 'тревога', 'фоновое беспокойство без чёткой причины, «что-то может пойти не так»', 'ком в горле, поверхностное дыхание, руки не находят места', ['беспокойство', 'волнение', 'нервы', 'опасение', 'мандраж', 'неуверенность']),
  w('fear.2', 'страх', 'есть понятная угроза, хочется избежать её или спрятаться', 'холод в животе, напряжённые мышцы, сердце бьётся быстрее', ['боязнь', 'испуг', 'страшно']),
  w('fear.3', 'ужас', 'страх, который парализует, мысли отключаются', 'замираешь, ноги ватные, перехватывает дыхание', ['паника', 'кошмар', 'оцепенение']),
  w('surprise.1', 'возбуждение', 'взбудораженность от нового, внимание резко включилось', 'бодрость, мурашки, хочется двигаться', ['взбудораженность', 'оживление', 'азарт']),
  w('surprise.2', 'удивление', '«ого, не ожидала»: мир на секунду не совпал с ожиданиями', 'брови вверх, короткий резкий вдох', ['неожиданность', 'ого']),
  w('surprise.3', 'изумление', 'так неожиданно, что выбивает из колеи, нужно время переварить', 'приоткрытый рот, ступор, замирание', ['шок', 'потрясение', 'ошеломление']),
  w('sadness.1', 'печаль', 'тихая грусть, лёгкая тоска по чему-то', 'тяжесть в груди, вздохи, хочется укутаться', ['тоска', 'грустно', 'меланхолия', 'ностальгия', 'одиночество']),
  w('sadness.2', 'грусть', 'больно от потери или неудачи, хочется поплакать или побыть одной', 'ком в горле, слёзы близко, опущенные плечи', ['обида', 'плохо', 'хреново', 'уныние', 'подавленность']),
  w('sadness.3', 'горе', 'глубокая боль от большой утраты, накрывает целиком', 'тяжесть во всём теле, нет сил, сдавливает грудь', ['скорбь', 'отчаяние', 'безысходность']),
  w('disgust.1', 'скука', 'неинтересно, время тянется, ничего не цепляет', 'вялость, зевота, тянет отвлечься', ['скучно', 'апатия', 'безразличие', 'лень']),
  w('disgust.2', 'неудовольствие', '«не нравится»: что-то идёт не так, как хотелось', 'поджатые губы, сморщенный нос, напряжённое лицо', ['недовольство', 'неприязнь', 'не нравится']),
  w('disgust.3', 'отвращение', 'сильное «фу», хочется оттолкнуть или отстраниться', 'подташнивает, отворачиваешься, сжимается горло', ['мерзко', 'противно', 'брезгливость', 'гадко']),
  w('anger.1', 'досада', 'мелкое раздражение: что-то пошло не так, но терпимо', 'сжатая челюсть, хочется фыркнуть или закатить глаза', ['раздражение', 'бесит', 'раздражает', 'обидно', 'досадно']),
  w('anger.2', 'злость', 'внутри закипает, хочется резко что-то сделать или сказать', 'жар в лице, сжатые кулаки, напряжённые плечи', ['раздражение', 'бесит', 'злюсь', 'возмущение', 'негодование']),
  w('anger.3', 'гнев', 'ярость, которую трудно удержать, твои границы явно нарушили', 'жар во всём теле, дрожь, громкий голос, сердце колотится', ['ярость', 'бешенство']),
  w('anticipation.1', 'интерес', 'любопытно, хочется узнать больше', 'подаёшься вперёд, внимательный взгляд', ['любопытство', 'интересно']),
  w('anticipation.2', 'ожидание', 'ждёшь, что будет дальше, предвкушаешь или прикидываешь', 'лёгкое напряжение, нетерпение в ногах', ['предвкушение', 'нетерпение', 'надежда']),
  w('anticipation.3', 'настороженность', 'внимание на максимум, следишь за каждой мелочью, готова реагировать', 'напряжённая спина, прищур, задерживаешь дыхание', ['бдительность', 'напряжение', 'начеку']),
  w('dyad.optimism', 'оптимизм', 'веришь, что впереди будет хорошо', 'лёгкость, расправленные плечи', ['надежда', 'вера']),
  w('dyad.love', 'любовь', 'тепло, близость и радость рядом с кем-то или чем-то', 'тепло в груди, мягкость, хочется обнять', ['нежность', 'привязанность', 'близость', 'теплота']),
  w('dyad.submission', 'покорность', 'уступаешь и полагаешься на другого, даже если немного страшно', 'опущенный взгляд, ссутуленные плечи, тихий голос', ['подчинение', 'уступчивость']),
  w('dyad.awe', 'трепет', 'благоговение перед чем-то большим и неожиданным', 'мурашки, замирание, затаённое дыхание', ['благоговение', 'священный страх']),
  w('dyad.disapproval', 'разочарование', 'ожидала другого, и грустно, что не сбылось', 'внутри всё опускается, вздох, тяжесть', ['разочарована', 'облом', 'неодобрение']),
  w('dyad.remorse', 'раскаяние', 'жаль, что поступила именно так', 'тяжесть в груди, жар в лице, хочется спрятаться', ['вина', 'сожаление', 'стыд']),
  w('dyad.contempt', 'презрение', 'смотришь свысока, «как так можно»: отвращение пополам со злостью', 'усмешка уголком губ, взгляд сверху вниз', ['пренебрежение', 'высокомерие']),
  w('dyad.aggressiveness', 'агрессия', 'злость, которая рвётся в действие: хочется напасть или продавить силой', 'наклон вперёд, напряжение во всём теле, сжатые кулаки', ['напор', 'враждебность']),
]

export const emotionWords: Record<string, WordInfo> = Object.fromEntries(list.map((x) => [x.key, x]))

export const isEmotionWord = (key: unknown): key is string => typeof key === 'string' && key in emotionWords

/** The three words of a petal, weak → strong. */
export const petalWords = (p: Petal) => ([1, 2, 3] as const).map((i) => emotionWords[`${p}.${i}`])

export const dyadWord = (d: Dyad) => emotionWords[`dyad.${d}`]

/** The colour a word is drawn in: its petal's, or for a mixed feeling the first of its two. */
export function wordColor(key: string) {
  const x = emotionWords[key]
  if (!x) return '#888'
  if (x.petal) return petals[x.petal].color
  return petals[dyads.find((d) => d.key === x.dyad)!.from[0]].color
}

/** The petals a word belongs to: its own, or both of a mixed feeling's. */
export function wordPetals(key: string): Petal[] {
  const x = emotionWords[key]
  if (!x) return []
  return x.petal ? [x.petal] : dyads.find((d) => d.key === x.dyad)!.from
}

/** Two words from neighbouring petals suggest the mixed feeling between them («Похоже на трепет»). */
export function dyadFor(keys: string[]): string | undefined {
  const ps = new Set(keys.map((k) => emotionWords[k]?.petal).filter(Boolean))
  const d = dyads.find((x) => ps.has(x.from[0]) && ps.has(x.from[1]))
  if (!d) return undefined
  const key = `dyad.${d.key}`
  return keys.includes(key) ? undefined : key
}

/** At most three known words, in order, no repeats. */
export const cleanWords = (keys: unknown): string[] | undefined => {
  if (!Array.isArray(keys)) return undefined
  const out = [...new Set(keys.filter(isEmotionWord))].slice(0, 3)
  return out.length ? out : undefined
}

/** Search by the word itself or a synonym: «раздраж» → досада, злость. */
export function searchWords(q: string): WordInfo[] {
  const s = q.trim().toLowerCase()
  if (!s) return []
  return list.filter((x) => x.word.startsWith(s) || x.word.includes(s) || x.synonyms.some((y) => y.startsWith(s) || y.includes(s)))
}

/** «Что влияет»: a fixed list, not edited in the settings. */
export const mirrorFactors: { key: string; label: string }[] = [
  { key: 'sleep', label: 'сон' },
  { key: 'food', label: 'еда' },
  { key: 'weather', label: 'погода' },
  { key: 'work', label: 'работа' },
  { key: 'people', label: 'люди' },
  { key: 'close', label: 'близкие' },
  { key: 'money', label: 'деньги' },
  { key: 'duties', label: 'обязанности' },
  { key: 'cycle', label: 'цикл' },
  { key: 'moon', label: 'Луна' },
]

export const factorLabel = (key: string) => mirrorFactors.find((f) => f.key === key)?.label ?? key
