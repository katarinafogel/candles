// A field that suggests while typing: a small list under it with what matches, nothing when nothing
// matches or nothing is typed. Arrows move through the list, Enter takes the highlighted one or, with
// none, hands the typed text to `onCreate` (a new person, project or tag).
import { Box, Input, Stack, Text } from '@chakra-ui/react'
import { useState, type ReactNode } from 'react'

export interface Suggestion {
  value: string
  label: string
  /** Shown instead of the label in the list (a tag chip, a project's sigil). */
  view?: ReactNode
}

/** Matches by the start of the label first, then anywhere in it; at most `limit`. */
/** Case and ё/е don't matter when matching. */
const fold = (s: string) => s.trim().toLowerCase().replace(/ё/g, 'е').replace(/^#+/, '')

export function matchSuggestions(q: string, options: Suggestion[], limit = 6): Suggestion[] {
  const s = fold(q)
  if (!s) return []
  const starts = options.filter((o) => fold(o.label).startsWith(s))
  const inside = options.filter((o) => !fold(o.label).startsWith(s) && fold(o.label).includes(s))
  return [...starts, ...inside].slice(0, limit)
}

export function SuggestInput({
  options,
  onPick,
  onCreate,
  placeholder,
  disabled,
  breakOn,
  commitOnBlur,
}: {
  options: Suggestion[]
  onPick: (value: string) => void
  onCreate?: (text: string) => void
  placeholder?: string
  disabled?: boolean
  /** Text typed with this at the end goes to `onCreate` at once (a comma or space ends a tag). */
  breakOn?: RegExp
  commitOnBlur?: boolean
}) {
  const [text, setText] = useState('')
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(true)
  const hits = open ? matchSuggestions(text, options) : []

  const reset = () => {
    setText('')
    setActive(-1)
  }
  const pick = (v: string) => {
    onPick(v)
    reset()
  }
  const create = (s: string) => {
    if (!s.trim() || !onCreate) return
    onCreate(s.trim())
    reset()
  }

  return (
    <Stack gap="1" w="full">
      <Input
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value
          if (breakOn?.test(v)) return create(v)
          setText(v)
          setActive(-1)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && hits.length) {
            e.preventDefault()
            setActive((a) => (a + 1) % hits.length)
          } else if (e.key === 'ArrowUp' && hits.length) {
            e.preventDefault()
            setActive((a) => (a <= 0 ? hits.length - 1 : a - 1))
          } else if (e.key === 'Escape' && hits.length) {
            // Closes the list, not the dialog.
            e.stopPropagation()
            setOpen(false)
          } else if (e.key === 'Enter' && text.trim() && !e.nativeEvent.isComposing) {
            e.preventDefault()
            const same = options.find((o) => o.label.toLowerCase() === text.trim().toLowerCase())
            if (active >= 0 && hits[active]) pick(hits[active].value)
            else if (same) pick(same.value)
            else if (onCreate) create(text)
            else if (hits.length) pick(hits[0].value)
          }
        }}
        onBlur={() => commitOnBlur && create(text)}
      />
      {hits.length > 0 && (
        <Stack gap="0" role="listbox" borderWidth="1px" borderColor="border" borderRadius="l2" bg="bg.muted" py="1">
          {hits.map((h, i) => (
            <Box
              as="button"
              key={h.value}
              role="option"
              aria-selected={i === active}
              textAlign="left"
              px="3"
              py="1.5"
              cursor="pointer"
              bg={i === active ? 'ember.subtle' : undefined}
              _hover={{ bg: 'ember.subtle' }}
              onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
              onClick={() => pick(h.value)}
            >
              {h.view ?? <Text fontSize="sm">{h.label}</Text>}
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
