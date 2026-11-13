import type { Settings } from '@workshop-core/types'

/** The account for trying things out: only it can wipe itself clean. */
export const testAccountEmail = 'ww@ww.ww'

/** The site's address for links that leave the device (QR, invites): the setting, or this site. */
export function publicBase(s?: Settings) {
  return (s?.publicUrl || location.origin).replace(/[?#].*$/, '').replace(/\/+$/, '')
}

/** The review form of a candle in the showcase (the token proves the person holds the candle). */
export const reviewPath = (slug: string, id: string, token?: string) => `/candles-review/${slug}/${id}${token ? `/${token}` : ''}`

/**
 * QR link: the master's address keeps candle numbers unique across masters;
 * the secret token proves the person holds the candle (the server rejects reviews without it).
 */
export const candleLink = (slug: string, id: string, token: string, s?: Settings) => `${publicBase(s)}${reviewPath(slug, id, token)}`

/** The short QR link: the showcase looks the code up and opens the candle's review form. */
export const shortLink = (code: string, s?: Settings) => `${publicBase(s)}/r/${code}`
