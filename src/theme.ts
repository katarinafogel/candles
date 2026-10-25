import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

// Emerald on a deep green-black. The app is dark-only: <html class="dark">.
const config = defineConfig({
  globalCss: {
    'html, body': { bg: 'bg', color: 'fg', colorPalette: 'emerald' },
    body: { minHeight: '100dvh', WebkitTapHighlightColor: 'transparent' },
  },
  theme: {
    tokens: {
      fonts: {
        heading: { value: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
        body: { value: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
      },
      colors: {
        emerald: {
          50: { value: '#ecfdf5' },
          100: { value: '#d1fae5' },
          200: { value: '#a7f3d0' },
          300: { value: '#6ee7b7' },
          400: { value: '#34d399' },
          500: { value: '#10b981' },
          600: { value: '#059669' },
          700: { value: '#047857' },
          800: { value: '#065f46' },
          900: { value: '#064e3b' },
          950: { value: '#022c22' },
        },
      },
    },
    semanticTokens: {
      colors: {
        emerald: {
          contrast: { value: '#022c22' },
          fg: { value: '{colors.emerald.300}' },
          subtle: { value: 'rgba(16, 185, 129, 0.12)' },
          muted: { value: 'rgba(16, 185, 129, 0.22)' },
          emphasized: { value: 'rgba(16, 185, 129, 0.32)' },
          solid: { value: '{colors.emerald.400}' },
          focusRing: { value: '{colors.emerald.400}' },
          border: { value: '{colors.emerald.500}' },
        },
        bg: {
          DEFAULT: { value: { _light: '#ffffff', _dark: '#0b1512' } },
          subtle: { value: { _light: '{colors.gray.50}', _dark: '#0f1d19' } },
          muted: { value: { _light: '{colors.gray.100}', _dark: '#13241f' } },
          emphasized: { value: { _light: '{colors.gray.200}', _dark: '#1b3029' } },
          panel: { value: { _light: '#ffffff', _dark: '#10201b' } },
        },
        border: {
          DEFAULT: { value: { _light: '{colors.gray.200}', _dark: '#1e332c' } },
          muted: { value: { _light: '{colors.gray.100}', _dark: '#172a24' } },
          emphasized: { value: { _light: '{colors.gray.300}', _dark: '#29443b' } },
        },
        fg: {
          muted: { value: { _light: '{colors.gray.600}', _dark: '#93b3a8' } },
          subtle: { value: { _light: '{colors.gray.400}', _dark: '#6b8a80' } },
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
