import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

// Night workshop: dried eucalyptus, wood slices, candlelight and moons. Dark-only: <html class="dark">.
// The accent palette keeps the name «emerald» so pages need no changes; its shades are sage now.
// «ember» is the candle glow used for stars, ratings and highlights.
const config = defineConfig({
  globalCss: {
    'html, body': { bg: 'bg', color: 'fg', colorPalette: 'emerald' },
    body: {
      minHeight: '100dvh',
      WebkitTapHighlightColor: 'transparent',
      // A faint star field and a warm glow, like a candle off to the side.
      backgroundImage: [
        'radial-gradient(1px 1px at 12% 18%, rgba(246,220,174,.55) 50%, transparent 51%)',
        'radial-gradient(1px 1px at 78% 9%, rgba(246,220,174,.45) 50%, transparent 51%)',
        'radial-gradient(1.5px 1.5px at 64% 32%, rgba(246,220,174,.35) 50%, transparent 51%)',
        'radial-gradient(1px 1px at 33% 56%, rgba(223,232,218,.35) 50%, transparent 51%)',
        'radial-gradient(1px 1px at 88% 71%, rgba(246,220,174,.4) 50%, transparent 51%)',
        'radial-gradient(1.5px 1.5px at 22% 84%, rgba(223,232,218,.3) 50%, transparent 51%)',
        'radial-gradient(1px 1px at 51% 93%, rgba(246,220,174,.35) 50%, transparent 51%)',
        'radial-gradient(60rem 40rem at 105% 110%, rgba(224,164,85,.10), transparent 60%)',
        'radial-gradient(50rem 36rem at -10% -10%, rgba(135,163,123,.08), transparent 60%)',
      ].join(','),
      backgroundSize: '420px 420px, 420px 420px, 420px 420px, 420px 420px, 420px 420px, 420px 420px, 420px 420px, 100% 100%, 100% 100%',
      backgroundAttachment: 'fixed',
    },
    '::selection': { bg: 'rgba(224,164,85,.35)' },
  },
  theme: {
    tokens: {
      fonts: {
        heading: { value: "'Cormorant Garamond', 'Cormorant', Georgia, 'Times New Roman', serif" },
        body: { value: "'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
      },
      colors: {
        // Eucalyptus sage.
        emerald: {
          50: { value: '#f1f5ef' },
          100: { value: '#dfe8da' },
          200: { value: '#c6d6be' },
          300: { value: '#aac19f' },
          400: { value: '#8ea883' },
          500: { value: '#728d67' },
          600: { value: '#5a7251' },
          700: { value: '#475a40' },
          800: { value: '#384633' },
          900: { value: '#2c3729' },
          950: { value: '#181e16' },
        },
        // Candle flame and beeswax.
        ember: {
          50: { value: '#fdf7ec' },
          100: { value: '#faebd0' },
          200: { value: '#f6dcae' },
          300: { value: '#ecc27f' },
          400: { value: '#e0a455' },
          500: { value: '#c9853a' },
          600: { value: '#a7692c' },
          700: { value: '#7f4f23' },
          800: { value: '#5a3a1c' },
          900: { value: '#3d2814' },
          950: { value: '#22160b' },
        },
      },
    },
    semanticTokens: {
      colors: {
        emerald: {
          contrast: { value: '#161a14' },
          fg: { value: '{colors.emerald.300}' },
          subtle: { value: 'rgba(142, 168, 131, 0.12)' },
          muted: { value: 'rgba(142, 168, 131, 0.22)' },
          emphasized: { value: 'rgba(142, 168, 131, 0.32)' },
          solid: { value: '{colors.emerald.400}' },
          focusRing: { value: '{colors.ember.300}' },
          border: { value: '{colors.emerald.500}' },
        },
        ember: {
          contrast: { value: '#22160b' },
          fg: { value: '{colors.ember.300}' },
          subtle: { value: 'rgba(224, 164, 85, 0.12)' },
          muted: { value: 'rgba(224, 164, 85, 0.22)' },
          emphasized: { value: 'rgba(224, 164, 85, 0.32)' },
          solid: { value: '{colors.ember.400}' },
          focusRing: { value: '{colors.ember.300}' },
          border: { value: '{colors.ember.500}' },
        },
        // Warm charcoal and dark wood instead of green-black.
        bg: {
          DEFAULT: { value: { _light: '#ffffff', _dark: '#13110f' } },
          subtle: { value: { _light: '{colors.gray.50}', _dark: 'rgba(32, 28, 24, 0.88)' } },
          muted: { value: { _light: '{colors.gray.100}', _dark: '#26211c' } },
          emphasized: { value: { _light: '{colors.gray.200}', _dark: '#322b24' } },
          panel: { value: { _light: '#ffffff', _dark: '#1d1915' } },
        },
        border: {
          DEFAULT: { value: { _light: '{colors.gray.200}', _dark: '#352d25' } },
          muted: { value: { _light: '{colors.gray.100}', _dark: '#2a241e' } },
          emphasized: { value: { _light: '{colors.gray.300}', _dark: '#4a3e32' } },
        },
        fg: {
          DEFAULT: { value: { _light: '{colors.black}', _dark: '#ece4d6' } },
          muted: { value: { _light: '{colors.gray.600}', _dark: '#b5a891' } },
          subtle: { value: { _light: '{colors.gray.400}', _dark: '#7f735f' } },
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
