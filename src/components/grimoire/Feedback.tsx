// «Как далось?» after a deed: one optional tap. The answers pile up as «expected vs real», so later it
// shows which deeds are scarier in the head than in life.
import { Box, Button, CloseButton, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { feedback } from '../../grimoire/act'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { Field, Modal, TextInput } from '../ui'
import { MarkPicker } from './Marks'

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export function FeedbackPrompt() {
  const dispatch = useAppDispatch()
  const id = useSyncExternalStore(feedback.subscribe, feedback.get)
  const task = useAppSelector((s) => (id ? s.grimoire.tasks[id] : undefined))
  const [detail, setDetail] = useState(false)
  const [stars, setStars] = useState(1)
  const [dread, setDread] = useState(0)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!task) return
    setStars(task.stars)
    setDread(task.dread)
    setNote('')
    setDetail(false)
    // The question leaves by itself: it must never stand in the way.
    const t = setTimeout(() => !detailRef.open && feedback.clear(), 9000)
    return () => clearTimeout(t)
  }, [task?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  detailRef.open = detail

  if (!task || task.status !== 'done') return null

  const save = (realStars: number, realDread: number, text?: string) => {
    dispatch(A.addJournal({ entry: { type: 'taskFeedback', taskId: task.id, realStars, realDread, text: text || undefined, tags: task.tags } }))
    feedback.clear()
  }

  if (detail)
    return (
      <Modal
        open
        onClose={() => feedback.clear()}
        title="Как далось?"
        footer={<Button onClick={() => save(stars, dread, note)}>Записать</Button>}
      >
        <Stack gap="4">
          <Text fontSize="sm" color="fg.muted">
            «{task.title}»
          </Text>
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
    <Box position="fixed" left={{ base: '4', md: '264px' }} right={{ base: '4', md: 'auto' }} bottom={{ base: 'calc(80px + env(safe-area-inset-bottom))', md: '8' }} zIndex="sticky" maxW="440px">
      <Box p="3" borderRadius="l3" borderWidth="1px" borderColor="border.emphasized" bg="bg.panel" boxShadow="0 10px 30px -10px rgba(0,0,0,.8)">
        <Flex justify="space-between" align="center" mb="2">
          <Text fontSize="sm">Как далось?</Text>
          <CloseButton size="xs" onClick={() => feedback.clear()} />
        </Flex>
        <HStack gap="1.5" wrap="wrap">
          <Button size="xs" variant="outline" onClick={() => save(clamp(task.stars - 1, 1, 3), clamp(task.dread - 1, 0, 3))}>
            легче, чем думала
          </Button>
          <Button size="xs" variant="outline" onClick={() => save(task.stars, task.dread)}>
            как думала
          </Button>
          <Button size="xs" variant="outline" onClick={() => save(clamp(task.stars + 1, 1, 3), clamp(task.dread + 1, 0, 3))}>
            тяжелее
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setDetail(true)}>
            подробнее
          </Button>
        </HStack>
      </Box>
    </Box>
  )
}

const detailRef = { open: false }
