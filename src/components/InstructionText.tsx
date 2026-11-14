// The candle's instruction as the recipient sees it: highlighted phrases with a pop-up explanation
// (hover on a computer, tap on a phone) and «!» lines as a separate callout. The markup is parsed in
// workshop-core (instructionText.ts).
import { Box, Stack, Text } from '@chakra-ui/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { parseInstruction, type InstructionPart } from '@workshop-core/lib/instructionText'

/** A phrase with its explanation in a bubble under it, kept inside the screen. */
function Hint({ text, hint }: { text: string; hint: string }) {
  const [open, setOpen] = useState(false)
  const [shift, setShift] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const touch = useRef(false)

  useLayoutEffect(() => {
    if (!open || !bubble.current) return setShift(0)
    const r = bubble.current.getBoundingClientRect()
    const pad = 12
    if (r.right > window.innerWidth - pad) setShift(window.innerWidth - pad - r.right)
    else if (r.left < pad) setShift(pad - r.left)
  }, [open])

  // A tap elsewhere closes it.
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  return (
    <Box
      as="span"
      ref={wrap}
      position="relative"
      display="inline"
      tabIndex={0}
      role="button"
      aria-expanded={open}
      color="ember.300"
      fontWeight="medium"
      textDecoration="underline dotted"
      textUnderlineOffset="3px"
      cursor="help"
      outline="none"
      // A mouse opens it by hovering (a click keeps it open); a tap opens and closes it; the keyboard
      // opens it on focus. Taps also send mouse-like events, so the pointer's type decides.
      onPointerEnter={(e: React.PointerEvent) => e.pointerType === 'mouse' && setOpen(true)}
      onPointerLeave={(e: React.PointerEvent) => e.pointerType === 'mouse' && setOpen(false)}
      onPointerDown={(e: React.PointerEvent) => {
        touch.current = e.pointerType !== 'mouse'
      }}
      onClick={() => setOpen((o) => (touch.current ? !o : true))}
      onFocus={(e: React.FocusEvent<HTMLElement>) => e.currentTarget.matches(':focus-visible') && setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e: React.KeyboardEvent) => e.key === 'Escape' && setOpen(false)}
    >
      {text}
      {open && (
        <Box
          as="span"
          ref={bubble}
          role="tooltip"
          position="absolute"
          top="calc(100% + 6px)"
          left="0"
          zIndex="10"
          display="block"
          w="max-content"
          maxW="min(280px, calc(100vw - 24px))"
          px="3"
          py="2"
          borderRadius="l2"
          bg="bg.emphasized"
          color="fg"
          fontSize="xs"
          fontWeight="normal"
          lineHeight="1.45"
          textDecoration="none"
          boxShadow="md"
          style={{ transform: `translateX(${shift}px)` }}
        >
          {hint}
        </Box>
      )}
    </Box>
  )
}

function Parts({ parts }: { parts: InstructionPart[] }) {
  return (
    <>
      {parts.map((p, i) => (p.hint ? <Hint key={i} text={p.text} hint={p.hint} /> : <span key={i}>{p.text}</span>))}
    </>
  )
}

export function InstructionText({ text }: { text: string }) {
  const blocks = parseInstruction(text)
  const notes = blocks.filter((b) => b.kind === 'note')
  const lines = blocks.filter((b) => b.kind === 'line')
  return (
    <Stack gap="3">
      {notes.map((b, i) => (
        <Box key={i} p="3" borderRadius="l2" borderLeftWidth="3px" borderColor="ember.400" bg="ember.subtle" fontSize="sm" color="fg">
          <Parts parts={b.parts} />
        </Box>
      ))}
      {lines.length > 0 && (
        <Stack as="ul" gap="2" fontSize="sm" color="fg.muted" listStyleType="none" m="0" p="0">
          {lines.map((b, i) => (
            <Text as="li" key={i} pl="4" position="relative" _before={{ content: '"☾"', position: 'absolute', left: 0, color: 'ember.400', fontSize: 'xs', top: '1px' }}>
              <Parts parts={b.parts} />
            </Text>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
