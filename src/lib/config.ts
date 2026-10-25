import type { Settings } from '../types'

export function publicBase(s?: Settings) {
  const base = s?.publicUrl || `${location.origin}${location.pathname}`
  return base.replace(/[?#].*$/, '').replace(/\/?$/, '/')
}

/** QR link: the master's address keeps candle numbers unique across masters. */
export const candleLink = (slug: string, id: string, s?: Settings) => `${publicBase(s)}#/c/${slug}/${id}`
