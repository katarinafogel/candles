import { defaultConfig } from '@chakra-ui/react'

// Themes as sets of CSS variables on <html data-theme="…">. Every surface colour the app paints with
// is a `--g-*` variable here; theme.ts points Chakra's semantic tokens (bg, fg, border, …) at them.
//
// Palette shades are used by role, not by lightness: 50–300 are text and highlights, 400–500 are
// solids, 600–900 are borders and deep fills (the app was drawn on a dark background). A light theme
// therefore mirrors every palette (50↔950, 100↔900, …), so `ember.100` stays a readable accent and
// `ember.700` a soft border on white. Chakra's own dark-mode recipes rely on the same mirror, which is
// why <html> keeps class="dark" in every theme and only `color-scheme` follows the theme.

export type ThemeId = 'night' | 'paper'

export interface Theme {
  label: string
  scheme: 'dark' | 'light'
  /** Browser chrome colour: <meta name="theme-color">. */
  meta: string
  vars: Record<string, string>
}

// Accent palettes. Eucalyptus sage keeps the name «emerald» so pages need no changes; «ember» is the
// candle glow used for stars, ratings and highlights.
export const palettes: Record<string, Record<string, string>> = {
  emerald: {
    50: '#f1f5ef', 100: '#dfe8da', 200: '#c6d6be', 300: '#aac19f', 400: '#8ea883', 500: '#728d67',
    600: '#5a7251', 700: '#475a40', 800: '#384633', 900: '#2c3729', 950: '#181e16',
  },
  ember: {
    50: '#fdf7ec', 100: '#faebd0', 200: '#f6dcae', 300: '#ecc27f', 400: '#e0a455', 500: '#c9853a',
    600: '#a7692c', 700: '#7f4f23', 800: '#5a3a1c', 900: '#3d2814', 950: '#22160b',
  },
}

const steps = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']

/** `--chakra-colors-<palette>-<step>` overrides that turn every palette upside down. */
function mirroredPalettes() {
  const chakra = defaultConfig.theme?.tokens?.colors as Record<string, Record<string, { value: string }>>
  const all: Record<string, Record<string, string>> = { ...palettes }
  const alpha = ['whiteAlpha', 'blackAlpha']
  for (const [name, scale] of Object.entries(chakra)) {
    if (name in all || alpha.includes(name) || typeof scale !== 'object' || !scale['500']) continue
    all[name] = Object.fromEntries(steps.map((s) => [s, scale[s].value]))
  }
  const vars: Record<string, string> = {}
  for (const [name, scale] of Object.entries(all)) {
    steps.forEach((s, i) => (vars[`--chakra-colors-${name}-${s}`] = scale[steps[steps.length - 1 - i]]))
  }
  // Translucent white highlights become translucent black ones and back.
  for (const s of steps) {
    vars[`--chakra-colors-white-alpha-${s}`] = chakra.blackAlpha[s].value
    vars[`--chakra-colors-black-alpha-${s}`] = chakra.whiteAlpha[s].value
  }
  return vars
}

/** A palette's steps as `--chakra-colors-*` overrides. */
function paletteVars(name: string, scale: Record<string, string>) {
  return Object.fromEntries(Object.entries(scale).map(([step, value]) => [`--chakra-colors-${name}-${step}`, value]))
}

// The light design system's palette, light to dark.
export const paper = {
  cream: '#F1DDBF',
  taupe: '#CABEAD',
  stone: '#A29E9A',
  slate: '#525E75',
  pine: '#657980',
  eucalyptus: '#78938A',
  sage: '#85A78E',
  leaf: '#92BA92',
  mint: '#AECCAE',
  mist: '#C9DDC9',
}

// Its accent scales, already in mirrored order (50 is the darkest): sage for «emerald», cream and
// taupe deepening to brown for «ember». The ends past the palette are its own colours, darkened or
// washed out, so headings and text stay readable on white.
const paperScales = {
  emerald: {
    50: '#27332f', 100: '#34443d', 200: '#465c50', 300: '#577262', 400: '#5d7d67', 500: paper.sage,
    600: paper.leaf, 700: paper.mint, 800: paper.mist, 900: '#e2ece2', 950: '#f2f7f2',
  },
  ember: {
    50: '#3b3128', 100: '#4f4337', 200: '#685a4a', 300: '#8a7660', 400: '#a8916f', 500: '#bba98f',
    600: paper.taupe, 700: '#ddcbb1', 800: paper.cream, 900: '#f7ebda', 950: '#fbf5ec',
  },
}

