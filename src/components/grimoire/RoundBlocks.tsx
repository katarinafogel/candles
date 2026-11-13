// Round buttons over a form's footer, each turning on an optional block of the form: a tap shows the
// block, a second tap hides it and clears its value, so a hidden block never saves something unseen.
// The deed's form (TaskFields) started this; wishes, jars and mirror entries use the same buttons.
import { Box, HStack, IconButton, Text } from '@chakra-ui/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/** One round button with its label over it while the pointer is there. */
export function RoundButton({ label, icon, on, onClick }: { label: string; icon: ReactNode; on: boolean; onClick: () => void }) {
  return (
    <Box position="relative" className="group">
      <IconButton
        aria-label={label}
        aria-pressed={on}
        borderRadius="full"
        size="sm"
        variant="outline"
        borderColor={on ? 'ember.500' : 'border'}
        bg={on ? 'ember.subtle' : 'transparent'}
        color={on ? 'ember.200' : 'fg.muted'}
        onClick={onClick}
      >
        {icon}
      </IconButton>
      <Text
        role="tooltip"
        position="absolute"
        bottom="calc(100% + 6px)"
        left="50%"
        transform="translateX(-50%)"
        whiteSpace="nowrap"
        fontSize="xs"
        px="2"
        py="1"
        borderRadius="l2"
        bg="bg.emphasized"
        color="fg"
        pointerEvents="none"
        opacity="0"
        transition="opacity .12s"
        zIndex="1"
        css={{ '.group:hover > &': { opacity: 1 } }}
      >
        {label}
      </Text>
    </Box>
  )
}

export interface RoundBlock<K extends string> {
  key: K
  label: string
  icon: ReactNode
}

/**
 * The state of a form's round buttons. `filled` — the blocks that hold something, shown from the
 * start; `onHide` clears a block's value when its button turns it off.
 */
export function useRoundBlocks<K extends string>(blocks: RoundBlock<K>[], filled: K[], onHide: (k: K) => void) {
  const [shown, setShown] = useState(() => new Set(filled))
  const [opened, setOpened] = useState<K>()
  const toggle = (k: K) => {
    const next = new Set(shown)
    if (next.has(k)) {
      next.delete(k)
      onHide(k)
      setOpened(undefined)
    } else {
      next.add(k)
      setOpened(k)
    }
    setShown(next)
  }
  const toolbar = (
    <HStack gap="2" wrap="wrap" w="full">
      {blocks.map((b) => (
        <RoundButton key={b.key} label={b.label} icon={b.icon} on={shown.has(b.key)} onClick={() => toggle(b.key)} />
      ))}
    </HStack>
  )
  /** Every block hidden again (their values are the caller's to clear). */
  const reset = () => {
    setShown(new Set())
    setOpened(undefined)
  }
  return { shown, opened, toolbar, show: (k: K) => shown.has(k), reset }
}

/** Wraps a block that was just turned on, so the form scrolls to it. */
export function BlockSpot({ active, children }: { active: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [active])
  return <div ref={ref}>{children}</div>
}

/**
 * Required fields without a greyed-out button: «Сохранить» stays pressable, and a press with
 * something missing marks the fields that need it instead of saving.
 */
export function useAttempt() {
  const [tried, setTried] = useState(false)
  return {
    /** Mark a field: true once a save was tried and the field is still missing. */
    missing: (empty: boolean) => tried && empty,
    attempt: (ok: boolean, save: () => void) => {
      if (!ok) return setTried(true)
      save()
    },
    reset: () => setTried(false),
  }
}
