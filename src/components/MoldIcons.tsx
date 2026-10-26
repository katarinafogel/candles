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

/** A small five-pointed star, filled with the ink color. */
function star(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.45 : r
    return `${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`
  })
  return <path key={`${cx}-${cy}`} className="mi-f" d={`M${pts.join('L')}Z`} />
}

function Cathedral() {
  // «Собор»: a round tower box with a flat lid, a small domed turret, arches with rose windows.
  return (
    <>
      <path d="M20.5 7.2C20.5 4.2 22 2.8 24 2.8s3.5 1.4 3.5 4.4z" />
      <path d="M21.2 7.2h5.6v5h-5.6z" />
      <path d="M11 15.6h26v21c0 1.6-5.8 2.8-13 2.8s-13-1.2-13-2.8z" />
      <path d="M9.8 37c0 2 6.4 3.4 14.2 3.4s14.2-1.4 14.2-3.4v2.2c0 2-6.4 3.4-14.2 3.4S9.8 41.2 9.8 39.2z" />
      <path d="M8.5 13.6c0-1 7-1.8 15.5-1.8s15.5.8 15.5 1.8v1.8c0 1-7 1.8-15.5 1.8S8.5 16.4 8.5 15.4z" />
      <g className="mi-d">
        <path d="M22.3 4.2v3M25.7 4.2v3M20.8 5.6h6.4" />
        <path d="M13.2 35V23.3a5.3 5.3 0 0 1 10.6 0V35M24.2 35V23.3a5.3 5.3 0 0 1 10.6 0V35" />
        <circle cx="18.5" cy="23.5" r="2.7" />
        <circle cx="29.5" cy="23.5" r="2.7" />
        <path d="M17 35v-3.2a1.5 1.5 0 0 1 3 0V35M28 35v-3.2a1.5 1.5 0 0 1 3 0V35" />
        <path d="M14.5 18.2q1.2 1.3 2.4 0M31.1 18.2q1.2 1.3 2.4 0" />
      </g>
    </>
  )
}

function Shell() {
  // «Ракушка»: a long conch dish with a wavy opening and a pointed spire.
  return (
    <>
      <path d="M4.5 22c4-7 13.5-9 22.5-7 6.5 1.5 12.5 5 17 10-6 3.5-14 7-22 7-9.5 0-16.5-4-17.5-10z" />
      <g className="mi-d">
        <path d="M8 21c3-4 9-5.2 14-3.7 2-1.3 4.6-.4 5.6 1.7-2.6 3.2-8.6 5-14.6 5-3 0-4.8-1.2-5-3z" />
        <path d="M32.5 18.3c1.2 2.8 1.2 5.8 0 8.7M37.6 21.2c.9 1.6.9 3.6 0 5.2" />
      </g>
    </>
  )
}

function Bowl() {
  // «Круглая миска»: a low round bowl seen from above at an angle.
  return (
    <>
      <path d="M7 20c0-3.3 7.6-6 17-6s17 2.7 17 6v7c0 4-7.6 7-17 7S7 31 7 27z" />
      <g className="mi-d">
        <path d="M7 20c0 3.3 7.6 6 17 6s17-2.7 17-6" />
        <ellipse cx="24" cy="20" rx="13.6" ry="4.1" />
      </g>
    </>
  )
}

function Monstera() {
  // «Лист монстера»: a heart-shaped leaf dish with a stem and notched edges.
  return (
    <>
      <path d="M23 3.5h2v6.5h-2z" />
      <path d="M24 9.5C20 6.2 12.3 6.2 8.6 11 5 16 6 24 10 30c4 6 10 10 14 13 4-3 10-7 14-13 4-6 5-14 1.4-19C35.7 6.2 28 6.2 24 9.5z" />
      <g className="mi-d">
        <path d="M24 10v31" />
        <path d="M7.6 17.5l5.6 2M7.2 24.4l6.4.8M10.6 31.4l5.4-1.8M40.4 17.5l-5.6 2M40.8 24.4l-6.4.8M37.4 31.4 32 29.6" />
        <path d="M24 17l-6 3.5M24 17l6 3.5M24 25l-6 3M24 25l6 3" />
      </g>
    </>
  )
}

function LeafDish() {
  // «Тарелка лист»: an oval leaf dish with a raised midrib and fine veins.
  return (
    <>
      <path d="M24 3.5c9 5 13 14.5 12 24.5-1 9-6 15-12 16-6-1-11-7-12-16-1-10 3-19.5 12-24.5z" />
      <g className="mi-d">
        <path d="M24 5.5c1.2 12 1.2 25 0 37" />
        <path d="M24.3 13l-6.5 4M24.3 13l6.5 4M24.5 20l-8.5 4.5M24.5 20l8.5 4.5M24.5 27.5l-8.5 4.5M24.5 27.5l8.5 4.5M24.3 35l-6 3.5M24.3 35l6 3.5" />
      </g>
    </>
  )
}

function Chest() {
  // «Сундук»: a box with a rounded lid, metal bands, corners and a lock.
  return (
    <>
      <path d="M8 22v-5c0-5 7-7.5 16-7.5S40 12 40 17v5z" />
      <path d="M8 22h32v18H8z" />
      <path d="M22.4 20.2h3.2v4.6h-3.2z" />
      <g className="mi-d">
        <path d="M16.5 10.6V22M31.5 10.6V22" />
        <path d="M12 25.5h24v11H12z" />
        <path d="M8 26.5h3M8 35.5h3M37 26.5h3M37 35.5h3" />
        <path d="M20.5 31l3.5-3 3.5 3-3.5 3z" />
      </g>
    </>
  )
}

