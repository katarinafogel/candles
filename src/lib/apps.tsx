// Three apps on one site, each its own build with its own address, manifest and icon:
//   showcase  /            — «Другие проекты» and the candle review form (no sign-in)
//   workshop  /workshop/   — the candle workshop (role master)
//   grimoire  /grimoire/   — the grimoire (role witch)
// Inside an app addresses are its own (React Router's basename); a page of another app is a full page load.
import { useEffect } from 'react'
import { Link as RouterLink, useNavigate, type LinkProps } from 'react-router-dom'

export type AppId = 'showcase' | 'workshop' | 'grimoire'

/** This build's app (vite.config.ts sets it per build; tests run as the workshop). */
export const APP: AppId = (import.meta.env.VITE_APP as AppId | undefined) ?? 'workshop'

export const apps: Record<AppId, { name: string; short: string; base: string }> = {
  showcase: { name: 'Витрина', short: 'Витрина', base: '' },
  workshop: { name: 'Мастерская свечей', short: 'Мастерская', base: '/workshop' },
  grimoire: { name: 'Гримуар дел', short: 'Гримуар', base: '/grimoire' },
}

/** The address of a page of an app, from the site's root: appHref('grimoire', '/people/x') → /grimoire/people/x. */
export const appHref = (app: AppId, path = '/') => `${apps[app].base}${path.startsWith('/') ? path : `/${path}`}`

/** Opens a page of any app: inside this one by the router, another one by loading it. */
export function useGo() {
  const navigate = useNavigate()
  return (app: AppId, path: string, replace = false) => {
    if (app === APP) navigate(path, { replace })
    else if (replace) location.replace(appHref(app, path))
    else location.assign(appHref(app, path))
  }
}

/** A link to a page of any app (works with Chakra's asChild). */
export function AppLink({ app, to, ...rest }: Omit<LinkProps, 'to'> & { app: AppId; to: string }) {
  if (app === APP) return <RouterLink to={to} {...rest} />
  return <a href={appHref(app, to)} {...(rest as object)} />
}

/** Leaves for another app right away (instead of <Navigate> across apps). */
export function GoApp({ app, to = '/' }: { app: AppId; to?: string }) {
  useEffect(() => {
    location.replace(appHref(app, to))
  }, [app, to])
  return null
}
