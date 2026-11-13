import { createClient } from '@supabase/supabase-js'

const url: string = import.meta.env.VITE_SUPABASE_URL ?? ''
const key: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const supabaseConfigured = !!url && !!key

// PKCE puts the sign-in result into ?code=… instead of the #fragment that HashRouter owns.
export const supabase = createClient(url || 'http://localhost', key || 'missing', {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
})

/** Where Google and email links send the person back: the app root without hash or query. */
export const authRedirect = () => `${location.origin}${location.pathname}`
