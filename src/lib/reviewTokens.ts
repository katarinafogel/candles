import { useEffect, useState } from 'react'
import { supabase } from '@shared/lib/supabase'

/** A candle's review link: the secret token, and the short code that stands for the whole link (/r/<code>). */
export type ReviewLink = { token: string; code: string }

// Links never change once created, so one fetch per candle per session is enough.
const cache = new Map<string, ReviewLink>()

/** Review links for the QR codes, created on the server on first request. */
export async function fetchReviewTokens(ids: string[]): Promise<Record<string, ReviewLink>> {
  const missing = ids.filter((id) => !cache.has(id))
  if (missing.length) {
    const { data, error } = await supabase.rpc('review_links', { p_ids: missing })
    if (error) throw new Error(error.message)
    for (const [id, l] of Object.entries((data ?? {}) as Record<string, ReviewLink>)) cache.set(id, l)
  }
  return Object.fromEntries(ids.filter((id) => cache.has(id)).map((id) => [id, cache.get(id)!]))
}

export type TokenState = { tokens: Record<string, ReviewLink>; loading: boolean; error: boolean }

export function useReviewTokens(ids: string[]): TokenState {
  const key = ids.join(',')
  const [state, setState] = useState<TokenState>({ tokens: {}, loading: true, error: false })
  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: false }))
    fetchReviewTokens(ids).then(
      (tokens) => alive && setState({ tokens, loading: false, error: false }),
      () => alive && setState({ tokens: {}, loading: false, error: true }),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state
}

/** Server errors of submit_review that mean the QR code itself is wrong. */
export const isTokenError = (message: string) => /bad token|token required/.test(message)
