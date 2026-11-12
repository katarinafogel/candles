import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Tokens never change once created, so one fetch per candle per session is enough.
const cache = new Map<string, string>()

/** Secret review tokens for the QR links, created on the server on first request. */
export async function fetchReviewTokens(ids: string[]): Promise<Record<string, string>> {
  const missing = ids.filter((id) => !cache.has(id))
  if (missing.length) {
    const { data, error } = await supabase.rpc('review_tokens', { p_ids: missing })
    if (error) throw new Error(error.message)
    for (const [id, t] of Object.entries((data ?? {}) as Record<string, string>)) cache.set(id, t)
  }
  return Object.fromEntries(ids.filter((id) => cache.has(id)).map((id) => [id, cache.get(id)!]))
}

export type TokenState = { tokens: Record<string, string>; loading: boolean; error: boolean }

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
