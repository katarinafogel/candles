// Tag colours and suggestions. A tag gets a steady colour from its name until the witch picks her own
// (meta.tagColors); suggestions put the tags she uses most first.
import type { GrimoireState } from './types'

/** Colour palettes a tag may wear: the theme's sage and candle glow plus Chakra's own. */
export const tagPalettes = ['emerald', 'ember', 'teal', 'cyan', 'blue', 'purple', 'pink', 'red', 'orange', 'yellow', 'gray'] as const
export type TagPalette = (typeof tagPalettes)[number]

/** The chosen colour, or one picked from the name so the same tag always looks the same. */
export function tagPalette(tag: string, colors: Record<string, string>): TagPalette {
  const own = colors[tag]
  if (own && (tagPalettes as readonly string[]).includes(own)) return own as TagPalette
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

/** Tags starting with what is typed (case-insensitive), without those already on the deed. */
export function suggestTags(prefix: string, tags: string[], exclude: string[] = [], limit = 6): string[] {
  const q = prefix.replace(/^#/, '').toLowerCase()
  return tags.filter((t) => t.startsWith(q) && t !== q && !exclude.includes(t)).slice(0, limit)
}

/** The «#ta» being typed at the end of a quick-add line, if any. */
export function typingTag(line: string): string | undefined {
  const m = /(?:^|\s)#([^\s#]*)$/.exec(line)
  return m ? m[1] : undefined
}

/** The line with the tag being typed completed, ready for the next word. */
export const completeTag = (line: string, tag: string) => line.replace(/#[^\s#]*$/, `#${tag} `)
