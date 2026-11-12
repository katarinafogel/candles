// Tag colours and suggestions. A tag gets a steady colour from its name until the witch picks her own
// (meta.tagColors); suggestions put the tags she uses most first.
import type { GrimoireState } from './types'

/**
 * Colours a tag may wear, all from the theme's palette: each is a CSS variable `--g-tag-<name>`
 * (themes.ts), so the same tag reads right in every theme.
 */
export const tagPalettes = ['slate', 'pine', 'eucalyptus', 'sage', 'leaf', 'mint', 'stone', 'taupe', 'cream'] as const
export type TagPalette = (typeof tagPalettes)[number]

/** Colours chosen before the palette moved to the theme's own: the nearest of the new ones. */
const legacy: Record<string, TagPalette> = {
  emerald: 'sage',
  ember: 'taupe',
  teal: 'eucalyptus',
  cyan: 'mint',
  blue: 'slate',
  purple: 'pine',
  pink: 'cream',
  red: 'stone',
  orange: 'taupe',
  yellow: 'cream',
  gray: 'stone',
}

/** The chosen colour, or one picked from the name so the same tag always looks the same. */
export function tagPalette(tag: string, colors: Record<string, string>): TagPalette {
  const own = colors[tag]
  if (own && (tagPalettes as readonly string[]).includes(own)) return own as TagPalette
  if (own && legacy[own]) return legacy[own]
  let h = 0
  for (const c of tag) h = (h * 31 + c.codePointAt(0)!) >>> 0
  return tagPalettes[h % tagPalettes.length]
}

/** Every tag in the book, the most used first (ties in alphabetical order). */
export function tagsByUse(g: Pick<GrimoireState, 'tasks'> & Partial<Pick<GrimoireState, 'wishes' | 'jars'>>): string[] {
  const n = new Map<string, number>()
  const count = (tags?: string[]) => {
    for (const x of tags ?? []) n.set(x, (n.get(x) ?? 0) + 1)
  }
  for (const t of Object.values(g.tasks)) count(t.tags)
  for (const w of Object.values(g.wishes ?? {})) count(w.tags)
  for (const j of Object.values(g.jars ?? {})) count(j.tags)
  return [...n.keys()].sort((a, b) => n.get(b)! - n.get(a)! || a.localeCompare(b, 'ru'))
}
