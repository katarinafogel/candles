// Tags of a deed: chips to drop with a tap, a field for a new one and the tags already in the book,
// the most used first, matching what is being typed.
import { Box, HStack, Input, Stack } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { LuX } from 'react-icons/lu'
import { suggestTags, tagsByUse } from '../../grimoire/tags'
import { useAppSelector } from '../../store'
import { Tag } from './Marks'

const clean = (s: string) => s.trim().replace(/^#+/, '').toLowerCase()

export function TagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const tasks = useAppSelector((s) => s.grimoire.tasks)
  const known = useMemo(() => tagsByUse({ tasks }), [tasks])
  const [draft, setDraft] = useState('')
  const hints = suggestTags(clean(draft), known, value)

  function add(raw: string) {
    const tags = raw.split(/[,\s]+/).map(clean).filter((x) => x && !value.includes(x))
    if (tags.length) onChange([...value, ...tags])
    setDraft('')
  }

  return (
    <Stack gap="2">
      {value.length > 0 && (
        <HStack gap="1.5" wrap="wrap">
          {value.map((t) => (
            <Box as="button" key={t} onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Убрать тег ${t}`} cursor="pointer" display="inline-flex" alignItems="center" gap="0.5">
              <Tag name={t} />
              <Box color="fg.subtle" fontSize="xs">
                <LuX />
              </Box>
            </Box>
          ))}
        </HStack>
      )}
      <Input
        value={draft}
        placeholder="новый тег"
        onChange={(e) => {
          const v = e.target.value
          // A comma or space ends the tag, as in the quick-add line.
          if (/[,\s]$/.test(v)) add(v)
          else setDraft(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && draft.trim()) {
            e.preventDefault()
            add(draft)
          }
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={() => draft.trim() && add(draft)}
      />
      {hints.length > 0 && (
        <HStack gap="1.5" wrap="wrap">
          {hints.map((t) => (
            <Box as="button" key={t} onMouseDown={(e) => e.preventDefault()} onClick={() => add(t)} cursor="pointer">
              <Tag name={t} />
            </Box>
          ))}
        </HStack>
      )}
    </Stack>
  )
}
