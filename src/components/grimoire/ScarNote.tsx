// A quiet reminder under a deed tied to someone with a scar not let go: the last one, and a question.
// The decision stays hers — nothing is blocked.
import { Box, Text } from '@chakra-ui/react'
import { liveScars, monthDay } from '@grimoire-core/grimoire/people'
import { useAppSelector } from '../../store'

export function ScarNote({ personIds }: { personIds: (string | undefined)[] }) {
  const notes = useAppSelector((s) => s.grimoire.personNotes)
  const people = useAppSelector((s) => s.grimoire.beings)
  const lines = [...new Set(personIds.filter((x): x is string => !!x))]
    .map((id) => ({ id, scar: liveScars(notes[id])[0] }))
    .filter((x) => x.scar && people[x.id])
  if (!lines.length) return null
  return (
    <Box px="3" py="2" borderRadius="l2" borderWidth="1px" borderColor="border" bg="ember.subtle">
      {lines.map(({ id, scar }) => (
        <Text key={id} fontSize="xs" color="fg.muted">
          {people[id].name}, {monthDay(scar!.day)}: {scar!.text}. Точно хочешь?
        </Text>
      ))}
    </Box>
  )
}
