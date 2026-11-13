// «Сундук желаний» and «Зал славы»: dreams without deadlines; «Воплотить» makes a dream a deed, a quest,
// a book or a jar, and a fulfilled one moves to the hall of fame with the time it took «от мечты до яви».
import { Box, Button, Flex, HStack, Input, SimpleGrid, Stack, Tabs, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuCoins, LuExternalLink, LuFlag, LuHash, LuHourglass, LuLink, LuUser } from 'react-icons/lu'
import { PriorityIcon, Tag } from '../../components/grimoire/Marks'
import { BlockSpot, useAttempt, useRoundBlocks, type RoundBlock } from '../../components/grimoire/RoundBlocks'
import { TagInput } from '../../components/grimoire/TagInput'
import { PeoplePicker, PriorityPicker } from '../../components/grimoire/TaskFields'
import { HoverTrash } from '../../components/grimoire/HoverTrash'
import { Crescent, Sparkle } from '@shared/components/Magic'
import { Chips, confirmAction, DateInput, DeleteButton, Empty, Field, Modal, notify, NumInput, PageHeader, TextArea, TextInput } from '@shared/components/ui'
import { useToday } from '../../grimoire/act'
import { addDays, daysBetween, plural } from '@grimoire-core/grimoire/days'
import { priorities } from '@grimoire-core/grimoire/selectors'
import type { Wish } from '@grimoire-core/grimoire/types'
import { sabbats } from '@grimoire-core/grimoire/wheel'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '@grimoire-core/store/grimoireSlice'

/** «1 год 2 месяца 5 дней»; empty within the same day. */
export function span(fromIso: string, toIso: string) {
  const a = new Date(fromIso)
  const b = new Date(toIso)
  let y = b.getFullYear() - a.getFullYear()
  let m = b.getMonth() - a.getMonth()
  let d = b.getDate() - a.getDate()
  if (d < 0) {
    m--
    d += new Date(b.getFullYear(), b.getMonth(), 0).getDate()
  }
  if (m < 0) {
    y--
    m += 12
  }
  const parts = [y && plural(y, 'год', 'года', 'лет'), m && plural(m, 'месяц', 'месяца', 'месяцев'), d && plural(d, 'день', 'дня', 'дней')].filter(Boolean)
  return parts.join(' ')
}

type Draft = Partial<Wish> & { title: string }

type WishBlock = 'url' | 'price' | 'tags' | 'people' | 'until' | 'priority'
const wishBlocks: RoundBlock<WishBlock>[] = [
  { key: 'url', label: 'Ссылка', icon: <LuLink /> },
  { key: 'price', label: 'Стоимость', icon: <LuCoins /> },
  { key: 'tags', label: 'Теги', icon: <LuHash /> },
  { key: 'people', label: 'Люди', icon: <LuUser /> },
  { key: 'until', label: 'Актуально до', icon: <LuHourglass /> },
  { key: 'priority', label: 'Приоритет', icon: <LuFlag /> },
]
const clearWish: Record<WishBlock, Partial<Wish>> = {
  url: { url: undefined },
  price: { price: undefined },
  tags: { tags: [] },
  people: { personIds: undefined },
  until: { relevantUntil: undefined },
  priority: { priority: undefined },
}

