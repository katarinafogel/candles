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

/** A colour she mixed herself: «#rrggbb», kept in the same meta.tagColors. */
export const isOwnColor = (c?: string): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c)

/** The tag's colour as CSS: her own «#rrggbb», or the theme's variable for a palette colour. */
export function tagColor(tag: string, colors: Record<string, string>): string {
  const own = colors[tag]
  return isOwnColor(own) ? own : `var(--g-tag-${tagPalette(tag, colors)})`
}

type Tagged = { tags?: string[] }
type TagSources = Pick<GrimoireState, 'tasks'> &
  Partial<Pick<GrimoireState, 'wishes' | 'jars' | 'journal' | 'notes' | 'books'>> & { meta?: { spells?: Tagged[] } }

/** How many things wear each tag: deeds, wishes, jars, mirror entries, notes, books and templates. */
export function tagCounts(g: TagSources): Map<string, number> {
  const n = new Map<string, number>()
  const count = (x: Tagged) => {
    for (const t of x.tags ?? []) n.set(t, (n.get(t) ?? 0) + 1)
  }
  for (const c of [g.tasks, g.wishes, g.jars, g.journal, g.notes, g.books]) Object.values((c ?? {}) as Record<string, Tagged>).forEach(count)
  g.meta?.spells?.forEach(count)
  return n
}

/** Every tag in the book, the most used first (ties in alphabetical order). */
export function tagsByUse(g: TagSources): string[] {
  const n = tagCounts(g)
  return [...n.keys()].sort((a, b) => n.get(b)! - n.get(a)! || a.localeCompare(b, 'ru'))
}
