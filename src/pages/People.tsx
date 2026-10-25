import { Badge, Box, Button, Flex, HStack, IconButton, Input, Stack, Text, Wrap } from '@chakra-ui/react'
import { useState } from 'react'
import { LuPencil, LuPlus } from 'react-icons/lu'
import { useSearchParams } from 'react-router-dom'
import { Check, confirmAction, Empty, Field, IdBadge, Modal, PageHeader, TextArea, TextInput } from '../components/ui'
import { candleStageLabel } from '../lib/labels'
import { reviewsOf } from '../lib/selectors'
import { useAppDispatch, useData } from '../store'
import { actions } from '../store/dataSlice'
import type { Person } from '../types'

function PersonDialog({ person, onClose }: { person: Omit<Person, 'id'> & { id?: string }; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [p, setP] = useState(person)
  return (
    <Modal
      open
      onClose={onClose}
      title={p.id ? p.name : 'Новый человек'}
      footer={
        <>
          {p.id && (
            <Button
              variant="ghost"
              colorPalette="red"
              mr="auto"
              onClick={() => {
                if (confirmAction('Удалить человека? Свечи останутся, но без имени получателя.')) {
                  dispatch(actions.deletePerson(p.id!))
                  onClose()
                }
              }}
            >
              Удалить
            </Button>
          )}
          <Button
            disabled={!p.name.trim()}
            onClick={() => {
              dispatch(actions.upsertPerson(p))
              onClose()
            }}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <Stack gap="4">
        <Field label="Имя">
          <TextInput value={p.name} onChange={(v) => setP({ ...p, name: v })} />
        </Field>
        <Field label="Контакт" helper="телеграм, телефон">
          <TextInput value={p.contact} onChange={(v) => setP({ ...p, contact: v })} />
        </Field>
        <Field label="Заметки">
          <TextArea value={p.notes} onChange={(v) => setP({ ...p, notes: v })} placeholder="любит пряные, есть кот" />
        </Field>
      </Stack>
    </Modal>
  )
}

export default function People() {
  const d = useData()
  const [sp] = useSearchParams()
  const [edit, setEdit] = useState<(Omit<Person, 'id'> & { id?: string }) | null>(null)
  const [q, setQ] = useState('')
  const [silent, setSilent] = useState(false)
  const focus = sp.get('p')

  const people = Object.values(d.people)
    .map((p) => {
      const candles = Object.values(d.candles).filter((c) => c.personId === p.id)
      const unanswered = candles.filter((c) => !reviewsOf(d, c.id).length)
      return { p, candles, unanswered }
    })
    .filter((x) => (!q || x.p.name.toLowerCase().includes(q.toLowerCase())) && (!silent || x.unanswered.length))
    .sort((a, b) => (a.p.id === focus ? -1 : b.p.id === focus ? 1 : a.p.name.localeCompare(b.p.name, 'ru')))

  return (
    <>
      <PageHeader title="Люди" back="/more">
        <Button size="sm" onClick={() => setEdit({ name: '', contact: '', notes: '' })}>
          <LuPlus /> Человек
        </Button>
      </PageHeader>
      <Flex gap="3" mb="4" align="center" wrap="wrap">
        <Input placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} maxW="sm" />
        <Check checked={silent} onChange={setSilent}>
          <Text fontSize="sm">Кто не ответил</Text>
        </Check>
      </Flex>
      {!people.length && <Empty>Пока никого.</Empty>}
      <Stack gap="2">
        {people.map(({ p, candles, unanswered }) => (
          <Box key={p.id} p="3" borderWidth="1px" borderColor={p.id === focus ? 'emerald.600' : 'border'} bg="bg.subtle" borderRadius="l3">
            <Flex justify="space-between" align="start" gap="2">
              <Box>
                <HStack>
                  <Text fontWeight="semibold">{p.name}</Text>
                  {unanswered.length > 0 && <Badge colorPalette="orange">не ответил(а): {unanswered.length}</Badge>}
                </HStack>
                <Text fontSize="xs" color="fg.muted">
                  {[p.contact, p.notes].filter(Boolean).join(' · ')}
                </Text>
              </Box>
              <IconButton size="xs" variant="ghost" aria-label="изменить" onClick={() => setEdit(p)}>
                <LuPencil />
              </IconButton>
            </Flex>
            {candles.length > 0 && (
              <Wrap mt="2" gap="2">
                {candles.map((c) => (
                  <HStack key={c.id} gap="1">
                    <IdBadge id={c.id} to={`/candles/${c.id}`} />
                    <Text fontSize="xs" color="fg.muted">
                      {c.name} · {reviewsOf(d, c.id).length ? `отзывов ${reviewsOf(d, c.id).length}` : candleStageLabel[c.stage].toLowerCase()}
                    </Text>
                  </HStack>
                ))}
              </Wrap>
            )}
          </Box>
        ))}
      </Stack>
      {edit && <PersonDialog person={edit} onClose={() => setEdit(null)} />}
    </>
  )
}