export function WishDialog({ wish, onClose }: { wish: Draft; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [w, setW] = useState<Draft>(wish)
  const set = (p: Partial<Wish>) => setW((x) => ({ ...x, ...p }))
  const filled: WishBlock[] = []
  if (wish.url) filled.push('url')
  if (wish.price) filled.push('price')
  if (wish.tags?.length) filled.push('tags')
  if (wish.personIds?.length) filled.push('people')
  if (wish.relevantUntil) filled.push('until')
  if (wish.priority) filled.push('priority')
  const blocks = useRoundBlocks(wishBlocks, filled, (k) => set(clearWish[k]))
  const check = useAttempt()
  const save = () =>
    check.attempt(!!w.title.trim(), () => {
      dispatch(A.upsertWish({ wish: { tags: [], ...w, title: w.title.trim() } }))
      onClose()
    })
  return (
    <Modal
      open
      onClose={onClose}
      title={w.id ? w.title : 'Новая хотелка'}
      footer={
        <Stack gap="3" w="full">
          {blocks.toolbar}
          <HStack gap="2" justify="flex-end">
            {w.id && (
              <DeleteButton confirm="Удалить хотелку насовсем? Можно вместо этого отпустить." onDelete={() => {
                dispatch(A.deleteWish(w.id!))
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
        <Field label="Мечта" invalid={check.missing(!w.title.trim())} error="Назови мечту">
          <TextInput value={w.title} onChange={(v) => set({ title: v })} />
        </Field>
        <Field label="Описание">
          <TextArea value={w.description ?? ''} onChange={(v) => set({ description: v || undefined })} />
        </Field>
        {blocks.show('url') && (
          <BlockSpot active={blocks.opened === 'url'}>
            <Field label="Ссылка" helper="магазин, место, пост">
              <TextInput value={w.url ?? ''} onChange={(v) => set({ url: v.trim() || undefined })} placeholder="https://" />
            </Field>
          </BlockSpot>
        )}
        {blocks.show('price') && (
          <BlockSpot active={blocks.opened === 'price'}>
            <Field label="Примерная стоимость">
              <NumInput integer value={w.price} onChange={(v) => set({ price: v || undefined })} placeholder="10 000" suffix="₽" width="200px" />
            </Field>
          </BlockSpot>
        )}
        {blocks.show('tags') && (
          <BlockSpot active={blocks.opened === 'tags'}>
            <Field label="Теги" helper="Enter или запятая добавляет, тап по тегу убирает">
              <TagInput value={w.tags ?? []} onChange={(tags) => set({ tags })} />
            </Field>
          </BlockSpot>
        )}
        {blocks.show('people') && (
          <BlockSpot active={blocks.opened === 'people'}>
            <Field label="Люди" helper="с кем или для кого">
              <PeoplePicker value={w.personIds ?? []} onChange={(ids) => set({ personIds: ids.length ? ids : undefined })} />
            </Field>
          </BlockSpot>
        )}
        {blocks.show('until') && (
          <BlockSpot active={blocks.opened === 'until'}>
            <Field label="Актуально до" helper="после этой даты сундук спросит, хочется ли ещё">
              <DateInput w="190px" value={w.relevantUntil ?? ''} onChange={(v) => set({ relevantUntil: v || undefined })} />
            </Field>
          </BlockSpot>
        )}
        {blocks.show('priority') && (
          <BlockSpot active={blocks.opened === 'priority'}>
            <Field label="Приоритет">
              <PriorityPicker value={w.priority ?? 'medium'} onChange={(priority) => set({ priority })} />
            </Field>
          </BlockSpot>
        )}
      </Stack>
    </Modal>
  )
}

/** A link only when it is one: «ozon.ru/…» gets its https, anything else stays text in the dialog. */
export function wishHref(url?: string) {
  if (!url) return undefined
  const u = /^https?:\/\//i.test(url) ? url : `https://${url}`
  try {
    return new URL(u).protocol.startsWith('http') ? u : undefined
  } catch {
    return undefined
  }
}

function WishLink({ url }: { url?: string }) {
  const href = wishHref(url)
  if (!href) return null
  return (
    <Box as="a" {...{ href, target: '_blank', rel: 'noopener noreferrer' }} display="inline-flex" alignItems="center" gap="1" fontSize="xs" color="purple.200" textDecoration="underline" mt="1" onClick={(e) => e.stopPropagation()}>
      <LuExternalLink /> {new URL(href).hostname.replace(/^www\./, '')}
    </Box>
  )
}

/** «Сбылась»: a few words to keep with it in the hall of fame (or later, for one the deed fulfilled). */
function FulfillDialog({ w, onClose }: { w: Wish; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const done = w.status === 'fulfilled'
  const [note, setNote] = useState(w.fulfilledNote ?? '')
  return (
    <Modal
      open
      onClose={onClose}
      title={done ? w.title : `Сбылась: ${w.title}`}
      footer={
        <>
          {done && (
            <DeleteButton confirm="Убрать мечту из зала славы насовсем?" onDelete={() => {
              dispatch(A.deleteWish(w.id))
              onClose()
            }}
            />
          )}
          <Button
          onClick={() => {
            if (done) dispatch(A.upsertWish({ wish: { ...w, fulfilledNote: note.trim() || undefined } }))
            else dispatch(A.fulfillWish({ id: w.id, note: note.trim() || undefined }))
            onClose()
          }}
        >
          {done ? 'Сохранить' : 'В зал славы'}
          </Button>
        </>
      }
    >
      <Field label="Пара слов" helper="как это было; можно оставить пустым">
        <TextArea value={note} onChange={setNote} rows={4} />
      </Field>
    </Modal>
  )
}

type Way = 'task' | 'quest' | 'project' | 'jar'

/**
 * «Воплотить»: a dream becomes a deed, a quest with steps, a book of deeds or a jar. It comes true by
 * itself — when the deed or quest is done, the book is read, or the jar is collected and spent.
 */
function EmbodyDialog({ w, onClose }: { w: Wish; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [way, setWay] = useState<Way>(w.price ? 'jar' : 'task')
  const [steps, setSteps] = useState('')
  const [goal, setGoal] = useState<number | undefined>(w.price)
  const [date, setDate] = useState('')
  const lines = steps.split('\n').map((x) => x.trim()).filter(Boolean)
  const ok = way === 'quest' ? lines.length > 0 : way === 'jar' ? !!goal : true
  const check = useAttempt()
  const go = () => check.attempt(ok, make)
  const make = () => {
    if (way === 'task' || way === 'quest') {
      dispatch(A.wishToTask({ wishId: w.id, steps: way === 'quest' ? lines : undefined }))
      notify(way === 'quest' ? 'Стала квестом: он в бэклоге' : 'Стала делом: оно в бэклоге', 'success', 'Когда сделаешь, мечта уйдёт в зал славы')
    } else if (way === 'project') {
      dispatch(A.wishToProject({ wishId: w.id }))
      notify('Стала проектом: книга на полке «Великих деяний»', 'success', 'Мечта сбудется, когда книга будет прочитана')
    } else {
      dispatch(A.wishToJar({ wishId: w.id, goal: goal!, targetDate: date || undefined }))
      notify('Заведена копилка', 'success', 'Мечта сбудется, когда копилка будет собрана и потрачена')
    }
    onClose()
  }
  return (
    <Modal open onClose={onClose} title={`Воплотить: ${w.title}`} footer={<Button colorPalette="purple" onClick={go}>Воплотить</Button>}>
      <Stack gap="4">
        <Chips value={way} onChange={(v) => setWay((v as Way) ?? way)} options={[
          { value: 'task', label: 'в дело' },
          { value: 'quest', label: 'в квест' },
          { value: 'project', label: 'в проект' },
          { value: 'jar', label: 'в копилку' },
        ]} />
        {way === 'quest' && (
          <Field label="Шаги" helper="по одному на строку" invalid={check.missing(!lines.length)} error="Запиши хотя бы один шаг">
            <TextArea value={steps} onChange={setSteps} rows={5} />
          </Field>
        )}
        {way === 'project' && (
          <Text fontSize="sm" color="fg.muted">
            Появится книга «{w.title}» на полке — дела в неё добавишь сама.
          </Text>
        )}
        {way === 'jar' && (
          <>
            <Field label="Сколько собрать" invalid={check.missing(!goal)} error="Сколько хочешь накопить?">
              <NumInput integer value={goal} onChange={(v) => setGoal(v && v > 0 ? v : undefined)} placeholder="10 000" suffix="₽" width="200px" />
            </Field>
            <Field label="К какой дате" helper="необязательно: с датой копилка считает, сколько откладывать в неделю">
              <DateInput size="sm" w="170px" value={date} onChange={setDate} />
            </Field>
          </>
        )}
      </Stack>
    </Modal>
  )
}

function WishCard({ w, onEdit }: { w: Wish; onEdit: () => void }) {
  const dispatch = useAppDispatch()
  const task = useAppSelector((s) => (w.taskId ? s.grimoire.tasks[w.taskId] : undefined))
  const project = useAppSelector((s) => (w.projectId ? s.grimoire.projects[w.projectId] : undefined))
  const jar = useAppSelector((s) => (w.jarId ? s.grimoire.jars[w.jarId] : undefined))
  const people = useAppSelector((s) => s.grimoire.beings)
  const today = useToday()
  const [fulfilling, setFulfilling] = useState(false)
  const [embody, setEmbody] = useState(false)
  const left = w.relevantUntil ? daysBetween(today, w.relevantUntil) : undefined
  return (
    <Box p="4" borderRadius="l3" borderWidth="1px" borderColor="emerald.800" bg="bg.subtle" backgroundImage="radial-gradient(16rem 8rem at 100% 0%, color-mix(in srgb, var(--chakra-colors-emerald-400) 14%, transparent), transparent 70%)">
      <Flex justify="space-between" gap="2" align="flex-start">
        <Box cursor="pointer" onClick={onEdit}>
          <HStack gap="2">
            <Box color="purple.200">
              <Sparkle size={12} />
            </Box>
            <Text fontFamily="heading" fontSize="xl" color="purple.100" fontWeight="semibold" lineHeight="1.2">
              {w.title}
            </Text>
            {w.priority && w.priority !== 'medium' && <PriorityIcon p={w.priority} />}
          </HStack>
          {w.description && (
            <Text fontSize="sm" color="fg.muted" mt="1">
              {w.description}
            </Text>
          )}
          <Text fontSize="xs" color="fg.subtle" mt="1">
            {w.price ? `≈ ${w.price.toLocaleString('ru')} ₽ · ` : ''}
            {w.sabbat ? `к ${sabbats[w.sabbat].dative} · ` : ''}
            {`мечтаю ${span(w.createdAt, new Date().toISOString()) || 'с сегодняшнего дня'}`}
            {w.personIds?.length ? ` · ${w.personIds.map((id) => people[id]?.name ?? '?').join(', ')}` : ''}
          </Text>
          {left != null && left >= 0 && left <= 7 && (
            <Text fontSize="xs" color="orange.300" mt="1">
              актуально ещё {plural(left, 'день', 'дня', 'дней')}
            </Text>
          )}
          {w.tags.length > 0 && (
            <HStack gap="1.5" wrap="wrap" mt="2">
              {w.tags.map((t) => (
                <Tag key={t} name={t} />
              ))}
            </HStack>
          )}
          <WishLink url={w.url} />
        </Box>
      </Flex>
      {left != null && left < 0 && (
        <HStack gap="2" mt="3" p="2" borderRadius="l2" bg="bg.muted" wrap="wrap">
          <Text fontSize="sm" flex="1" minW="140px">
            Срок «актуально до» прошёл. Ещё хочется?
          </Text>
          <Button size="xs" variant="outline" onClick={() => dispatch(A.upsertWish({ wish: { ...w, relevantUntil: addDays(today, 30) } }))}>
            Да, ещё на месяц
          </Button>
          <Button size="xs" variant="ghost" onClick={() => dispatch(A.releaseWish(w.id))}>
            Отпустить
          </Button>
        </HStack>
      )}
      <HStack gap="2" mt="3" wrap="wrap">
        {w.status === 'dream' && (
          <Button size="xs" colorPalette="purple" onClick={() => setEmbody(true)}>
            Воплотить
          </Button>
        )}
        {w.status === 'inProgress' && (
          <Text fontSize="xs" color="purple.200">
            {jar ? `в копилке: ${jar.title}` : project ? `в проекте: ${project.title}` : `в деле${task ? `: ${task.title}` : ''}`}
          </Text>
        )}
        <Button size="xs" variant="outline" onClick={() => setFulfilling(true)}>
          Сбылась
        </Button>
        <Button size="xs" variant="ghost" onClick={() => dispatch(A.releaseWish(w.id))}>
          Отпустить
        </Button>
      </HStack>
      {fulfilling && <FulfillDialog w={w} onClose={() => setFulfilling(false)} />}
      {embody && <EmbodyDialog w={w} onClose={() => setEmbody(false)} />}
    </Box>
  )
}

export default function Wishes() {
  const g = useAppSelector((s) => s.grimoire)
  const [tab, setTab] = useState<'chest' | 'hall'>('chest')
  const [edit, setEdit] = useState<Draft>()
  const [words, setWords] = useState<Wish>()
  const dispatch = useAppDispatch()
  const all = Object.values(g.wishes)
  const [tag, setTag] = useState<string>()
  const open = all.filter((w) => w.status === 'dream' || w.status === 'inProgress')
  const chestTags = [...new Set(open.flatMap((w) => w.tags))].sort((a, b) => a.localeCompare(b, 'ru'))
  const rank = (w: Wish) => priorities.indexOf(w.priority ?? 'medium')
  const dreams = open.filter((w) => !tag || w.tags.includes(tag)).sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt))
  const fame = all.filter((w) => w.status === 'fulfilled').sort((a, b) => (b.fulfilledAt ?? '').localeCompare(a.fulfilledAt ?? ''))
  const avgDays = fame.length ? Math.round(fame.reduce((s, w) => s + daysBetween(w.createdAt.slice(0, 10), (w.fulfilledAt ?? w.createdAt).slice(0, 10)), 0) / fame.length) : 0

  return (
    <>
      <PageHeader title={tab === 'chest' ? 'Сундук желаний' : 'Зал славы'} />
      <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value as 'chest' | 'hall')} variant="line" size="sm" mb="4">
        <Tabs.List>
          <Tabs.Trigger value="chest">Сундук · {dreams.length}</Tabs.Trigger>
          <Tabs.Trigger value="hall">Зал славы · {fame.length}</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
      {tab === 'chest' && chestTags.length > 0 && (
        <Box mb="3">
          <Chips value={tag} onChange={(v) => setTag((v as string) ?? undefined)} options={chestTags.map((t) => ({ value: t, label: `#${t}` }))} />
        </Box>
      )}
      {tab === 'chest' ? (
        dreams.length ? (
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
            {dreams.map((w) => (
              <WishCard key={w.id} w={w} onEdit={() => setEdit(w)} />
            ))}
          </SimpleGrid>
        ) : (
          <Empty>{tag ? `С тегом «${tag}» мечтаний нет.` : 'Сундук пуст. Мечте не нужен дедлайн. Добавить — через плюсик внизу.'}</Empty>
        )
      ) : (
        <>
          {fame.length > 0 && (
            <Text fontSize="sm" color="fg.muted" mb="3">
              Исполнено мечтаний: {fame.length} · в среднем {plural(avgDays, 'день', 'дня', 'дней')} от мечты до яви
            </Text>
          )}
          {fame.length ? (
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
              {fame.map((w) => (
                <Box key={w.id} className="group" position="relative" p="4" borderRadius="l3" borderWidth="1px" borderColor="ember.700" bg="bg.subtle" backgroundImage="radial-gradient(16rem 8rem at 0% 0%, color-mix(in srgb, var(--chakra-colors-ember-400) 14%, transparent), transparent 70%)">
                  <HoverTrash label="Убрать из зала славы" onClick={async () => (await confirmAction(`«${w.title}» уйдёт из зала славы насовсем. Связанные дела и копилки останутся.`)) && dispatch(A.deleteWish(w.id))} />
                  <HStack gap="2" color="ember.200">
                    <Crescent size={14} />
                    <Text fontFamily="heading" fontSize="xl" fontWeight="semibold">
                      {w.title}
                    </Text>
                  </HStack>
                  <Text fontSize="xs" color="fg.muted" mt="1">
                    {new Date(w.createdAt).toLocaleDateString('ru')} → {w.fulfilledAt ? new Date(w.fulfilledAt).toLocaleDateString('ru') : '—'} · {w.fulfilledAt ? span(w.createdAt, w.fulfilledAt) || 'в тот же день' : ''}
                  </Text>
                  {w.fulfilledNote ? (
                    <Text fontSize="sm" mt="2" cursor="pointer" onClick={() => setWords(w)}>
                      {w.fulfilledNote}
                    </Text>
                  ) : (
                    <Button size="xs" variant="ghost" mt="2" onClick={() => setWords(w)}>
                      Пара слов
                    </Button>
                  )}
                  <WishLink url={w.url} />
                </Box>
              ))}
            </SimpleGrid>
          ) : (
            <Empty>Здесь будут сбывшиеся мечты.</Empty>
          )}
        </>
      )}
      {edit && <WishDialog wish={edit} onClose={() => setEdit(undefined)} />}
      {words && <FulfillDialog w={words} onClose={() => setWords(undefined)} />}

    </>
  )
}