// Night workshop: warm charcoal and dark wood, a faint star field and a candle glow off to the side.
const starField = [
  'radial-gradient(1px 1px at 12% 18%, rgba(246,220,174,.55) 50%, transparent 51%)',
  'radial-gradient(1px 1px at 78% 9%, rgba(246,220,174,.45) 50%, transparent 51%)',
  'radial-gradient(1.5px 1.5px at 64% 32%, rgba(246,220,174,.35) 50%, transparent 51%)',
  'radial-gradient(1px 1px at 33% 56%, rgba(223,232,218,.35) 50%, transparent 51%)',
  'radial-gradient(1px 1px at 88% 71%, rgba(246,220,174,.4) 50%, transparent 51%)',
  'radial-gradient(1.5px 1.5px at 22% 84%, rgba(223,232,218,.3) 50%, transparent 51%)',
  'radial-gradient(1px 1px at 51% 93%, rgba(246,220,174,.35) 50%, transparent 51%)',
  'radial-gradient(60rem 40rem at 105% 110%, rgba(224,164,85,.10), transparent 60%)',
  'radial-gradient(50rem 36rem at -10% -10%, rgba(135,163,123,.08), transparent 60%)',
].join(',')

export const themes: Record<ThemeId, Theme> = {
  night: {
    label: 'ночь',
    scheme: 'dark',
    meta: '#13110f',
    vars: {
      '--g-bg': '#13110f',
      '--g-bg-subtle': 'rgba(32, 28, 24, 0.88)',
      '--g-bg-muted': '#26211c',
      '--g-bg-emphasized': '#322b24',
      '--g-bg-panel': '#1d1915',
      '--g-bg-nav': 'rgba(24, 21, 18, 0.93)',
      '--g-bg-veil': 'rgba(0, 0, 0, 0.45)',
      '--g-border': '#352d25',
      '--g-border-muted': '#2a241e',
      '--g-border-emphasized': '#4a3e32',
      '--g-fg': '#ece4d6',
      '--g-fg-muted': '#b5a891',
      '--g-fg-subtle': '#7f735f',
      '--g-emerald-contrast': '#161a14',
      '--g-ember-contrast': '#22160b',
      '--g-glow': 'rgba(224, 164, 85, 0.45)',
      '--g-glow-soft': 'rgba(224, 164, 85, 0.07)',
      '--g-shade': 'rgba(0, 0, 0, 0.7)',
      '--g-selection': 'rgba(224, 164, 85, 0.35)',
      '--g-scrollbar': '#4a3e32',
      '--g-scrollbar-hover': '#6a5743',
      '--g-backdrop': starField,
      '--g-backdrop-size': '420px 420px, 420px 420px, 420px 420px, 420px 420px, 420px 420px, 420px 420px, 420px 420px, 100% 100%, 100% 100%',
      // Line art and fills drawn in SVG: jars, the emotion wheel, the moon's dark side.
      '--g-ink': 'rgba(246, 230, 200, 0.5)',
      '--g-ink-faint': 'rgba(246, 230, 200, 0.08)',
      '--g-ink-bright': '#fff6dc',
      '--g-hollow': 'rgba(20, 16, 12, 0.85)',
      '--g-label': '#fff8ea',
      '--g-hub': '#1a1612',
      '--g-chip': 'rgba(30, 25, 20, 0.92)',
      '--g-chip-fg': '#f3e8d6',
      '--g-moon-dark': 'rgba(255, 255, 255, 0.12)',
      '--g-joy-mark': '#f4efe6',
    },
  },
  // White paper in the light palette (see `paper` above): slate ink, sage accents, cream and taupe.
  paper: {
    label: 'бумага',
    scheme: 'light',
    meta: '#ffffff',
    vars: {
      ...mirroredPalettes(),
      ...paletteVars('emerald', paperScales.emerald),
      ...paletteVars('ember', paperScales.ember),
      '--g-bg': '#ffffff',
      '--g-bg-subtle': '#fcf8f2',
      '--g-bg-muted': '#f8efe2',
      '--g-bg-emphasized': paper.cream,
      '--g-bg-panel': '#ffffff',
      '--g-bg-nav': 'rgba(255, 255, 255, 0.94)',
      '--g-bg-veil': 'rgba(255, 255, 255, 0.72)',
      '--g-border': '#e8dfd2',
      '--g-border-muted': '#f1ebe2',
      '--g-border-emphasized': paper.taupe,
      '--g-fg': '#3a4357',
      '--g-fg-muted': paper.slate,
      '--g-fg-subtle': '#8a8682',
      '--g-emerald-contrast': '#ffffff',
      '--g-ember-contrast': '#2f271f',
      '--g-glow': 'rgba(133, 167, 142, 0.45)',
      '--g-glow-soft': 'rgba(241, 221, 191, 0.35)',
      '--g-shade': 'rgba(82, 94, 117, 0.18)',
      '--g-selection': 'rgba(174, 204, 174, 0.5)',
      '--g-scrollbar': paper.taupe,
      '--g-scrollbar-hover': paper.stone,
      '--g-backdrop': 'none',
      '--g-backdrop-size': 'auto',
      '--g-ink': 'rgba(82, 94, 117, 0.45)',
      '--g-ink-faint': 'rgba(82, 94, 117, 0.06)',
      '--g-ink-bright': paper.slate,
      '--g-hollow': 'rgba(255, 255, 255, 0.9)',
      '--g-label': '#3a4357',
      '--g-hub': '#fcf8f2',
      '--g-chip': 'rgba(255, 255, 255, 0.95)',
      '--g-chip-fg': '#3a4357',
      '--g-moon-dark': 'rgba(82, 94, 117, 0.12)',
      '--g-joy-mark': paper.stone,
    },
  },
}

