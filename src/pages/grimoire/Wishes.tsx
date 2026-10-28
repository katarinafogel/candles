// «Сундук желаний» and «Зал славы»: dreams without deadlines; «Воплотить» makes a dream a deed, a quest,
// a book or a jar, and a fulfilled one moves to the hall of fame with the time it took «от мечты до яви».
import { Box, Button, Flex, HStack, Input, SimpleGrid, Stack, Tabs, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuExternalLink, LuPlus } from 'react-icons/lu'
import { Crescent, Sparkle } from '../../components/Magic'
import { Chips, confirmAction, Empty, Field, Modal, notify, NumInput, PageHeader, TextArea, TextInput } from '../../components/ui'
import { daysBetween, plural } from '../../grimoire/days'
import type { Wish } from '../../grimoire/types'
import { sabbats } from '../../grimoire/wheel'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'

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

function WishDialog({ wish, onClose }: { wish: Draft; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [w, setW] = useState<Draft>(wish)
  return (
    <Modal
      open
      onClose={onClose}
      title={w.id ? w.title : 'Новая хотелка'}
      footer={
        <>
          {w.id && (
            <Button
              variant="ghost"
              colorPalette="red"
              mr="auto"
              onClick={() => {
                if (confirmAction('Удалить хотелку насовсем? Можно вместо этого отпустить.')) {
                  dispatch(A.deleteWish(w.id!))
                  onClose()
                }
              }}
            >
              Удалить
            </Button>
          )}
          <Button
            disabled={!w.title.trim()}
            onClick={() => {
              dispatch(A.upsertWish({ wish: { tags: [], ...w, title: w.title.trim() } }))
              onClose()
            }}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <Stack gap="4">
        <Field label="Мечта">
          <TextInput value={w.title} onChange={(v) => setW({ ...w, title: v })} placeholder="съездить на Байкал" />
        </Field>
        <Field label="Описание">
          <TextArea value={w.description ?? ''} onChange={(v) => setW({ ...w, description: v || undefined })} />
        </Field>
        <Field label="Ссылка" helper="магазин, место, пост — необязательно">
          <TextInput value={w.url ?? ''} onChange={(v) => setW({ ...w, url: v.trim() || undefined })} placeholder="https://" />
        </Field>
        <Field label="Примерная стоимость" helper="необязательно">
          <NumInput value={w.price} onChange={(v) => setW({ ...w, price: v })} suffix="₽" />
        </Field>
        <Field label="Теги" helper="через запятую">
          <TextInput value={(w.tags ?? []).join(', ')} onChange={(v) => setW({ ...w, tags: v.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean) })} />
        </Field>
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
        <Button
          onClick={() => {
            if (done) dispatch(A.upsertWish({ wish: { ...w, fulfilledNote: note.trim() || undefined } }))
            else dispatch(A.fulfillWish({ id: w.id, note: note.trim() || undefined }))
            onClose()
          }}
        >
          {done ? 'Сохранить' : 'В зал славы'}
        </Button>
      }
    >
      <Field label="Пара слов" helper="как это было; можно оставить пустым">
        <TextArea value={note} onChange={setNote} rows={4} placeholder="поехала одна, и это было лучшее лето" />
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
  const go = () => {
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
    <Modal open onClose={onClose} title={`Воплотить: ${w.title}`} footer={<Button colorPalette="purple" disabled={!ok} onClick={go}>Воплотить</Button>}>
      <Stack gap="4">
        <Chips value={way} onChange={(v) => setWay((v as Way) ?? way)} options={[
          { value: 'task', label: 'в дело' },
          { value: 'quest', label: 'в квест' },
          { value: 'project', label: 'в проект' },
          { value: 'jar', label: 'в копилку' },
        ]} />
        {way === 'quest' && (
          <Field label="Шаги" helper="по одному на строку">
            <TextArea value={steps} onChange={setSteps} rows={5} placeholder={'Выбрать модель\nСравнить цены\nКупить'} />
          </Field>
        )}
        {way === 'project' && (
          <Text fontSize="sm" color="fg.muted">
            Появится книга «{w.title}» на полке — дела в неё добавишь сама.
          </Text>
        )}
        {way === 'jar' && (
          <>
            <Field label="Сколько собрать">
              <NumInput value={goal} onChange={(v) => setGoal(v && v > 0 ? v : undefined)} suffix="₽" width="180px" />
            </Field>
            <Field label="К какой дате" helper="необязательно: с датой копилка считает, сколько откладывать в неделю">
              <Input size="sm" type="date" w="170px" value={date} onChange={(e) => setDate(e.target.value)} style={{ colorScheme: 'dark' }} />
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
  const [fulfilling, setFulfilling] = useState(false)
  const [embody, setEmbody] = useState(false)
  return (
    <Box p="4" borderRadius="l3" borderWidth="1px" borderColor="purple.800" bg="bg.subtle" backgroundImage="radial-gradient(16rem 8rem at 100% 0%, rgba(147,112,170,.14), transparent 70%)">
      <Flex justify="space-between" gap="2" align="flex-start">
        <Box cursor="pointer" onClick={onEdit}>
          <HStack gap="2">
            <Box color="purple.200">
              <Sparkle size={12} />
            </Box>
            <Text fontFamily="heading" fontSize="xl" color="purple.100" fontWeight="semibold" lineHeight="1.2">
              {w.title}
            </Text>
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
          </Text>
          <WishLink url={w.url} />
        </Box>
      </Flex>
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
  const all = Object.values(g.wishes)
  const dreams = all.filter((w) => w.status === 'dream' || w.status === 'inProgress').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const fame = all.filter((w) => w.status === 'fulfilled').sort((a, b) => (b.fulfilledAt ?? '').localeCompare(a.fulfilledAt ?? ''))
  const avgDays = fame.length ? Math.round(fame.reduce((s, w) => s + daysBetween(w.createdAt.slice(0, 10), (w.fulfilledAt ?? w.createdAt).slice(0, 10)), 0) / fame.length) : 0

  return (
    <>
      <PageHeader title={tab === 'chest' ? 'Сундук желаний' : 'Зал славы'}>
        {tab === 'chest' && (
          <Button size="sm" onClick={() => setEdit({ title: '' })}>
            <LuPlus /> Хотелка
          </Button>
        )}
      </PageHeader>
      <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value as 'chest' | 'hall')} variant="line" size="sm" mb="4">
        <Tabs.List>
          <Tabs.Trigger value="chest">Сундук · {dreams.length}</Tabs.Trigger>
          <Tabs.Trigger value="hall">Зал славы · {fame.length}</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
      {tab === 'chest' ? (
        dreams.length ? (
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
            {dreams.map((w) => (
              <WishCard key={w.id} w={w} onEdit={() => setEdit(w)} />
            ))}
          </SimpleGrid>
        ) : (
          <Empty>Сундук пуст. Мечте не нужен дедлайн.</Empty>
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
                <Box key={w.id} p="4" borderRadius="l3" borderWidth="1px" borderColor="ember.700" bg="bg.subtle" backgroundImage="radial-gradient(16rem 8rem at 0% 0%, rgba(224,164,85,.14), transparent 70%)">
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
