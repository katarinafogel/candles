// Tags of a deed, a wish or a jar: chips to drop with a tap and a field for a new one that suggests the tags already
// anywhere in the book (the most used first) only while typing.
import { HStack, Stack } from '@chakra-ui/react'
import { useMemo } from 'react'
import { tagsByUse } from '@grimoire-core/grimoire/tags'
import { useAppSelector } from '../../store'
import { RemovableChip } from '@shared/components/ui'
import { Tag } from './Marks'
import { SuggestInput } from './SuggestInput'

const clean = (s: string) => s.trim().replace(/^#+/, '').toLowerCase()

export function TagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const g = useAppSelector((s) => s.grimoire)
  const { tasks, wishes, jars, journal, notes, books, meta } = g
  // Every tag of the book — deeds, wishes, jars, the mirror, notes, books, templates — and the ones
  // given a colour in the settings, so a tag used in one section is offered in every other.
  const known = useMemo(() => {
    const used = tagsByUse({ tasks, wishes, jars, journal, notes, books, meta })
    return [...used, ...Object.keys(meta.tagColors ?? {}).filter((t) => !used.includes(t))]
  }, [tasks, wishes, jars, journal, notes, books, meta])
  const options = known.filter((t) => !value.includes(t)).map((t) => ({ value: t, label: t, view: <Tag name={t} /> }))

  function add(raw: string) {
    const tags = raw.split(/[,\s]+/).map(clean).filter((x, i, all) => x && !value.includes(x) && all.indexOf(x) === i)
    if (tags.length) onChange([...value, ...tags])
  }

  return (
    <Stack gap="2" w="full">
      {value.length > 0 && (
        <HStack gap="1.5" wrap="wrap">
          {value.map((t) => (
            <RemovableChip key={t} plain onRemove={() => onChange(value.filter((x) => x !== t))} label={`Убрать тег ${t}`}>
              <Tag name={t} />
            </RemovableChip>
          ))}
        </HStack>
      )}
      <SuggestInput placeholder="новый тег" options={options} onPick={add} onCreate={add} breakOn={/[,\s]$/} commitOnBlur />
    </Stack>
  )
}
