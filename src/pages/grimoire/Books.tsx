// «Книжная полка»: books to read, being read and read. «Куплена» is a mark of its own, apart from the
// status: a bought book can still wait its turn. Moving a book on dates it by itself (grimoireSlice).
// «Хочу прочесть» is a queue in her own order; filters and orders live in grimoire-core (books.ts).
import { Box, Button, Flex, HStack, Input, SimpleGrid, Stack, Tabs, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuArrowDown, LuArrowUp, LuFlag, LuHash, LuLink, LuPen, LuShoppingBag } from 'react-icons/lu'
import { PriorityIcon, Tag } from '../../components/grimoire/Marks'
import { PriorityPicker } from '../../components/grimoire/TaskFields'
import { HoverTrash } from '../../components/grimoire/HoverTrash'
import { BlockSpot, useAttempt, useRoundBlocks, type RoundBlock } from '../../components/grimoire/RoundBlocks'
import { TagInput } from '../../components/grimoire/TagInput'
import { Check, Chips, confirmAction, DateInput, DeleteButton, Empty, Field, Modal, PageHeader, Select, StarRating, TextArea, TextInput } from '@shared/components/ui'
import type { Book, BookFormat, BookStatus } from '@grimoire-core/grimoire/types'
import { bookFormats, bookSorts, defaultBookSort, filterBooks, isFilteringBooks, type BookFilter, type BookSort } from '@grimoire-core/grimoire/books'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '@grimoire-core/store/grimoireSlice'
import { wishHref } from './Wishes'

type Draft = Partial<Book> & { title: string; status: BookStatus; tags: string[] }
export const blankBook: Draft = { title: '', status: 'want', tags: [] }

const statuses: { value: BookStatus; label: string }[] = [
  { value: 'want', label: 'хочу прочесть' },
  { value: 'reading', label: 'читаю' },
  { value: 'read', label: 'прочитано' },
]
/** The quick step on a card: what comes after this status. */
const nextStep: Partial<Record<BookStatus, { to: BookStatus; label: string }>> = {
  want: { to: 'reading', label: 'Начать' },
  reading: { to: 'read', label: 'Дочитала' },
}

const ddmmyy = (day?: string) => (day ? `${day.slice(8)}.${day.slice(5, 7)}.${day.slice(2, 4)}` : '')

type BookBlock = 'tags' | 'priority' | 'url' | 'note'
const bookBlocks: RoundBlock<BookBlock>[] = [
  { key: 'tags', label: 'Теги', icon: <LuHash /> },
  { key: 'priority', label: 'Приоритет', icon: <LuFlag /> },
  { key: 'url', label: 'Ссылка', icon: <LuLink /> },
  { key: 'note', label: 'Заметка', icon: <LuPen /> },
]
const clearBook: Record<BookBlock, Partial<Draft>> = { tags: { tags: [] }, priority: { priority: undefined }, url: { url: undefined }, note: { note: undefined } }
const formatLabel = Object.fromEntries(bookFormats.map((f) => [f.value, f.label])) as Record<BookFormat, string>

