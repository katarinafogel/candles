// The small optional question at a deed. At «Начать понемногу»: «С каким чувством берёшься?» — one
// tap on a word. After «Сделала»: one window «Как теперь?» — a word first, below it how it really went
// («Как далось?» lives here, it isn't asked apart). Words are asked only where the settings say (by
// default at frogs and «чудовища»); the rest still get «Как далось?». Real answers pile up as «expected
// vs real», and the words as «before → after».
import { Box, Button, CloseButton, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { asksEmotion, feedback } from '../../grimoire/act'
import { quickWords } from '../../grimoire/emotions'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { Field, Modal, TextInput } from '../ui'
import { WordChip } from './EmotionWheel'
import { MarkPicker } from './Marks'

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

function QuickWords({ chosen, onPick, onMore }: { chosen?: string; onPick: (k: string) => void; onMore: () => void }) {
  return (
    <Flex gap="1.5" wrap="wrap">
      {quickWords.map((k) => (
        <Box key={k} opacity={!chosen || chosen === k ? 1 : 0.55} outline={chosen === k ? '2px solid' : undefined} outlineColor="ember.200" borderRadius="full">
          <WordChip wordKey={k} size="xs" onClick={() => onPick(k)} />
        </Box>
      ))}
      <Button size="2xs" variant="ghost" onClick={onMore}>
        другое слово…
      </Button>
    </Flex>
  )
}

export function FeedbackPrompt() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const ask = useSyncExternalStore(feedback.subscribe, feedback.get)
  const task = useAppSelector((s) => (ask ? s.grimoire.tasks[ask.id] : undefined))
  const emotionAsk = useAppSelector((s) => s.grimoire.meta.emotionAsk)
  const [detail, setDetail] = useState(false)
  const [word, setWord] = useState<string>()
  const [stars, setStars] = useState(1)
  const [dread, setDread] = useState(0)
  const [note, setNote] = useState('')
  const touched = useRef(false)

  useEffect(() => {
    if (!task) return
    setStars(task.stars)
    setDread(task.dread)
    setNote('')
    setWord(undefined)
    setDetail(false)
    touched.current = false
    // The question leaves by itself: it must never stand in the way.
    const t = setTimeout(() => !touched.current && feedback.clear(), 12000)
    return () => clearTimeout(t)
  }, [ask]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!task || !ask) return null
  const starting = ask.kind === 'start'
  if (starting ? task.status === 'done' : task.status !== 'done') return null
  const words = asksEmotion(task, emotionAsk)
  if (starting && !words) return null

  const more = () => {
    feedback.clear()
    navigate(`/g/mirror/new?task=${task.id}&source=${starting ? 'task_start' : 'task_done'}${word ? `&word=${word}` : ''}`)
  }
  const saveStart = (k: string) => {
    dispatch(A.addJournal({ entry: { type: 'entry', source: 'task_start', taskId: task.id, words: [k], tags: task.tags } }))
    feedback.clear()
  }
  const save = (real?: { stars: number; dread: number }, text?: string) => {
    dispatch(
      A.addJournal({
        entry: { type: 'taskFeedback', source: 'task_done', taskId: task.id, words: word ? [word] : undefined, realStars: real?.stars, realDread: real?.dread, text: text || undefined, tags: task.tags },
      }),
    )
    feedback.clear()
  }
  const title = starting ? 'С каким чувством берёшься?' : words ? 'Как теперь?' : 'Как далось?'

  if (detail)
    return (
      <Modal open onClose={() => feedback.clear()} title={title} footer={<Button onClick={() => save({ stars, dread }, note)}>Записать</Button>}>
        <Stack gap="4">
          <Text fontSize="sm" color="fg.muted">
            «{task.title}»
          </Text>
          {words && (
            <Field label="Чувство">
              <QuickWords chosen={word} onPick={(k) => setWord(word === k ? undefined : k)} onMore={more} />
            </Field>
          )}
          <Field label="На самом деле сложность">
            <MarkPicker kind="stars" value={stars} onChange={setStars} />
          </Field>
          <Field label="На самом деле нехотение">
            <MarkPicker kind="dread" value={dread} onChange={setDread} />
          </Field>
          <Field label="Пара слов">
            <TextInput value={note} onChange={setNote} placeholder="оказалось за 10 минут" />
          </Field>
        </Stack>
      </Modal>
    )

  return (
    <Box position="fixed" left={{ base: '4', md: '264px' }} right={{ base: '4', md: 'auto' }} bottom={{ base: 'calc(80px + env(safe-area-inset-bottom))', md: '8' }} zIndex="sticky" maxW="460px">
      <Box p="3" borderRadius="l3" borderWidth="1px" borderColor="border.emphasized" bg="bg.panel" boxShadow="0 10px 30px -10px rgba(0,0,0,.8)" onPointerDown={() => (touched.current = true)}>
        <Flex justify="space-between" align="center" mb="2" gap="2">
          <Text fontSize="sm">
            {title}{' '}
            <Text as="span" color="fg.subtle" fontSize="xs">
              {task.title}
            </Text>
          </Text>
          <CloseButton size="xs" onClick={() => feedback.clear()} />
        </Flex>
        <Stack gap="2.5">
          {words && <QuickWords chosen={word} onPick={(k) => (starting ? saveStart(k) : setWord(word === k ? undefined : k))} onMore={more} />}
          {!starting && (
            <HStack gap="1.5" wrap="wrap">
              {words && (
                <Text fontSize="xs" color="fg.subtle" w="full">
                  как далось:
                </Text>
              )}
              <Button size="xs" variant="outline" onClick={() => save({ stars: clamp(task.stars - 1, 1, 3), dread: clamp(task.dread - 1, 0, 3) })}>
                легче, чем думала
              </Button>
              <Button size="xs" variant="outline" onClick={() => save({ stars: task.stars, dread: task.dread })}>
                как думала
              </Button>
              <Button size="xs" variant="outline" onClick={() => save({ stars: clamp(task.stars + 1, 1, 3), dread: clamp(task.dread + 1, 0, 3) })}>
                тяжелее
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setDetail(true)}>
                подробнее
              </Button>
              {word && (
                <Button size="xs" ml="auto" onClick={() => save()}>
                  Записать
                </Button>
              )}
            </HStack>
          )}
        </Stack>
      </Box>
    </Box>
  )
}
