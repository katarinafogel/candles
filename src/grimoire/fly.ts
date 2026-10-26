// The answer to a done deed: a candle spark flies from the card into the coin counter, and the counter
// gives a little jump. «Анимации» in the settings: off — nothing, soft — one spark, bright — three.
import type { GrimoireMeta } from './types'

const SPARK =
  '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 1c.6 5.6 2.4 8.4 11 11-8.6 2.6-10.4 5.4-11 11-.6-5.6-2.4-8.4-11-11 8.6-2.6 10.4-5.4 11-11z" fill="#ecc27f"/></svg>'

/** The coin counter on screen now: the side menu's on a computer, the header's on a phone. */
const coinTarget = () => [...document.querySelectorAll<HTMLElement>('[data-coins]')].find((e) => e.getBoundingClientRect().width > 0)

export function flySpark(from: Element | null | undefined, motion: GrimoireMeta['tone']['motion']) {
  if (!from || motion === 'off' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const to = coinTarget()
  if (!to) return
  // Measured now: the card or the dialog it came from may be gone a moment later.
  const a = from.getBoundingClientRect()
  const b = to.getBoundingClientRect()
  const count = motion === 'bright' ? 3 : 1
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    el.innerHTML = SPARK
    Object.assign(el.style, { position: 'fixed', left: '0', top: '0', zIndex: '2000', pointerEvents: 'none', filter: 'drop-shadow(0 0 6px rgba(236,194,127,.9))' })
    document.body.appendChild(el)
    const x0 = a.left + a.width / 2 - 9 + (i - 1) * 14 * (count > 1 ? 1 : 0)
    const y0 = a.top + a.height / 2 - 9
    const x1 = b.left + b.width / 2 - 9
    const y1 = b.top + b.height / 2 - 9
    // An arc: up first, then into the counter.
    const mx = (x0 + x1) / 2
    const my = Math.min(y0, y1) - 60
    el.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(.6) rotate(0deg)`, opacity: 0 },
        { transform: `translate(${mx}px, ${my}px) scale(1.3) rotate(120deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${x1}px, ${y1}px) scale(.5) rotate(240deg)`, opacity: 0.9 },
      ],
      { duration: 700, delay: i * 90, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'both' },
    ).onfinish = () => {
      el.remove()
      if (i === count - 1) to.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' })
    }
  }
}

const warmWords = ['Ведьма в ударе!', 'Ещё одна страница гримуара заполнена.', 'Котёл кипит, дело сделано.', 'Луна одобряет.', 'Так держать.']

/** The toast for a done deed, by «Похвала»: quiet — just the coins, normal — as is, warm — a kind word too. */
export function praise(kind: 'done' | 'joy' | 'frog' | 'partial', coins: string, level: GrimoireMeta['tone']['praise']) {
  const base = { done: 'Сделано', joy: 'Радость прожита', frog: level === 'quiet' ? 'Жаба съедена' : '🐸 Жаба съедена!', partial: 'Часть сделана' }[kind]
  const word = level === 'warm' && kind !== 'partial' ? warmWords[Math.floor(Math.random() * warmWords.length)] : undefined
  return { title: `${base} · ${coins}`, word }
}