export function BookDialog({ book, onClose }: { book: Draft; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [b, setB] = useState<Draft>(book)
  const set = (p: Partial<Draft>) => setB((x) => ({ ...x, ...p }))
  // Tags are open from the start: a book almost always gets one.
  const filled: BookBlock[] = ['tags']
  if (book.priority) filled.push('priority')
  if (book.url) filled.push('url')
  if (book.note) filled.push('note')
  const blocks = useRoundBlocks(bookBlocks, filled, (k) => set(clearBook[k]))
  const check = useAttempt()
  const save = () =>
    check.attempt(!!b.title.trim(), () => {
      dispatch(A.upsertBook({ book: b }))
      onClose()
    })
  return (
    <Modal
      open
      onClose={onClose}
      title={b.id ? b.title : 'Новая книга'}
      footer={
        <Stack gap="3" w="full">
          {blocks.toolbar}
          <HStack gap="2" justify="flex-end">
            {b.id && (
              <DeleteButton
                confirm="Убрать книгу с полки?"
                onDelete={() => {
                  dispatch(A.deleteBook(b.id!))
                  onClose()
                }}
              />
            )}
            <Button onClick={save}>Сохранить</Button>
          </HStack>
        </Stack>
      }
    >
      <Stack gap="4">
        <Field label="Название" invalid={check.missing(!b.title.trim())} error="Как называется?">
          <TextInput value={b.title} onChange={(title) => set({ title })} />
        </Field>
        <Field label="Автор">
          <TextInput value={b.author ?? ''} onChange={(author) => set({ author: author || undefined })} />
        </Field>
        <Field label="Где она">
          <Chips value={b.status} onChange={(v) => v && set({ status: v as BookStatus })} options={statuses} />
        </Field>
        <Field label="Формат">
          <Chips value={b.format} onChange={(v) => set({ format: (v as BookFormat | undefined) ?? undefined })} options={bookFormats} />
        </Field>
        <Check checked={!!b.bought} onChange={(bought) => set({ bought: bought || undefined })}>
          Куплена
        </Check>
        {b.status !== 'want' && (
          <HStack gap="3" wrap="wrap" align="flex-end">
            <Field label="Начала" helper="пусто — сегодня">
              <DateInput size="sm" w="170px" value={b.startedOn ?? ''} onChange={(v) => set({ startedOn: v || undefined })} />
            </Field>
            {b.status === 'read' && (
              <Field label="Дочитала" helper="пусто — сегодня">
                <DateInput size="sm" w="170px" value={b.finishedOn ?? ''} onChange={(v) => set({ finishedOn: v || undefined })} />
              </Field>
            )}
          </HStack>
        )}
        {b.status === 'read' && (
          <Field label="Оценка">
            <StarRating value={b.rating} onChange={(rating) => set({ rating })} />
          </Field>
        )}
        {blocks.show('tags') && (
          <BlockSpot active={blocks.opened === 'tags'}>
            <Field label="Теги" helper="Enter или запятая добавляет, тап по тегу убирает">
              <TagInput value={b.tags} onChange={(tags) => set({ tags })} />
            </Field>
          </BlockSpot>
        )}
        {blocks.show('priority') && (
          <BlockSpot active={blocks.opened === 'priority'}>
            <Field label="Приоритет" helper="насколько хочется её прочесть">
              <PriorityPicker value={b.priority ?? 'medium'} onChange={(priority) => set({ priority })} />
            </Field>
          </BlockSpot>
        )}
        {blocks.show('url') && (
          <BlockSpot active={blocks.opened === 'url'}>
            <Field label="Ссылка" helper="магазин, библиотека, отзыв">
              <TextInput value={b.url ?? ''} onChange={(v) => set({ url: v.trim() || undefined })} placeholder="https://" />
            </Field>
          </BlockSpot>
        )}
        {blocks.show('note') && (
          <BlockSpot active={blocks.opened === 'note'}>
            <Field label="Заметка" helper="кто посоветовал, о чём, что запомнилось">
              <TextArea value={b.note ?? ''} onChange={(v) => set({ note: v || undefined })} rows={3} />
            </Field>
          </BlockSpot>
        )}
      </Stack>
    </Modal>
  )
}

/** `place` — its number in the queue; `move` — the «выше» / «ниже» arrows, only in the plain queue. */
function BookCard({ b, onOpen, place, move }: { b: Book; onOpen: () => void; place?: number; move?: { up: boolean; down: boolean } }) {
  const dispatch = useAppDispatch()
  const step = nextStep[b.status]
  const href = wishHref(b.url)
  const dates = b.status === 'read' ? [b.startedOn && `с ${ddmmyy(b.startedOn)}`, b.finishedOn && `по ${ddmmyy(b.finishedOn)}`] : b.status === 'reading' ? [b.startedOn && `читаю с ${ddmmyy(b.startedOn)}`] : []
  return (
    <Box
      role="button"
      tabIndex={0}
      className="group"
      position="relative"
      h="full"
      cursor="pointer"
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onOpen()}
      p="4"
      borderRadius="l3"
      borderWidth="1px"
      borderColor="border"
      bg="bg.subtle"
      _hover={{ borderColor: 'ember.500' }}
      transition="border-color .15s"
    >
      <HoverTrash label="Убрать с полки" onClick={async () => (await confirmAction(`«${b.title}» уйдёт с полки насовсем.`)) && dispatch(A.deleteBook(b.id))} />
      <Flex gap="2" align="baseline" pr="6">
        {place != null && (
          <Text fontSize="sm" color="fg.subtle" flexShrink={0} title="место в очереди">
            №{place}
          </Text>
        )}
        {b.priority && b.priority !== 'medium' && (
          <Box flexShrink={0} alignSelf="center">
            <PriorityIcon p={b.priority} />
          </Box>
        )}
        <Text fontFamily="heading" fontSize="lg" fontWeight="semibold" color="ember.100" lineHeight="1.2">
          {b.title}
        </Text>
        {b.bought && (
          <Box color="ember.300" title="Куплена" flexShrink={0}>
            <LuShoppingBag />
          </Box>
        )}
      </Flex>
      {b.author && (
        <Text fontSize="sm" color="fg.muted">
          {b.author}
        </Text>
      )}
      {(dates.some(Boolean) || b.rating || b.format) && (
        <Text fontSize="xs" color="fg.subtle" mt="1">
          {[b.format && formatLabel[b.format], ...dates.filter(Boolean), b.rating ? '★'.repeat(b.rating) : ''].filter(Boolean).join(' · ')}
        </Text>
      )}
      {b.tags.length > 0 && (
        <HStack gap="1.5" wrap="wrap" mt="2">
          {b.tags.map((t) => (
            <Tag key={t} name={t} />
          ))}
        </HStack>
      )}
      <HStack gap="2" mt="3" wrap="wrap" onClick={(e) => e.stopPropagation()}>
        {step && (
          <Button size="xs" variant="outline" onClick={() => dispatch(A.upsertBook({ book: { ...b, status: step.to } }))}>
            {step.label}
          </Button>
        )}
        <Button size="xs" variant="ghost" onClick={() => dispatch(A.upsertBook({ book: { ...b, bought: !b.bought || undefined } }))}>
          {b.bought ? 'не куплена' : 'купила'}
        </Button>
        {move && (
          <HStack gap="0">
            <Button size="xs" variant="ghost" aria-label="Выше в очереди" title="выше" disabled={!move.up} onClick={() => dispatch(A.moveBookInQueue({ id: b.id, by: -1 }))}>
              <LuArrowUp />
            </Button>
            <Button size="xs" variant="ghost" aria-label="Ниже в очереди" title="ниже" disabled={!move.down} onClick={() => dispatch(A.moveBookInQueue({ id: b.id, by: 1 }))}>
              <LuArrowDown />
            </Button>
          </HStack>
        )}
        {href && (
          <Box as="a" {...{ href, target: '_blank', rel: 'noopener noreferrer' }} fontSize="xs" color="purple.200" textDecoration="underline">
            {new URL(href).hostname.replace(/^www\./, '')}
          </Box>
        )}
      </HStack>
    </Box>
  )
}

