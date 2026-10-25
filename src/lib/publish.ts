import type { AppDispatch, RootState } from '../store'
import { actions } from '../store/dataSlice'
import type { Review } from '../types'
import { pullReviews, registerCandle } from './appsScript'
import { appsScriptUrl } from './config'

let running = false

/** Registers given candles whose name/instruction did not reach Apps Script yet (e.g. offline). */
export async function publishPending(getState: () => RootState, dispatch: AppDispatch) {
  if (running || !navigator.onLine) return
  const { data, local } = getState()
  const url = appsScriptUrl(data.settings)
  if (!url || !local.appsScriptToken) return
  running = true
  try {
    for (const c of Object.values(data.candles)) {
      if (c.published || c.stage !== 'given') continue
      await publishCandle(getState, dispatch, c.id)
    }
  } finally {
    running = false
  }
}

export async function publishCandle(getState: () => RootState, dispatch: AppDispatch, id: string) {
  const { data, local } = getState()
  const c = data.candles[id]
  const url = appsScriptUrl(data.settings)
  if (!c || !url || !local.appsScriptToken) return false
  try {
    await registerCandle(url, local.appsScriptToken, {
      id: c.id,
      name: c.name,
      instruction: (c.instructionId && data.instructions[c.instructionId]?.text) || '',
    })
    dispatch(actions.updateCandle({ id, published: true }))
    return true
  } catch {
    return false
  }
}

export async function pullAll(getState: () => RootState, dispatch: AppDispatch) {
  const { data, local } = getState()
  const url = appsScriptUrl(data.settings)
  if (!url) throw new Error('Укажите адрес Apps Script в настройках')
  if (!local.appsScriptToken) throw new Error('Укажите токен Apps Script в настройках')
  const res = await pullReviews(url, local.appsScriptToken, data.settings.lastPullAt)
  const known = getState().data.reviews
  const fresh: Review[] = res.reviews
    .filter((r) => r.id && !known[r.id])
    .map((r) => ({ ...r, source: 'qr', read: false }))
  dispatch(actions.addReviews(fresh))
  dispatch(actions.updateSettings({ lastPullAt: res.now }))
  return fresh.length
}

/** The recipient's «Скопировать ответ» text is the review JSON; it is imported the same way. */
export function parsePastedReview(text: string): Review {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('В тексте нет ответа')
  const r = JSON.parse(text.slice(start, end + 1))
  if (!r.id || !r.candleId) throw new Error('В ответе нет ИД свечи')
  return { ...r, source: 'qr', read: false }
}
