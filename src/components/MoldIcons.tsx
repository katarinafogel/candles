// Shape icons drawn from photos of the castings: white bodies with lines in the card's ink color.
import type { Mold, MoldIcon } from '../types'

const ink = 'var(--card-ink, currentColor)'

function Pot() {
  // «Шкатулка овал горшочек»: a round bowl, a smaller domed lid and a flared knob.
  return (
    <>
      <path d="M20 6.5h8l-2 5h-4z" />
      <path d="M12.5 21.5C12.5 15 17.5 11.5 24 11.5S35.5 15 35.5 21.5z" />
      <path d="M9 21.5h30c1.2 8.5-1.6 16.4-7.4 19H16.4C10.6 37.9 7.8 30 9 21.5z" />
      <path d="M9.4 24.5h29.2" className="mi-d" />
    </>
  )
}

function Lantern() {
  // «Лампа»: a hexagonal lantern with a pointed roof and a finial.
  return (
    <>
      <path d="M24 2.5c1.6 2.2 2.2 3.7 2.2 5.2a2.2 2.2 0 0 1-4.4 0c0-1.5.6-3 2.2-5.2z" />
      <path d="M22.3 10h3.4v2.6h-3.4z" />
      <path d="M24 12.6 39 20.5H9z" />
      <path d="M7.5 20.5h33l-1 2.2h-31z" />
      <path d="M11.5 22.7h25l-3.2 15.8H14.7z" />
      <path d="M12.5 38.5h23l1.5 3H11z" />
      <path d="M11 41.5h26v2.5H11z" />
      <g className="mi-d">
        <path d="M24 12.6 19 20.5M24 12.6 29 20.5" />
        <path d="M19.3 22.7l1 15.8M28.7 22.7l-1 15.8" />
        <path d="M16 25.5l.9 10M32 25.5l-.9 10M22.2 25.5h3.6M22.2 35.5h3.6" />
        <circle cx="24" cy="17.6" r="1.3" />
      </g>
    </>
  )
}

function Bird() {
  // «Птичка»: a bird-shaped box with a raised tail, a small beak and the lid seam across.
  return (
    <>
      <path d="M5.5 12.5c4.5 3.4 9 5.2 13.5 4.6 2.8-3 6.4-4.6 10.4-4.6 5.4 0 8.8 3.4 9.2 8l3.4 1.8-3.4 1.3c.9 8.4-5.6 14.9-14.6 14.9-8 0-12.6-5.2-13.2-11C9.7 23 7.5 17.3 5.5 12.5z" />
      <path className="mi-d" d="M11.2 27.5c9 1.6 19.6.8 27.6-3.4" />
    </>
  )
}

function Windows() {
  // «Колонна с окнами»: a square box with a cornice, two arched windows and columns.
  return (
    <>
      <path d="M7.5 8.5h33l-2.2 4.2H9.7z" />
      <path d="M10.5 12.7h27v2.3h-27z" />
      <path d="M11 15h26v23.3H11z" />
      <path d="M9.8 38.3h28.4v3.4H9.8z" />
      <path d="M13.6 36V22.6a4.4 4.4 0 0 1 8.8 0V36z" />
      <path d="M25.6 36V22.6a4.4 4.4 0 0 1 8.8 0V36z" />
      <g className="mi-d">
        <path d="M18 18.2V36M13.6 27.5h8.8M13.6 31.8h8.8M14 22.5l4 1.5 4-1.5" />
        <path d="M30 18.2V36M25.6 27.5h8.8M25.6 31.8h8.8M26 22.5l4 1.5 4-1.5" />
        <path d="M24 15v23.3M12.2 15v23.3M35.8 15v23.3" />
      </g>
    </>
  )
}

const shapes: Record<MoldIcon, () => JSX.Element> = { pot: Pot, lantern: Lantern, bird: Bird, windows: Windows }

export const moldIconLabel: Record<MoldIcon, string> = {
  pot: 'горшочек',
  lantern: 'лампа',
  bird: 'птичка',
  windows: 'окна с колоннами',
}

/** The icon chosen for a mold, or one guessed from its name. */
export function moldIconOf(m: Pick<Mold, 'name' | 'icon'> | undefined): MoldIcon | undefined {
  if (!m) return undefined
  if (m.icon) return m.icon
  const n = m.name.toLowerCase()
  if (/горшоч|овал/.test(n)) return 'pot'
  if (/ламп|фонар/.test(n)) return 'lantern'
  if (/птич|птиц/.test(n)) return 'bird'
  if (/колонн|окн/.test(n)) return 'windows'
  return undefined
}

export function MoldFigure({ icon, size = 44 }: { icon: MoldIcon; size?: number }) {
  const Shape = shapes[icon]
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={{ overflow: 'visible' }}>
      <g fill="#fffdf8" stroke={ink} strokeWidth="1.15" strokeLinejoin="round" strokeLinecap="round">
        <style>{'.mi-d{fill:none;stroke-width:.8;stroke-opacity:.85}'}</style>
        <Shape />
      </g>
    </svg>
  )
}

/** The icon for a card, or nothing when the mold has none. */
export function figureOf(m: Pick<Mold, 'name' | 'icon'> | undefined) {
  const icon = moldIconOf(m)
  return icon ? <MoldFigure icon={icon} /> : undefined
}