// Fonts belong to the project, not to the colour theme: <html data-app="grimoire"> gets its own set.
// «hand» is the handwriting for quotes and decorative lines; Gogol is ParaType's free font, served
// from public/fonts (it isn't on Google Fonts), the others come from Google Fonts in index.html.
export const fontSets: Record<'workshop' | 'grimoire', Record<'heading' | 'body' | 'hand', string>> = {
  workshop: {
    heading: "'Cormorant Garamond', 'Cormorant', Georgia, 'Times New Roman', serif",
    body: "'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    hand: "'Cormorant Garamond', Georgia, serif",
  },
  grimoire: {
    heading: "'Spectral SC', Georgia, 'Times New Roman', serif",
    body: "'Shantell Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    hand: "'Gogol', 'Shantell Sans', cursive",
  },
}

const fontVars = (set: Record<string, string>) => Object.fromEntries(Object.entries(set).map(([k, val]) => [`--g-font-${k}`, val]))

const gogol = "@font-face{font-family:'Gogol';src:url(./fonts/Gogol.woff2) format('woff2'),url(./fonts/Gogol.ttf) format('truetype');font-display:swap}"

/** One theme for both projects, the workshop and the grimoire. */
export const defaultTheme: ThemeId = 'paper'
const key = 'theme'

export function savedTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(key)
    if (saved && saved in themes) return saved as ThemeId
  } catch {
    // Storage blocked: fall back to the default.
  }
  return defaultTheme
}

export function setTheme(id: ThemeId) {
  try {
    localStorage.setItem(key, id)
  } catch {
    // Storage blocked: the theme still applies for this visit.
  }
  applyTheme(id)
}

export function applyTheme(id: ThemeId) {
  const root = document.documentElement
  if (root.dataset.theme === id) return
  root.dataset.theme = id
  root.style.colorScheme = themes[id].scheme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themes[id].meta)
}

/**
 * Puts every theme's variables on the page. A plain <style> outside Chakra's cascade layers, because
 * the palette overrides must beat Chakra's own `@layer tokens`; night (for a page that
 * hasn't set its theme yet) and the workshop's fonts are also on bare :root.
 */
export function installThemes() {
  const decl = (vars: Record<string, string>) => Object.entries(vars).map(([k, val]) => `${k}:${val}`).join(';')
  const block = (sel: string, t: Theme) => `${sel}{color-scheme:${t.scheme};${decl(t.vars)}}`
  const style = document.createElement('style')
  style.id = 'themes'
  style.textContent = [
    gogol,
    block(':root', themes.night),
    ...Object.entries(themes).map(([id, t]) => block(`:root[data-theme=${id}]`, t)),
    `:root{${decl(fontVars(fontSets.workshop))}}`,
    `:root[data-app=grimoire]{${decl(fontVars(fontSets.grimoire))}}`,
  ].join('\n')
  document.head.prepend(style)
}
