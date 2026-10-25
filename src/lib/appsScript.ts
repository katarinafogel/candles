// Client of the Google Apps Script web app (spec 6.5). Requests are POST with text/plain
// so the browser does not send a CORS preflight, which Apps Script cannot answer.
import type { Review } from '../types'

async function call<T>(url: string, body: Record<string, unknown>): Promise<T> {
  if (!url) throw new Error('Не указан адрес Apps Script')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`Apps Script ответил ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error)
  return json as T
}

export const registerCandle = (url: string, token: string, c: { id: string; name: string; instruction: string }) =>
  call<{ ok: true }>(url, { action: 'register', token, ...c })

export const fetchCandle = (url: string, id: string) =>
  call<{ id: string; name?: string; instruction?: string; found: boolean }>(url, { action: 'candle', id })

export const sendFeedback = (url: string, review: Omit<Review, 'read' | 'source'>) =>
  call<{ ok: true; duplicate?: boolean }>(url, { action: 'feedback', review })

export const pullReviews = (url: string, token: string, since?: string) =>
  call<{ reviews: Omit<Review, 'read' | 'source'>[]; now: string }>(url, { action: 'pull', token, since: since ?? '' })
