import type { Settings } from '@workshop-core/types'

/** The account for trying things out: only it can wipe itself clean. */
export const testAccountEmail = 'ww@ww.ww'

export function publicBase(s?: Settings) {
  const base = s?.publicUrl || `${location.origin}${location.pathname}`
  return base.replace(/[?#].*$/, '').replace(/\/?$/, '/')
}

/**
 * QR link: the master's address keeps candle numbers unique across masters;
 * the secret token proves the person holds the candle (the server rejects reviews without it).
 */
export const candleLink = (slug: string, id: string, token: string, s?: Settings) => `${publicBase(s)}#/c/${slug}/${id}/${token}`
