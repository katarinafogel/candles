// The site's projects as separate apps: the workshop and the grimoire. Each has its own manifest and
// icon (public/manifest*.webmanifest), so a phone installs them as two apps. index.html picks the
// manifest on load; here it follows navigation, and the browser's install prompt is kept for the
// projects page.
import { useEffect, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'

export type AppId = 'workshop' | 'grimoire'

export const apps: Record<AppId, { name: string; short: string; start: string; manifest: string; touchIcon: string; icon: string }> = {
  workshop: { name: 'Мастерская свечей', short: 'Свечи', start: '/', manifest: './manifest.webmanifest', touchIcon: './apple-touch-icon.png', icon: './icon.svg' },
  grimoire: { name: 'Гримуар дел', short: 'Гримуар', start: '/g', manifest: './manifest-grimoire.webmanifest', touchIcon: './apple-touch-icon-grimoire.png', icon: './icon-grimoire.svg' },
}

/** The app an address belongs to; on the projects page the one chosen for install (`?app=`). */
export function appOf(pathname: string): AppId {
  const asked = new URLSearchParams(window.location.search).get('app')
  if (pathname === '/apps' && (asked === 'grimoire' || asked === 'workshop')) return asked
  return pathname === '/g' || pathname.startsWith('/g/') ? 'grimoire' : 'workshop'
}

function setHref(id: string, href: string) {
  const el = document.getElementById(id) as HTMLLinkElement | null
  if (el && el.getAttribute('href') !== href) el.setAttribute('href', href)
}

export function applyApp(app: AppId) {
  const a = apps[app]
  setHref('app-manifest', a.manifest)
  setHref('app-touch-icon', a.touchIcon)
  setHref('app-icon', a.icon)
  document.getElementById('app-title')?.setAttribute('content', a.short)
  document.title = a.name
}

/** Keeps the manifest, icon and title in step with the project on screen. */
export function useAppManifest() {
  const { pathname } = useLocation()
  useEffect(() => applyApp(appOf(pathname)), [pathname])
}

// ---------- install ----------

interface InstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPrompt | undefined
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  // Chrome on Android offers the install of the manifest that is linked right now.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPrompt
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = undefined
    emit()
  })
}

/** The browser's install prompt, when it offered one (Chrome, Edge); none on iPhone. */
export function useInstallPrompt() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
    () => deferred,
  )
}

export async function promptInstall() {
  if (!deferred) return false
  const d = deferred
  deferred = undefined
  emit()
  await d.prompt()
  return (await d.userChoice).outcome === 'accepted'
}

export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Reloads the projects page with this app's manifest, so the browser offers to install that one. */
export function chooseForInstall(app: AppId) {
  const url = new URL(window.location.href)
  url.searchParams.set('app', app)
  url.hash = '#/apps'
  window.location.replace(url.toString())
}
