// The shelf of projects: closed books with a crystal that fills as the deeds get done.
// Read books are shown on a switch; archived ones live behind the «Архив» button.
import { Box, Button, Flex, HStack, Input, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuArchive } from 'react-icons/lu'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { BookCover, bookColors } from '../../components/grimoire/BookCover'
import { useAttempt } from '../../components/grimoire/RoundBlocks'
import { Check, Chips, DateInput, Empty, Field, Modal, notify, PageHeader, Panel, Section, SigilPicker, TextArea, TextInput } from '@shared/components/ui'
import { useToday } from '../../grimoire/act'
import { humanDay, plural } from '@grimoire-core/grimoire/days'
import { projectProgress, projectTasks, words } from '@grimoire-core/grimoire/selectors'
import type { Project } from '@grimoire-core/grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '@grimoire-core/store/grimoireSlice'

const sigils = ['🌿', '🔨', '🏡', '🌙', '🕯️', '📜', '🌸', '🪴', '🧶', '🎨', '🍄', '🗝️']

type Draft = Partial<Project> & { title: string }

export function ProjectDialog({ project, onClose, onSaved }: { project: Draft; onClose: () => void; onSaved?: (id: string) => void }) {
  const dispatch = useAppDispatch()
  const [p, setP] = useState<Draft>(project)
  const set = (x: Partial<Draft>) => setP({ ...p, ...x })
  const check = useAttempt()
  const [fate, setFate] = useState<'archive' | 'delete'>()
  const save = () => check.attempt(!!p.title.trim(), write)
  function write() {
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
        <HStack gap="2" w="full" justify="flex-end" wrap="wrap">
          {p.id && (
            <>
              <Button variant="ghost" colorPalette="red" onClick={() => setFate('delete')}>
                Удалить
              </Button>
              {p.status === 'archived' ? (
                <Button
                  variant="ghost"
                  mr="auto"
                  onClick={() => {
                    dispatch(A.unarchiveProject(p.id!))
                    notify('Книга вернулась на полку', 'success')
                    onClose()
                  }}
                >
                  Вернуть из архива
                </Button>
              ) : (
                <Button variant="ghost" mr="auto" onClick={() => setFate('archive')}>
                  В архив
                </Button>
              )}
            </>
          )}
          <Button onClick={save}>Сохранить</Button>
        </HStack>
      }
    >
      {fate && p.id && <ProjectFateDialog id={p.id} mode={fate} onClose={() => setFate(undefined)} onDone={onClose} />}
      <Stack gap="4">
        <Field label="Название" invalid={check.missing(!p.title.trim())} error="Назови книгу">
          <TextInput value={p.title} onChange={(v) => set({ title: v.slice(0, 80) })} />
        </Field>
        <Field label="О чём книга">
          <TextArea value={p.description ?? ''} onChange={(v) => set({ description: v || undefined })} rows={3} />
        </Field>
        <Field label="Сигил" helper="тиснение на обложке; пусто — травинка">
          <Stack gap="2">
            <SigilPicker options={sigils} value={p.sigil} onChange={(sigil) => set({ sigil })} />
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
          <DateInput value={p.targetDate ?? ''} onChange={(v) => set({ targetDate: v || undefined })} w="200px" />
        </Field>
        {p.id && p.status !== 'done' && p.status !== 'archived' && (
          <Field label="Состояние">
            <Chips value={p.status ?? 'active'} onChange={(v) => set({ status: (v as Project['status']) ?? 'active' })} options={[
              { value: 'active', label: 'читаю' },
              { value: 'paused', label: 'на паузе' },
            ]} />
          </Field>
        )}
      </Stack>
    </Modal>
  )
}

/**
 * «В архив» or «Удалить» for a book: what happens with its open deeds is asked every time. Done deeds
 * stay in the history either way.
 */