type Bought = 'yes' | 'no'

export default function Books() {
  const books = useAppSelector((s) => s.grimoire.books)
  const [tab, setTab] = useState<BookStatus>('want')
  const [f, setF] = useState<BookFilter>({})
  const set = (p: Partial<BookFilter>) => setF((x) => ({ ...x, ...p }))
  const [edit, setEdit] = useState<Draft>()
  const all = Object.values(books)
  const sort = f.sort && bookSorts(tab).some((x) => x.value === f.sort) ? f.sort : defaultBookSort(tab)
  const shelf = filterBooks(all, tab, { ...f, sort })
  const onShelf = all.filter((b) => b.status === tab)
  const tags = [...new Set(onShelf.flatMap((b) => b.tags))].sort((a, b) => a.localeCompare(b, 'ru'))
  const filtering = isFilteringBooks(f)
  // The arrows only make sense over the whole queue, in its own order.
  const queueMode = tab === 'want' && sort === 'queue' && !filtering
  const count = (s: BookStatus) => all.filter((b) => b.status === s).length
  return (
    <>
      <PageHeader title="Книжная полка">
        <Button size="sm" variant="outline" onClick={() => setEdit({ ...blankBook, status: tab })}>
          + книга
        </Button>
      </PageHeader>
      <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value as BookStatus)} variant="line" size="sm" mb="4">
        <Tabs.List>
          {statuses.map((s) => (
            <Tabs.Trigger key={s.value} value={s.value}>
              {s.label} · {count(s.value)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs.Root>
      <Stack gap="3" mb="4">
        <Flex gap="2" wrap="wrap" align="center">
          <Input size="sm" maxW={{ base: 'full', md: '280px' }} value={f.q ?? ''} onChange={(e) => set({ q: e.target.value || undefined })} placeholder="Поиск по названию и автору" />
          <Box w="210px">
            <Select size="sm" value={sort} onChange={(v) => set({ sort: v as BookSort })} options={bookSorts(tab)} />
          </Box>
          {(filtering || f.sort) && (
            <Button size="xs" variant="ghost" onClick={() => setF({})}>
              сбросить всё
            </Button>
          )}
        </Flex>
        <Flex gap="2" wrap="wrap" align="center">
          <Chips value={f.format} onChange={(v) => set({ format: v as BookFormat | undefined })} options={bookFormats} />
          <Chips value={f.bought} onChange={(v) => set({ bought: v as Bought | undefined })} options={[
            { value: 'yes', label: 'купленные' },
            { value: 'no', label: 'не купленные' },
          ]} />
        </Flex>
        {tags.length > 0 && <Chips multi value={f.tags ?? []} onChange={(v) => set({ tags: (v as string[]).length ? (v as string[]) : undefined })} options={tags.map((t) => ({ value: t, label: `#${t}` }))} />}
        {filtering && (
          <Text fontSize="xs" color="fg.subtle">
            показано {shelf.length} из {onShelf.length}
          </Text>
        )}
      </Stack>
      {shelf.length ? (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="3">
          {shelf.map((b, i) => (
            <BookCard key={b.id} b={b} onOpen={() => setEdit(b)} place={queueMode ? i + 1 : undefined} move={queueMode ? { up: i > 0, down: i < shelf.length - 1 } : undefined} />
          ))}
        </SimpleGrid>
      ) : (
        <Empty>{filtering ? 'Под этот фильтр книг нет.' : tab === 'want' ? 'Пока пусто. Добавить — «+ книга» или плюсик внизу.' : tab === 'reading' ? 'Сейчас ничего не читаешь.' : 'Прочитанных пока нет.'}</Empty>
      )}
      {edit && <BookDialog book={edit} onClose={() => setEdit(undefined)} />}
    </>
  )
}
