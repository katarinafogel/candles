// Icons from svgrepo, one file each, a folder per set, drawn in currentColor so they take the
// text colour. A new icon: drop its .svg into its set's folder and it shows up; names are unique
// across sets.
const files = import.meta.glob('./*/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export interface IconSet {
  id: string
  label: string
  link: string
  names: string[]
}

const sets: Omit<IconSet, 'names'>[] = [
  { id: 'dazzle', label: 'Dazzle Line', link: 'https://www.svgrepo.com/collection/dazzle-line-icons/1' },
  { id: 'magic', label: 'Magic Glyph', link: 'https://www.svgrepo.com/collection/magic-glyph-icons/' },
]

const parsed = Object.entries(files)
  .map(([path, svg]) => {
    const [, set, file] = path.split('/')
    return { set, name: file.slice(0, -4), svg }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

export const icons: Record<string, string> = Object.fromEntries(parsed.map((i) => [i.name, i.svg]))

export const iconSets: IconSet[] = sets.map((s) => ({ ...s, names: parsed.filter((i) => i.set === s.id).map((i) => i.name) }))

export type IconName = keyof typeof icons

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: 'inline-block', width: size, height: size, lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: icons[name].replace('<svg ', '<svg width="100%" height="100%" ') }}
    />
  )
}