export function ProjectFateDialog({ id, mode, onClose, onDone }: { id: string; mode: 'archive' | 'delete'; onClose: () => void; onDone?: () => void }) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const g = useAppSelector((s) => s.grimoire)
  const project = g.projects[id]
  const open = Object.values(g.tasks).filter((t) => t.projectId === id && !t.parentId && t.status !== 'done' && t.status !== 'cancelled').length
  type How = 'shelve' | 'detach' | 'delete'
  const [how, setHow] = useState<How>(mode === 'archive' ? 'shelve' : 'detach')
  if (!project) return null
  const go = () => {
    if (mode === 'archive') {
      dispatch(A.archiveProject({ id, tasks: how }))
      notify('Книга в архиве', 'success')
    } else {
      dispatch(A.deleteProject({ id, tasks: how === 'shelve' ? 'detach' : how }))
      notify('Книга удалена', 'success')
      navigate('/projects')
    }
    onClose()
    onDone?.()
  }
  const options: { value: How; label: string }[] = [
    ...(mode === 'archive' ? [{ value: 'shelve' as How, label: 'в архив вместе с книгой' }] : []),
    { value: 'detach', label: 'отвязать и оставить' },
    { value: 'delete', label: 'удалить' },
  ]
  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'archive' ? `В архив: ${project.title}` : `Удалить: ${project.title}`}
      footer={
        <Button colorPalette={mode === 'delete' ? 'red' : undefined} onClick={go}>
          {mode === 'archive' ? 'В архив' : 'Удалить насовсем'}
        </Button>
      }
    >
      <Stack gap="4">
        {mode === 'delete' && <Text>Книга удалится насовсем. Сделанные дела останутся в истории, желания и копилки — без привязки к книге.</Text>}
        {open > 0 ? (
          <Field label={`В книге ${plural(open, 'незакрытое дело', 'незакрытых дела', 'незакрытых дел')}. Что с ними?`}>
            <Chips value={how} onChange={(v) => setHow((v as How) ?? how)} options={options} />
          </Field>
        ) : (
          mode === 'archive' && <Text color="fg.muted">Незакрытых дел в книге нет. Вернуть её можно из архива.</Text>
        )}
        {open > 0 && how === 'shelve' && (
          <Text fontSize="sm" color="fg.muted">
            Дела пропадут из плана и бэклога. Когда вернёшь книгу из архива, они вернутся в бэклог.
          </Text>
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
          <RouterLink key={p.id} to={`/projects/${p.id}`}>
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
  const list = Object.values(projects).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const reading = list.filter((p) => p.status === 'active' || p.status === 'paused')
  const read = list.filter((p) => p.status === 'done').sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
  const archived = list.filter((p) => p.status === 'archived')
  const [showRead, setShowRead] = useState(() => {
    try {
      return localStorage.getItem('g.projects.showRead') === '1'
    } catch {
      return false
    }
  })
  const toggleRead = (v: boolean) => {
    setShowRead(v)
    try {
      localStorage.setItem('g.projects.showRead', v ? '1' : '0')
    } catch {
      // private mode: the switch just isn't remembered
    }
  }
  const [archive, setArchive] = useState(false)
  return (
    <>
      <PageHeader title={words(meta).projects}>
        <HStack gap="3">
          <Check checked={showRead} onChange={toggleRead}>
            Показывать прочитанные
          </Check>
          <Button size="sm" variant="outline" onClick={() => setArchive(true)}>
            <LuArchive /> Архив{archived.length ? ` · ${archived.length}` : ''}
          </Button>
        </HStack>
      </PageHeader>
      {archive && <ArchiveDialog books={archived} onClose={() => setArchive(false)} />}
      <Section title="На полке">
        {reading.length ? <Shelf books={reading} /> : <Empty>Полка пуста. Большое дело — ремонт, переезд, курс — заводится как книга, а его дела живут на её страницах.</Empty>}
      </Section>
      {showRead && read.length > 0 && (
        <Section title="Прочитанные">
          <Shelf books={read} />
        </Section>
      )}
    </>
  )
}

/** The archive: books put away, each can come back or go for good. */
function ArchiveDialog({ books, onClose }: { books: Project[]; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [removing, setRemoving] = useState<string>()
  return (
    <Modal open onClose={onClose} title="Архив книг">
      {books.length ? (
        <Stack gap="2">
          {books.map((p) => (
            <Panel display="flex" key={p.id} alignItems="center" gap="2" p="2" flexWrap="wrap">
              <RouterLink to={`/projects/${p.id}`} onClick={onClose} style={{ flex: 1, minWidth: 140 }}>
                <Text>
                  {p.sigil ?? '🌿'} {p.title}
                </Text>
              </RouterLink>
              <Button size="xs" variant="outline" onClick={() => dispatch(A.unarchiveProject(p.id))}>
                Вернуть
              </Button>
              <Button size="xs" variant="ghost" colorPalette="red" onClick={() => setRemoving(p.id)}>
                Удалить
              </Button>
            </Panel>
          ))}
        </Stack>
      ) : (
        <Empty>В архиве пусто.</Empty>
      )}
      {removing && <ProjectFateDialog id={removing} mode="delete" onClose={() => setRemoving(undefined)} />}
    </Modal>
  )
}
