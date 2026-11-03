// Line icons from the «Dazzle Line Icons» set (svgrepo), one file each in ./svg, drawn in
// currentColor so they take the text colour. A new icon: drop its .svg here and it shows up.
const files = import.meta.glob('./svg/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export const icons: Record<string, string> = Object.fromEntries(
  Object.entries(files)
    .map(([path, svg]) => [path.slice(6, -4), svg] as const)
    .sort(([a], [b]) => a.localeCompare(b)),
)

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
