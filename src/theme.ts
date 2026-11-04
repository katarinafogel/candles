import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'
import { palettes } from './themes'

// The design system. Colours live in src/themes.ts as CSS variables per theme (<html data-theme>,
// installed by installThemes in main.tsx);
// the tokens below only point at them, so a new theme needs no changes here or in the pages.
// <html class="dark"> stays in every theme: see themes.ts on mirrored palettes.
const v = (name: string) => ({ value: `var(--g-${name})` })

const config = defineConfig({
  globalCss: {
    'html, body': { bg: 'bg', color: 'fg', colorPalette: 'emerald' },
    body: {
      minHeight: '100dvh',
      WebkitTapHighlightColor: 'transparent',
      backgroundImage: 'var(--g-backdrop)',
      backgroundSize: 'var(--g-backdrop-size)',
      backgroundAttachment: 'fixed',
    },
    '::selection': { bg: 'var(--g-selection)' },
    // Every dialog's backdrop dims the page in the theme's colour (Chakra's blackAlpha is mirrored
    // in light themes and would whiten it instead); a slight blur keeps the panel in front.
    '[data-scope="dialog"][data-part="backdrop"]': { bg: 'var(--g-scrim)', backdropFilter: 'blur(2px)' },
    // Thin scrollbars in the theme's wood instead of the system's.
    '*': { scrollbarWidth: 'thin', scrollbarColor: 'var(--g-scrollbar) transparent' },
    '*::-webkit-scrollbar': { width: '8px', height: '8px' },
    '*::-webkit-scrollbar-track': { background: 'transparent' },
    '*::-webkit-scrollbar-thumb': { background: 'var(--g-scrollbar)', borderRadius: '8px', border: '2px solid transparent', backgroundClip: 'padding-box' },
    '*::-webkit-scrollbar-thumb:hover': { background: 'var(--g-scrollbar-hover)', backgroundClip: 'padding-box' },
    // Side menus: the scrollbar hides until the pointer is over the menu, and its place is kept
    // so the items don't shift when it appears.
    '.quiet-scroll': { scrollbarGutter: 'stable', scrollbarColor: 'transparent transparent', transition: 'scrollbar-color .2s' },
    '.quiet-scroll:hover, .quiet-scroll:focus-within': { scrollbarColor: 'var(--g-scrollbar) transparent' },
    '.quiet-scroll::-webkit-scrollbar-thumb': { background: 'transparent' },
    '.quiet-scroll:hover::-webkit-scrollbar-thumb, .quiet-scroll:focus-within::-webkit-scrollbar-thumb': { background: 'var(--g-scrollbar)', backgroundClip: 'padding-box' },
  },
  theme: {
    tokens: {
      fonts: {
        // See fonts in themes.ts.
        heading: { value: 'var(--g-font-heading)' },
        body: { value: 'var(--g-font-body)' },
        hand: { value: 'var(--g-font-hand)' },
      },
      colors: Object.fromEntries(
        Object.entries(palettes).map(([name, scale]) => [name, Object.fromEntries(Object.entries(scale).map(([s, value]) => [s, { value }]))]),
      ),
    },
    semanticTokens: {
      // No shadows anywhere: dialogs, menus and popovers stay flat, outlined by their borders.
      shadows: Object.fromEntries(['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'inner', 'inset'].map((k) => [k, { value: 'none' }])),
      colors: {
        emerald: {
          contrast: v('emerald-contrast'),
          fg: { value: '{colors.emerald.300}' },
          subtle: { value: 'color-mix(in srgb, var(--chakra-colors-emerald-400) 12%, transparent)' },
          muted: { value: 'color-mix(in srgb, var(--chakra-colors-emerald-400) 22%, transparent)' },
          emphasized: { value: 'color-mix(in srgb, var(--chakra-colors-emerald-400) 32%, transparent)' },
          solid: { value: '{colors.emerald.400}' },
          focusRing: { value: '{colors.ember.300}' },
          border: { value: '{colors.emerald.500}' },
        },
        ember: {
          contrast: v('ember-contrast'),
          fg: { value: '{colors.ember.300}' },
          subtle: { value: 'color-mix(in srgb, var(--chakra-colors-ember-400) 12%, transparent)' },
          muted: { value: 'color-mix(in srgb, var(--chakra-colors-ember-400) 22%, transparent)' },
          emphasized: { value: 'color-mix(in srgb, var(--chakra-colors-ember-400) 32%, transparent)' },
          solid: { value: '{colors.ember.400}' },
          focusRing: { value: '{colors.ember.300}' },
          border: { value: '{colors.ember.500}' },
        },
        bg: {
          DEFAULT: v('bg'),
          subtle: v('bg-subtle'),
          muted: v('bg-muted'),
          emphasized: v('bg-emphasized'),
          panel: v('bg-panel'),
          // Sticky menus over the page, and a veil over a card that is busy.
          nav: v('bg-nav'),
          veil: v('bg-veil'),
        },
        border: {
          DEFAULT: v('border'),
          muted: v('border-muted'),
          emphasized: v('border-emphasized'),
        },
        fg: {
          DEFAULT: v('fg'),
          muted: v('fg-muted'),
          subtle: v('fg-subtle'),
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
