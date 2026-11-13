// «Свой цвет»: a round swatch that opens the system colour picker. Empty, it shows a little rainbow;
// with a colour chosen, it wears that colour and a ring like a picked swatch.
import { Box } from '@chakra-ui/react'

export function ColorDot({ value, onChange, size = '5', label = 'Свой цвет' }: { value?: string; onChange: (hex: string) => void; size?: string; label?: string }) {
  return (
    <Box
      as="label"
      position="relative"
      display="inline-block"
      w={size}
      h={size}
      borderRadius="full"
      cursor="pointer"
      title={label}
      aria-label={label}
      bg={value ?? 'conic-gradient(#e57373, #ffd54f, #81c784, #4fc3f7, #9575cd, #e57373)'}
      borderWidth="2px"
      borderColor={value ? 'fg' : 'transparent'}
      overflow="hidden"
    >
      <input
        type="color"
        key={value}
        defaultValue={value ?? '#9575cd'}
        // The native «change» fires when the picker is closed: one choice is one write, not one per drag.
        ref={(el) => {
          if (el) el.onchange = () => onChange(el.value)
        }}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 0, padding: 0 }}
      />
    </Box>
  )
}
