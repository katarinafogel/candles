// /r/<code>: the short link from a candle's QR. The base knows where the code leads; the page then
// opens the candle's review form (/candles-review/<master>/<candle>/<token>).
import { Center, Spinner } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { NotFound } from '../../components/NotFound'
import { reviewPath } from '../../lib/config'
import { supabase } from '@shared/lib/supabase'

export default function ShortLink() {
  const { code = '' } = useParams()
  const [to, setTo] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    supabase.rpc('resolve_review_code', { p_code: code }).then(({ data, error }) => {
      const r = data as { slug: string; candle: string; token: string } | null
      setTo(!error && r ? reviewPath(r.slug, r.candle, r.token) : null)
    })
  }, [code])
  if (to === undefined)
    return (
      <Center minH="100dvh">
        <Spinner color="ember.300" />
      </Center>
    )
  if (to === null) return <NotFound home="/projects" homeLabel="К проектам" />
  return <Navigate to={to} replace />
}
