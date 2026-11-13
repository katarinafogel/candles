// «Копилки»: goals in real money with a log of what went in and out. The app only counts — it never
// touches the money. A jar fills like a glass and is «собрана» when full.
import { Box, Button, Flex, HStack, IconButton, Input, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuBookOpen, LuCalendarClock, LuHash, LuPlus, LuStar, LuTrash2, LuUser } from 'react-icons/lu'
import { BlockSpot, useAttempt, useRoundBlocks, type RoundBlock } from '../../components/grimoire/RoundBlocks'
import { TagInput } from '../../components/grimoire/TagInput'
import { PeoplePicker } from '../../components/grimoire/TaskFields'
import { Chips, confirmAction, DateInput, DeleteButton, Empty, Field, Modal, notify, NumInput, PageHeader, Select, TextInput } from '@shared/components/ui'
import { useToday } from '../../grimoire/act'
import { humanDay } from '@grimoire-core/grimoire/days'
import { jarPlan, money } from '@grimoire-core/grimoire/jars'
import type { Jar } from '@grimoire-core/grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '@grimoire-core/store/grimoireSlice'

const statusLabel: Record<Jar['status'], string> = { saving: 'копим', collected: 'собрана', spent: 'потрачена', closed: 'закрыта' }

/** A glass that fills by the share collected; the liquid rises and turns gold when full. */
function JarGlass({ pct }: { pct: number }) {
  const h = 70 * (pct / 100)
  return (
    <svg viewBox="0 0 60 90" width="54" height="81" aria-label={`собрано ${Math.round(pct)}%`}>
      <defs>
        <clipPath id="jar-inside">
          <path d="M14 22h32c3 0 5 2 5 5v52c0 4-3 7-7 7H16c-4 0-7-3-7-7V27c0-3 2-5 5-5z" />
        </clipPath>
      </defs>
      <rect x="18" y="8" width="24" height="10" rx="2" fill="var(--chakra-colors-ember-700)" />
      <rect x="15" y="16" width="30" height="6" rx="2" fill="var(--chakra-colors-ember-800)" />
      <g clipPath="url(#jar-inside)">
        <rect x="0" y={86 - h} width="60" height={h} fill={pct >= 100 ? 'var(--chakra-colors-ember-400)' : 'var(--chakra-colors-ember-500)'} opacity=".85" style={{ transition: 'y .6s, height .6s' }} />
      </g>
      <path d="M14 22h32c3 0 5 2 5 5v52c0 4-3 7-7 7H16c-4 0-7-3-7-7V27c0-3 2-5 5-5z" fill="none" stroke="var(--g-ink)" strokeWidth="1.5" />
      <path d="M15 30v40" stroke="var(--g-ink-faint)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

type Draft = Partial<Jar> & { title: string; goal: number }

type JarBlock = 'wish' | 'date' | 'project' | 'tags' | 'people'
const jarBlocks: RoundBlock<JarBlock>[] = [
  { key: 'wish', label: 'Хотелка', icon: <LuStar /> },
  { key: 'date', label: 'К какой дате', icon: <LuCalendarClock /> },
  { key: 'project', label: 'Проект', icon: <LuBookOpen /> },
  { key: 'tags', label: 'Теги', icon: <LuHash /> },
  { key: 'people', label: 'Люди', icon: <LuUser /> },
]
const clearJar: Record<JarBlock, Partial<Jar>> = {
  wish: { wishId: undefined },
  date: { targetDate: undefined },
  project: { projectId: undefined },
  tags: { tags: undefined },
  people: { personIds: undefined },
}

export const blankJar: Draft = { title: '', goal: 0, currency: '₽' }

export function JarDialog({ jar, onClose }: { jar: Draft; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const g = useAppSelector((s) => s.grimoire)
  const [j, setJ] = useState<Draft>(jar)
  const set = (p: Partial<Draft>) => setJ((x) => ({ ...x, ...p }))
  const wishes = Object.values(g.wishes).filter((w) => w.status !== 'fulfilled' && w.status !== 'released')
  const projects = Object.values(g.projects).filter((p) => p.status !== 'archived')
  const filled: JarBlock[] = []
  if (jar.wishId) filled.push('wish')
  if (jar.targetDate) filled.push('date')
  if (jar.projectId) filled.push('project')
  if (jar.tags?.length) filled.push('tags')
  if (jar.personIds?.length) filled.push('people')
  const blocks = useRoundBlocks(jarBlocks, filled, (k) => set(clearJar[k]))
  const check = useAttempt()
  const save = () =>
    check.attempt(!!j.title.trim() && j.goal > 0, () => {
      dispatch(A.upsertJar({ jar: { ...j, title: j.title.trim(), currency: j.currency || '₽' } }))
      onClose()
    })
  // A wish with a price fills an empty goal.
  const pickWish = (id: string) => {
    const w = g.wishes[id]
    set({ wishId: id || undefined, ...(w?.price && !j.goal ? { goal: w.price } : {}) })
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={j.id ? j.title : 'Новая копилка'}
      footer={
        <Stack gap="3" w="full">
          {blocks.toolbar}
          <HStack gap="2" justify="flex-end">
            {j.id && (
              <DeleteButton confirm="Удалить копилку вместе с журналом? Деньги приложение не трогает — это только учёт." onDelete={() => {
                dispatch(A.deleteJar(j.id!))
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
        <Field label="На что" invalid={check.missing(!j.title.trim())} error="Назови копилку">
          <TextInput value={j.title} onChange={(v) => set({ title: v })} />
        </Field>
        <Field label="Цель" helper="сколько хочешь накопить" invalid={check.missing(!(j.goal > 0))} error="Сколько хочешь накопить?">
          <NumInput integer value={j.goal || undefined} onChange={(v) => set({ goal: Math.max(0, v ?? 0) })} placeholder="10 000" suffix={j.currency || '₽'} width="200px" />
        </Field>
        {blocks.show('wish') && (
          <BlockSpot active={blocks.opened === 'wish'}>
            <Field label="Для хотелки" helper="когда копилка потрачена, хотелка сбывается">
              <Select value={j.wishId ?? ''} onChange={pickWish} placeholder="ни для какой" options={wishes.map((w) => ({ value: w.id, label: w.title }))} />
            </Field>
          </BlockSpot>
        )}
        {blocks.show('date') && (
          <BlockSpot active={blocks.opened === 'date'}>
            <Field label="К какой дате" helper="с датой гримуар считает, сколько откладывать в неделю">
              <DateInput w="190px" value={j.targetDate ?? ''} onChange={(v) => set({ targetDate: v || undefined })} />
            </Field>
          </BlockSpot>
        )}
        {blocks.show('project') && (
          <BlockSpot active={blocks.opened === 'project'}>
            <Field label="Для проекта">
              <Select value={j.projectId ?? ''} onChange={(v) => set({ projectId: v || undefined })} placeholder="ни для какого" options={projects.map((p) => ({ value: p.id, label: p.title }))} />
            </Field>
          </BlockSpot>
        )}
        {blocks.show('tags') && (
          <BlockSpot active={blocks.opened === 'tags'}>
            <Field label="Теги" helper="Enter или запятая добавляет, тап по тегу убирает">
              <TagInput value={j.tags ?? []} onChange={(tags) => set({ tags: tags.length ? tags : undefined })} />
            </Field>
          </BlockSpot>
        )}
        {blocks.show('people') && (
          <BlockSpot active={blocks.opened === 'people'}>
            <Field label="Люди">
              <PeoplePicker value={j.personIds ?? []} onChange={(ids) => set({ personIds: ids.length ? ids : undefined })} />
            </Field>
          </BlockSpot>
        )}
      </Stack>
    </Modal>
  )
}

function MoneyDialog({ jar, sign, onClose }: { jar: Jar; sign: 1 | -1; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [sum, setSum] = useState<number>()
  const [note, setNote] = useState('')
  const check = useAttempt()
  return (
    <Modal
      open
      onClose={onClose}
      title={sign > 0 ? `Положить в «${jar.title}»` : `Взять из «${jar.title}»`}
      footer={
        <Button
          onClick={() =>
            check.attempt(!!sum, () => {
              dispatch(A.addJarTx({ jarId: jar.id, amount: sign * sum!, note }))
              onClose()
            })
          }
        >
          {sign > 0 ? 'Положила' : 'Взяла'}
        </Button>
      }
    >
      <Stack gap="4">
        <Field label="Сколько" invalid={check.missing(!sum)} error="Впиши сумму">
          <NumInput integer value={sum} onChange={(v) => setSum(v && v > 0 ? v : undefined)} placeholder="1 000" suffix={jar.currency} width="200px" />
        </Field>
        <Field label="Комментарий">
          <TextInput value={note} onChange={setNote} />
        </Field>
      </Stack>
    </Modal>
  )
}

/** «Отложить 1000 ₽»: a ritual whose tick puts its sum into this jar. */
function HabitForJar({ jar, onClose }: { jar: Jar; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [sum, setSum] = useState<number | undefined>(1000)
  const [kind, setKind] = useState<'week' | 'day'>('week')
  return (
    <Modal
      open
      onClose={onClose}
      title="Ритуал пополнения"
      footer={
        <Button
          disabled={!sum}
          onClick={() => {
            dispatch(
              A.upsertHabit({
                habit: {
                  title: `Отложить ${money(sum!, jar.currency)} в «${jar.title}»`,
                  schedule: kind === 'week' ? { kind: 'timesPerWeek', n: 1 } : { kind: 'daily' },
                  mark: { kind: 'check' },
                  stars: 1,
                  dread: 0,
                  status: 'active',
                  jarId: jar.id,
                  jarAmount: sum,
                },
              }),
            )
            notify('Ритуал заведён: отметка сама кладёт деньги в копилку', 'success')
            onClose()
          }}
        >
          Завести
        </Button>
      }
    >
      <Stack gap="4">
        <Field label="Сколько откладывать">
          <NumInput integer value={sum} onChange={(v) => setSum(v && v > 0 ? v : undefined)} suffix={jar.currency} width="180px" />
        </Field>
        <Field label="Как часто">
          <Chips value={kind} onChange={(v) => setKind((v as 'week' | 'day') ?? 'week')} options={[
            { value: 'week', label: 'раз в неделю' },
            { value: 'day', label: 'каждый день' },
          ]} />
        </Field>
      </Stack>
    </Modal>
  )
}

function JarCard({ j, onEdit }: { j: Jar; onEdit: () => void }) {
  const dispatch = useAppDispatch()
  const txs = useAppSelector((s) => s.grimoire.jarTxs)
  const wish = useAppSelector((s) => (j.wishId ? s.grimoire.wishes[j.wishId] : undefined))
  const habits = useAppSelector((s) => Object.values(s.grimoire.habits).filter((h) => h.jarId === j.id && h.status === 'active').length)
  const today = useToday()
  const [money_, setMoney] = useState<1 | -1>()
  const [habit, setHabit] = useState(false)
  const [log, setLog] = useState(false)
  const all = Object.values(txs)
  const plan = jarPlan(j, all, today)
  const mine = all.filter((x) => x.jarId === j.id).sort((a, b) => b.at.localeCompare(a.at))
  const active = j.status === 'saving' || j.status === 'collected'
  return (
    <Box p="4" borderRadius="l3" borderWidth="1px" borderColor={j.status === 'collected' ? 'ember.600' : 'border'} bg="bg.subtle">
      <Flex gap="4">
        <JarGlass pct={plan.pct} />
        <Box flex="1" minW="0">
          <Flex justify="space-between" gap="2" align="baseline">
            <Text fontFamily="heading" fontSize="xl" fontWeight="semibold" color="ember.50" cursor="pointer" onClick={onEdit}>
              {j.title}
            </Text>
            <Text fontSize="xs" color={j.status === 'collected' ? 'ember.200' : 'fg.subtle'}>
              {statusLabel[j.status]}
            </Text>
          </Flex>
          <Text fontSize="lg">
            {money(plan.balance, j.currency)}{' '}
            <Text as="span" fontSize="sm" color="fg.muted">
              из {money(j.goal, j.currency)} · {Math.round(plan.pct)}%
            </Text>
          </Text>
          {active && (
            <Text fontSize="sm" color="fg.muted">
              {plan.text}
              {j.targetDate ? ` · срок ${humanDay(j.targetDate, today)}` : ''}
            </Text>
          )}
          {wish && (
            <Text fontSize="xs" color="purple.200" mt="1">
              для хотелки «{wish.title}»
            </Text>
          )}
          {habits > 0 && (
            <Text fontSize="xs" color="fg.subtle">
              пополняет ритуал
            </Text>
          )}
        </Box>
      </Flex>
      <HStack gap="2" mt="3" wrap="wrap">
        {active && (
          <>
            <Button size="xs" onClick={() => setMoney(1)}>
              <LuPlus /> Положить
            </Button>
            <Button size="xs" variant="outline" onClick={() => setMoney(-1)}>
              Взять
            </Button>
          </>
        )}
        {j.status === 'collected' && (
          <Button size="xs" colorPalette="purple" onClick={() => dispatch(A.setJarStatus({ id: j.id, status: 'spent' }))}>
            Потратила{wish ? ' — мечта сбылась' : ''}
          </Button>
        )}
        {active && !habits && (
          <Button size="xs" variant="ghost" onClick={() => setHabit(true)}>
            Ритуал «отложить»
          </Button>
        )}
        <Button size="xs" variant="ghost" onClick={() => setLog(!log)}>
          журнал · {mine.length}
        </Button>
        {active ? (
          <Button size="xs" variant="ghost" color="fg.subtle" onClick={async () => (await confirmAction('Закрыть копилку? Журнал останется.')) && dispatch(A.setJarStatus({ id: j.id, status: 'closed' }))}>
            закрыть
          </Button>
        ) : (
          <Button size="xs" variant="ghost" color="fg.subtle" onClick={() => dispatch(A.setJarStatus({ id: j.id, status: 'saving' }))}>
            вернуть
          </Button>
        )}
      </HStack>
      {log && (
        <Stack gap="1" mt="3" fontSize="sm">
          {mine.length ? (
            mine.map((x) => (
              <HStack key={x.id} gap="2">
                <Text color="fg.subtle" fontSize="xs" w="70px">
                  {new Date(x.at).toLocaleDateString('ru')}
                </Text>
                <Text color={x.amount > 0 ? 'emerald.300' : 'orange.300'} w="100px">
                  {x.amount > 0 ? '+' : '−'}
                  {money(Math.abs(x.amount), j.currency)}
                </Text>
                <Text flex="1" color="fg.muted" lineClamp={1}>
                  {x.note}
                </Text>
                {!x.habitLogId && (
                  <IconButton size="2xs" variant="ghost" aria-label="Удалить" onClick={async () => (await confirmAction('Удалить запись журнала?')) && dispatch(A.deleteJarTx(x.id))}>
                    <LuTrash2 />
                  </IconButton>
                )}
              </HStack>
            ))
          ) : (
            <Text color="fg.subtle">Пока пусто.</Text>
          )}
        </Stack>
      )}
      {money_ && <MoneyDialog jar={j} sign={money_} onClose={() => setMoney(undefined)} />}
      {habit && <HabitForJar jar={j} onClose={() => setHabit(false)} />}
    </Box>
  )
}

export default function Jars() {
  const jars = useAppSelector((s) => s.grimoire.jars)
  const [edit, setEdit] = useState<Draft>()
  const [shelf, setShelf] = useState<'open' | 'done'>('open')
  const all = Object.values(jars).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  const open = all.filter((j) => j.status === 'saving' || j.status === 'collected')
  const done = all.filter((j) => j.status === 'spent' || j.status === 'closed')
  const shown = shelf === 'open' ? open : done
  return (
    <>
      <PageHeader title="Копилки" />
      <Text fontSize="sm" color="fg.muted" mb="3">
        Настоящие деньги: гримуар их только считает.
      </Text>
      {done.length > 0 && (
        <Box mb="3">
          <Chips value={shelf} onChange={(v) => setShelf((v as 'open' | 'done') ?? 'open')} options={[
            { value: 'open', label: `копим · ${open.length}` },
            { value: 'done', label: `потрачены и закрыты · ${done.length}` },
          ]} />
        </Box>
      )}
      {shown.length ? (
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
          {shown.map((j) => (
            <JarCard key={j.id} j={j} onEdit={() => setEdit(j as Draft)} />
          ))}
        </SimpleGrid>
      ) : (
        <Empty>{shelf === 'open' ? 'Копилок пока нет. Новую — через плюсик внизу, или воплоти хотелку в копилку прямо из сундука желаний.' : 'Пока ничего.'}</Empty>
      )}
      {edit && <JarDialog jar={edit} onClose={() => setEdit(undefined)} />}
    </>
  )
}
