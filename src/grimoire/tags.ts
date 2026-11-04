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
export function tagsByUse(g: Pick<GrimoireState, 'tasks'>): string[] {
  const n = new Map<string, number>()
  for (const t of Object.values(g.tasks)) for (const x of t.tags) n.set(x, (n.get(x) ?? 0) + 1)
  return [...n.keys()].sort((a, b) => n.get(b)! - n.get(a)! || a.localeCompare(b, 'ru'))
}
