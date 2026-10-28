// Turning push notifications on for this device: the browser's permission, a subscription with the
// server's VAPID key, and a row in push_subscriptions. On iPhone this works only in the app added to
// the home screen.
import { supabase } from './supabase'

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const b64ToBytes = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0))
}

/** The service worker, or none if it doesn't come up in a few seconds (dev server, first load). */
const worker = () => Promise.race([navigator.serviceWorker.ready, new Promise<undefined>((r) => setTimeout(() => r(undefined), 4000))])

export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await worker()
  return reg ? reg.pushManager.getSubscription() : null
}

export async function enablePush(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!pushSupported()) return { ok: false, reason: 'Этот браузер не умеет уведомления. На iPhone — только из приложения на экране «Домой».' }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, reason: 'Уведомления запрещены в браузере — их можно разрешить в настройках сайта.' }
  const { data, error } = await supabase.functions.invoke<{ publicKey: string }>('grimoire-push/public-key', { method: 'GET' })
  if (error || !data?.publicKey) return { ok: false, reason: 'Сервер уведомлений пока не отвечает.' }
  const reg = await worker()
  if (!reg) return { ok: false, reason: 'Приложение ещё не готово к уведомлениям — обнови страницу и попробуй снова.' }
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(data.publicKey) }))
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error: e2 } = await supabase.from('push_subscriptions').upsert({ endpoint: j.endpoint, keys: j.keys, user_agent: navigator.userAgent.slice(0, 200) })
  if (e2) return { ok: false, reason: `Не получилось сохранить подписку: ${e2.message}` }
  return { ok: true }
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

export async function testPush() {
  const { error } = await supabase.functions.invoke('grimoire-push/test', { method: 'POST' })
  return !error
}
