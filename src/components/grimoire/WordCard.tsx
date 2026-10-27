// A word's page in the dictionary: what it means, how it feels in the body, its neighbours by strength,
// its opposite, and how often it was marked. Read only: the texts live in code.
import { Box, Flex, Stack, Text } from '@chakra-ui/react'
import { dyads, emotionWords, petals, petalWords, wordColor } from '../../grimoire/emotions'
import { humanDay, plural } from '../../grimoire/days'
import { useToday } from '../../grimoire/act'
import { useAppSelector } from '../../store'
import { Modal } from '../ui'
import { WordChip } from './EmotionWheel'

export function WordCard({ wordKey, onClose, onPick }: { wordKey: string; onClose: () => void; onPick?: (key: string) => void }) {
  const journal = useAppSelector((s) => s.grimoire.journal)
  const today = useToday()
  const w = emotionWords[wordKey]
  if (!w) return null
  const marked = Object.values(journal)
    .filter((e) => e.words?.includes(wordKey))
    .sort((a, b) => b.at.localeCompare(a.at))
  const dyad = w.dyad ? dyads.find((d) => d.key === w.dyad) : undefined
  const opposite = w.petal ? emotionWords[`${petals[w.petal].opposite}.${w.intensity}`] : undefined
  const go = onPick ?? (() => {})
  return (
    <Modal open onClose={onClose} title={w.word} size="sm">
      <Stack gap="4">
        <Flex gap="2" align="center" color="fg.muted" fontSize="sm">
          <Box w="10px" h="10px" borderRadius="full" bg={wordColor(wordKey)} />
          {w.petal ? `${petals[w.petal].name} · ${['слабо', 'средне', 'сильно'][w.intensity! - 1]}` : `смешанное: ${dyad!.from.map((p) => petals[p].name.toLowerCase()).join(' + ')}`}
        </Flex>
        <Text>{w.explain}</Text>
        <Box>
          <Text fontSize="xs" color="fg.subtle" textTransform="uppercase" letterSpacing=".06em" mb="1">
            В теле
          </Text>
          <Text fontSize="sm">{w.body}</Text>
        </Box>
        {w.petal && (
          <Box>
            <Text fontSize="xs" color="fg.subtle" textTransform="uppercase" letterSpacing=".06em" mb="1.5">
              По силе
            </Text>
            <Flex gap="1.5" wrap="wrap">
              {petalWords(w.petal).map((x) => (
                <WordChip key={x.key} wordKey={x.key} onClick={x.key === wordKey ? undefined : () => go(x.key)} />
              ))}
            </Flex>
          </Box>
        )}
        {(opposite || dyad) && (
          <Box>
            <Text fontSize="xs" color="fg.subtle" textTransform="uppercase" letterSpacing=".06em" mb="1.5">
              {opposite ? 'Противоположность' : 'Из чего'}
            </Text>
            <Flex gap="1.5" wrap="wrap">
              {opposite ? <WordChip wordKey={opposite.key} onClick={() => go(opposite.key)} /> : dyad!.from.map((p) => <WordChip key={p} wordKey={`${p}.2`} onClick={() => go(`${p}.2`)} />)}
            </Flex>
          </Box>
        )}
        <Text fontSize="sm" color="fg.muted">
          {marked.length ? `Отмечала ${plural(marked.length, 'раз', 'раза', 'раз')} · последний раз ${humanDay(marked[0].day, today)}` : 'Ещё не отмечала.'}
        </Text>
      </Stack>
    </Modal>
  )
}
