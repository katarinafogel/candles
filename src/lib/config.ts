import type { Settings } from '../types'

/** Baked in at build time so the recipient's page (which has no master data) can reach Apps Script. */
export const BUILD_APPS_SCRIPT_URL: string = import.meta.env.VITE_APPS_SCRIPT_URL ?? ''

export const appsScriptUrl = (s?: Settings) => s?.appsScriptUrl || BUILD_APPS_SCRIPT_URL

export function publicBase(s?: Settings) {
  const base = s?.publicUrl || `${location.origin}${location.pathname}`
  return base.replace(/#.*$/, '').replace(/\/?$/, '/')
}

export const candleLink = (id: string, s?: Settings) => `${publicBase(s)}#/c/${id}`