function RoundBox() {
  // «Круглая шкатулка»: a low round box under a wider flat lid with a wax seal.
  return (
    <>
      <path d="M10 23.5V33c0 3 6.3 5 14 5s14-2 14-5v-9.5" />
      <path d="M7.5 17c0-2.5 7.4-4.5 16.5-4.5s16.5 2 16.5 4.5v3c0 2.5-7.4 4.5-16.5 4.5S7.5 22.5 7.5 20z" />
      <g className="mi-d">
        <path d="M7.5 17c0 2.5 7.4 4.5 16.5 4.5s16.5-2 16.5-4.5" />
      </g>
      <ellipse className="mi-f" cx="24" cy="16.6" rx="4" ry="1.7" />
    </>
  )
}

function HeartDish() {
  // «Тарелка сердечко»: a heart-shaped bowl with its inner rim.
  return (
    <>
      <path d="M24 40c-8-6-17-12-17-21 0-5.5 4-9 8.5-9 3.5 0 6.5 2 8.5 5 2-3 5-5 8.5-5 4.5 0 8.5 3.5 8.5 9 0 9-9 15-17 21z" />
      <path className="mi-d" d="M24 35c-6-4-13-9-13-15.5 0-4 2.8-6 5.5-6 3 0 5.5 2 7.5 5 2-3 4.5-5 7.5-5 2.7 0 5.5 2 5.5 6C37 26 30 31 24 35z" />
    </>
  )
}

function Ornament() {
  // «Шар с омелой»: a round bauble box with a hanging loop and holly leaves.
  return (
    <>
      <circle cx="24" cy="6.8" r="3.2" />
      <path d="M21 9.6h6v3.2h-6z" />
      <circle cx="24" cy="28" r="15.5" />
      <circle cx="24" cy="6.8" r="1.3" className="mi-d" />
      <g className="mi-d">
        <path d="M9.4 22.5c8.5 2.5 20.7 2.5 29.2 0M10.2 35c8 2.5 19.6 2.5 27.6 0" />
        <path d="M14.5 29.5c1.5-2.2 4.2-2.8 6.2-1.8-1.4 2.2-4 2.8-6.2 1.8zM33.5 29.5c-1.5-2.2-4.2-2.8-6.2-1.8 1.4 2.2 4 2.8 6.2 1.8z" />
        <path d="M18 15.5l2 3.5M24 14.2v4M30 15.5l-2 3.5" />
      </g>
      <circle className="mi-f" cx="22.7" cy="29.6" r="1.1" />
      <circle className="mi-f" cx="25.3" cy="29.6" r="1.1" />
    </>
  )
}

function StarJar() {
  // «Банка звезды»: a rounded jar with a flat lid, sprinkled with stars.
  return (
    <>
      <path d="M10.5 14h27c1 6 1 16-1.5 22-1 2.8-4 4-8 4h-8c-4 0-7-1.2-8-4-2.5-6-2.5-16-1.5-22z" />
      <path d="M9 9h30v5H9z" />
      {star(17, 21, 2.6)}
      {star(29, 19.5, 2.3)}
      {star(33.5, 27.5, 2.5)}
      {star(22, 28.5, 2.3)}
      {star(16, 34.5, 2)}
      {star(28, 35, 2.2)}
    </>
  )
}

const shapes: Record<MoldIcon, () => JSX.Element> = {
  pot: Pot,
  lantern: Lantern,
  bird: Bird,
  windows: Windows,
  cathedral: Cathedral,
  shell: Shell,
  bowl: Bowl,
  monstera: Monstera,
  leafDish: LeafDish,
  chest: Chest,
  roundBox: RoundBox,
  heartDish: HeartDish,
  ornament: Ornament,
  starJar: StarJar,
}

export const moldIconLabel: Record<MoldIcon, string> = {
  pot: 'горшочек',
  lantern: 'лампа',
  bird: 'птичка',
  windows: 'окна с колоннами',
  cathedral: 'собор',
  shell: 'ракушка',
  bowl: 'миска',
  monstera: 'монстера',
  leafDish: 'лист',
  chest: 'сундук',
  roundBox: 'круглая шкатулка',
  heartDish: 'сердечко',
  ornament: 'шар',
  starJar: 'банка со звёздами',
}

/** The icon chosen for a mold, or one guessed from its name. */
export function moldIconOf(m: Pick<Mold, 'name' | 'icon'> | undefined): MoldIcon | undefined {
  if (!m) return undefined
  if (m.icon) return m.icon
  const n = m.name.toLowerCase()
  // Specific names first: «Круглая шкатулка» is not «Шкатулка овал горшочек».
  if (/собор/.test(n)) return 'cathedral'
  if (/ракушк/.test(n)) return 'shell'
  if (/миск/.test(n)) return 'bowl'
  if (/монстер/.test(n)) return 'monstera'
  if (/тарел.*лист|лист.*тарел/.test(n)) return 'leafDish'
  if (/тарел.*серд|серд.*тарел/.test(n)) return 'heartDish'
  if (/сундук/.test(n)) return 'chest'
  if (/кругл.*шкатулк/.test(n)) return 'roundBox'
  if (/омел|ёлочн|елочн/.test(n)) return 'ornament'
  if (/звезд|звёзд/.test(n)) return 'starJar'
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
        <style>{'.mi-d{fill:none;stroke-width:.8;stroke-opacity:.85}.mi-f{fill:var(--card-ink,currentColor);stroke:none}'}</style>
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
