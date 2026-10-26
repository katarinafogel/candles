// The shelf of projects: closed books with a crystal that fills as the deeds get done.
// Read books stand on their own shelf; archived ones are a quiet list at the bottom.
import { Box, Button, Flex, HStack, Input, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuPlus } from 'react-icons/lu'
import { Link as RouterLink } from 'react-router-dom'
import { BookCover, bookColors } from '../../components/grimoire/BookCover'
import { Chips, Empty, Field, Modal, PageHeader, Section, TextArea, TextInput } from '../../components/ui'
import { useToday } from '../../grimoire/act'
import { humanDay } from '../../grimoire/days'
import { projectProgress, projectTasks, words } from '../../grimoire/selectors'
import type { Project } from '../../grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'

const sigils = ['🌿', '🔨', '🏡', '🌙', '🕯️', '📜', '🌸', '🪴', '🧶', '🎨', '🍄', '🗝️']

type Draft = Partial<Project> & { title: string }

export function ProjectDialog({ project, onClose, onSaved }: { project: Draft; onClose: () => void; onSaved?: (id: string) => void }) {
  const dispatch = useAppDispatch()
  const [p, setP] = useState<Draft>(project)
  const set = (x: Partial<Draft>) => setP({ ...p, ...x })
  function save() {
    const action = A.upsertProject({ project: { status: 'active', ...p, title: p.title.trim() } as Project })
    dispatch(action)
    onSaved?.(action.payload.project.id!)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={p.id ? p.title || 'Книга' : 'Новая книга'}
      footer={
        <Button onClick={save} disabled={!p.title.trim()}>
          Сохранить
        </Button>
      }
    >
      <Stack gap="4">
        <Field label="Название">
          <TextInput value={p.title} onChange={(v) => set({ title: v.slice(0, 80) })} placeholder="Ремонт" />
        </Field>
        <Field label="О чём книга">
          <TextArea value={p.description ?? ''} onChange={(v) => set({ description: v || undefined })} rows={3} />
        </Field>
        <Field label="Сигил" helper="тиснение на обложке; пусто — травинка">
          <Stack gap="2">
            <HStack gap="1" wrap="wrap">
              {sigils.map((x) => (
                <Box as="button" key={x} onClick={() => set({ sigil: p.sigil === x ? undefined : x })} fontSize="xl" w="9" h="9" borderRadius="l2" borderWidth="1px" borderColor={p.sigil === x ? 'ember.500' : 'border'} bg={p.sigil === x ? 'ember.subtle' : 'transparent'}>
                  {x}
                </Box>
              ))}
            </HStack>
            <Input value={p.sigil ?? ''} onChange={(e) => set({ sigil: [...e.target.value].slice(0, 2).join('') || undefined })} placeholder="или свой символ" maxW="160px" />
          </Stack>
        </Field>
        <Field label="Кожа и кристалл">
          <HStack gap="2" wrap="wrap">
            {bookColors.map((c) => {
              const on = (p.color ?? bookColors[0].id) === c.id
              return (
                <Box as="button" key={c.id} onClick={() => set({ color: c.id })} title={c.label} display="flex" alignItems="center" gap="1.5" px="2" py="1" borderRadius="full" borderWidth="1px" borderColor={on ? 'ember.400' : 'border'}>
                  <Box w="5" h="5" borderRadius="full" bg={c.leather} borderWidth="1px" borderColor="rgba(255,255,255,.2)" />
                  <Box w="2.5" h="3.5" bg={c.crystal} clipPath="polygon(50% 0, 100% 30%, 75% 100%, 25% 100%, 0 30%)" />
                  <Text fontSize="xs">{c.label}</Text>
                </Box>
              )
            })}
          </HStack>
        </Field>
        <Field label="Целевая дата" helper="необязательно">
          <Input type="date" value={p.targetDate ?? ''} onChange={(e) => set({ targetDate: e.target.value || undefined })} maxW="200px" />
        </Field>
        {p.id && p.status !== 'done' && (
          <Field label="Состояние">
            <Chips value={p.status ?? 'active'} onChange={(v) => set({ status: (v as Project['status']) ?? 'active' })} options={[
              { value: 'active', label: 'читаю' },
              { value: 'paused', label: 'на паузе' },
              { value: 'archived', label: 'в архиве' },
            ]} />
          </Field>
        )}
      </Stack>
    </Modal>
  )
}

function Shelf({ books }: { books: Project[] }) {
  const g = useAppSelector((s) => s.grimoire)
  const today = useToday()
  return (
    <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} gap={{ base: '5', md: '7' }} pb="2">
      {books.map((p) => {
        const all = projectTasks(g, p.id)
        const done = all.filter((t) => t.status === 'done').length
        return (
          <RouterLink key={p.id} to={`/g/projects/${p.id}`}>
            <Stack gap="2" transition="transform .2s" _hover={{ transform: 'translateY(-3px)' }}>
              <BookCover project={p} progress={projectProgress(g, p.id)} />
              <Text fontSize="xs" color="fg.muted" textAlign="center">
                {all.length ? `${done} из ${all.length}` : 'пустая'}
                {p.status === 'paused' ? ' · на паузе' : p.targetDate && p.status !== 'done' ? ` · к ${humanDay(p.targetDate, today)}` : ''}
              </Text>
            </Stack>
          </RouterLink>
        )
      })}
    </SimpleGrid>
  )
}

export default function Projects() {
  const projects = useAppSelector((s) => s.grimoire.projects)
  const meta = useAppSelector((s) => s.grimoire.meta)
  const [adding, setAdding] = useState(false)
  const list = Object.values(projects).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const reading = list.filter((p) => p.status === 'active' || p.status === 'paused')
  const read = list.filter((p) => p.status === 'done').sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
  const archived = list.filter((p) => p.status === 'archived')
  return (
    <>
      <PageHeader title={words(meta).projects}>
        <Button size="sm" onClick={() => setAdding(true)}>
          <LuPlus /> Новая книга
        </Button>
      </PageHeader>
      <Section title="На полке">
        {reading.length ? <Shelf books={reading} /> : <Empty>Полка пуста. Большое дело — ремонт, переезд, курс — заводится как книга, а его дела живут на её страницах.</Empty>}
      </Section>
      {read.length > 0 && (
        <Section title="Прочитанные">
          <Shelf books={read} />
        </Section>
      )}
      {archived.length > 0 && (
        <Flex gap="2" wrap="wrap" fontSize="sm" color="fg.subtle" mt="2">
          <Text>В архиве:</Text>
          {archived.map((p) => (
            <RouterLink key={p.id} to={`/g/projects/${p.id}`}>
              <Text textDecoration="underline">{p.title}</Text>
            </RouterLink>
          ))}
        </Flex>
      )}
      {adding && <ProjectDialog project={{ title: '' }} onClose={() => setAdding(false)} />}
    </>
  )
}
