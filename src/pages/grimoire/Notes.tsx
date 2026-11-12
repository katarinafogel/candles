// «Заметки»: notes, quotes, important moments. Those marked «повторять» come back on the scroll, one a
// day; «помню» sends a note further up the ladder (1, 3, 7, 21, 60 days), «ещё повторить» — tomorrow.
import { Box, Button, Flex, HStack, Input, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuRepeat } from 'react-icons/lu'
import { Tag } from '../../components/grimoire/Marks'
import { useAttempt } from '../../components/grimoire/RoundBlocks'
import { TagInput } from '../../components/grimoire/TagInput'
import { Check, Chips, DeleteButton, Empty, Field, Modal, PageHeader, Panel, TextArea, TextInput } from '../../components/ui'
import { useToday } from '../../grimoire/act'
import { humanDay } from '../../grimoire/days'
import type { Note } from '../../grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'

type Draft = Partial<Note> & { text: string; tags: string[] }
export const blankNote: Draft = { text: '', tags: [] }

export function NoteDialog({ note, onClose }: { note: Draft; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [n, setN] = useState<Draft>(note)
  const set = (p: Partial<Draft>) => setN((x) => ({ ...x, ...p }))
  const check = useAttempt()
  const save = () =>
    check.attempt(!!n.text.trim(), () => {
      dispatch(A.upsertNote({ note: { ...n, source: n.source?.trim() || undefined } }))
      onClose()
    })
  return (
    <Modal
      open
      onClose={onClose}
      title={n.id ? 'Заметка' : 'Новая заметка'}
      footer={
        <>
          {n.id && (
            <DeleteButton confirm="Удалить заметку?" onDelete={() => {
              dispatch(A.deleteNote(n.id!))
              onClose()
            }}
            />
          )}
          <Button onClick={save}>Сохранить</Button>
        </>
      }
    >
      <Stack gap="4">
        <Field label="Текст" invalid={check.missing(!n.text.trim())} error="Здесь пусто">
          <TextArea value={n.text} onChange={(text) => set({ text })} rows={5} />
        </Field>
        <Field label="Откуда" helper="книга, человек, место">
          <TextInput value={n.source ?? ''} onChange={(source) => set({ source })} />
        </Field>
        <Field label="Теги">
          <TagInput value={n.tags} onChange={(tags) => set({ tags })} />
        </Field>
        <Check checked={!!n.repeat} onChange={(repeat) => set({ repeat: repeat || undefined })}>
          Повторять: показывать в свитке дня, всё реже
        </Check>
      </Stack>
    </Modal>
  )
}

/** The note to come back to today: the one waiting the longest. */
export function useNoteOfDay(today: string) {
  const notes = useAppSelector((s) => s.grimoire.notes)
  return Object.values(notes)
    .filter((n) => n.repeat && n.nextOn && n.nextOn <= today)
    .sort((a, b) => a.nextOn!.localeCompare(b.nextOn!))[0]
}

export default function Notes() {
  const notes = useAppSelector((s) => s.grimoire.notes)
  const today = useToday()
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string>()
  const [edit, setEdit] = useState<Draft>()
  const all = Object.values(notes)
  const tags = [...new Set(all.flatMap((n) => n.tags))].sort((a, b) => a.localeCompare(b, 'ru'))
  const needle = q.trim().toLowerCase()
  const list = all
    .filter((n) => (!tag || n.tags.includes(tag)) && (!needle || `${n.text} ${n.source ?? ''}`.toLowerCase().includes(needle)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <>
      <PageHeader title="Заметки" />
      <Stack gap="3" mb="4">
        <Input size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" />
        {tags.length > 0 && <Chips value={tag} onChange={(v) => setTag((v as string) ?? undefined)} options={tags.map((t) => ({ value: t, label: `#${t}` }))} />}
      </Stack>
      {list.length ? (
        <Stack gap="2">
          {list.map((n) => (
            <Panel key={n.id} onClick={() => setEdit(n)}>
              <Text whiteSpace="pre-wrap" lineClamp={5}>
                {n.text}
              </Text>
              <Flex gap="2" mt="1.5" align="center" wrap="wrap" fontSize="xs" color="fg.muted">
                {n.source && <Text>— {n.source}</Text>}
                {n.tags.map((t) => (
                  <Tag key={t} name={t} />
                ))}
                {n.repeat && (
                  <HStack gap="1" title="повторяется">
                    <LuRepeat />
                    <Text>{n.nextOn ? (n.nextOn <= today ? 'сегодня' : humanDay(n.nextOn, today)) : ''}</Text>
                  </HStack>
                )}
              </Flex>
            </Panel>
          ))}
        </Stack>
      ) : (
        <Empty>{all.length ? 'Ничего не нашлось.' : 'Пока пусто. Цитата, мысль, важный момент — добавить через плюсик внизу.'}</Empty>
      )}
      {edit && <NoteDialog note={edit} onClose={() => setEdit(undefined)} />}
    </>
  )
}
