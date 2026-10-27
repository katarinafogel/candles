// The book of deeds: every task with filters by state, tags, zone and deadline.
import { Box, Button, Flex, HStack, Input, SimpleGrid, Stack, Tabs, Text } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QuickAdd } from '../../components/grimoire/QuickAdd'
import { useTaskDialog } from '../../components/grimoire/TaskDialog'
import { cardColumns, TaskCard } from '../../components/grimoire/TaskCard'
import { Chips, Empty, PageHeader, Section, Select } from '../../components/ui'
import { SpellsDialog } from '../../components/grimoire/Spells'
import { useToday } from '../../grimoire/act'
import { allTags, backlog, isBlocked, isOpenTask, isStuck, isWaiting, words } from '../../grimoire/selectors'
import type { Task } from '../../grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'

type View = 'backlog' | 'planned' | 'waiting' | 'stuck' | 'done' | 'all'
type Sort = 'due' | 'created' | 'dread' | 'stars'

const views: { value: View; label: string }[] = [
  { value: 'backlog', label: 'Бэклог' },
  { value: 'planned', label: 'В плане' },
  { value: 'waiting', label: 'Ждут' },
  { value: 'stuck', label: 'Буксуют' },
  { value: 'done', label: 'Сделано' },
  { value: 'all', label: 'Все' },
]

const sorters: Record<Sort, (a: Task, b: Task) => number> = {
  due: (a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') || (a.doOn ?? '9999').localeCompare(b.doOn ?? '9999'),
  created: (a, b) => b.createdAt.localeCompare(a.createdAt),
  dread: (a, b) => b.dread - a.dread || b.stars - a.stars,
  stars: (a, b) => b.stars - a.stars || b.dread - a.dread,
}

export default function Book() {
  const dispatch = useAppDispatch()
  const g = useAppSelector((s) => s.grimoire)
  const today = useToday()
  const { open, dialog } = useTaskDialog()
  const [params, setParams] = useSearchParams()
  const view = (params.get('v') as View) || 'backlog'
  const [q, setQ] = useState('')
  const [spells, setSpells] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [zone, setZone] = useState<string>()
  const [sort, setSort] = useState<Sort>('due')
  const w = words(g.meta)

  const list = useMemo(() => {
    const all = Object.values(g.tasks).filter((t) => !t.habitId)
    let xs: Task[]
    switch (view) {
      case 'backlog':
        xs = backlog(g, today)
        break
      case 'planned':
        xs = all.filter((t) => t.doOn && isOpenTask(t))
        break
      case 'waiting':
        xs = all.filter((t) => isOpenTask(t) && (isWaiting(t, today) || isBlocked(t, g.tasks)))
        break
      case 'stuck':
        xs = all.filter(isStuck)
        break
      case 'done':
        xs = all.filter((t) => t.status === 'done').sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
        break
      default:
        xs = all
    }
    const needle = q.trim().toLowerCase()
    xs = xs.filter(
      (t) =>
        (!needle || t.title.toLowerCase().includes(needle) || (t.note ?? '').toLowerCase().includes(needle)) &&
        tags.every((x) => t.tags.includes(x)) &&
        (!zone || t.zone === zone),
    )
    // Done deeds go to the end of the list; the chosen order holds inside each part.
    return view === 'done' ? xs : [...xs].sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || sorters[sort](a, b))
  }, [g, view, q, tags, zone, sort, today])

  // «Чистый лист» leftovers stand apart at the top of the backlog until planned or unpacked.
  const packed = view === 'backlog' ? list.filter((t) => t.later) : []
  const rest = view === 'backlog' ? list.filter((t) => !t.later) : list
  const tagList = allTags(g)
  return (
    <>
      <PageHeader title={w.book}>
        <Button size="sm" variant="outline" onClick={() => setSpells(true)}>
          {w.spells}
        </Button>
      </PageHeader>
      {spells && <SpellsDialog onClose={() => setSpells(false)} />}
      <Section>
        <QuickAdd />
      </Section>
      <Tabs.Root value={view} onValueChange={(e) => setParams(e.value === 'backlog' ? {} : { v: e.value }, { replace: true })} variant="line" size="sm" mb="3">
        <Tabs.List overflowX="auto" overflowY="hidden">
          {views.map((v) => (
            <Tabs.Trigger key={v.value} value={v.value} whiteSpace="nowrap">
              {v.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs.Root>
      <Stack gap="3" mb="3">
        <HStack gap="2" wrap="wrap">
          <Input flex="1" minW="180px" size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск" />
          {view !== 'done' && (
            <Box w="170px">
              <Select size="sm" value={sort} onChange={(v) => setSort((v as Sort) || 'due')} options={[
                { value: 'due', label: 'по сроку' },
                { value: 'created', label: 'сначала новые' },
                { value: 'dread', label: 'самые противные' },
                { value: 'stars', label: 'самые сложные' },
              ]} />
            </Box>
          )}
        </HStack>
        {tagList.length > 0 && <Chips multi value={tags} onChange={(v) => setTags((v as string[]) ?? [])} options={tagList.map((t) => ({ value: t, label: `#${t}` }))} />}
        {g.meta.zones.length > 0 && (
          <Flex align="center" gap="2" wrap="wrap">
            <Text fontSize="xs" color="fg.muted">
              одно место:
            </Text>
            <Chips value={zone} onChange={(v) => setZone(v as string | undefined)} options={g.meta.zones.map((z) => ({ value: z, label: z }))} />
          </Flex>
        )}
      </Stack>
      {packed.length > 0 && (
        <Box mb="5" p="3" borderRadius="l3" borderWidth="1px" borderStyle="dashed" borderColor="border.emphasized">
          <Flex align="center" justify="space-between" gap="2" mb="3" wrap="wrap">
            <Text fontFamily="heading" fontSize="lg" color="ember.100">
              Разобрать потом · {packed.length}
            </Text>
            <Button size="xs" variant="ghost" onClick={() => dispatch(A.unpackLater(packed.map((t) => t.id)))}>
              Распаковать
            </Button>
          </Flex>
          <SimpleGrid gridTemplateColumns={cardColumns} gap={{ base: '3', md: '4' }}>
            {packed.map((t) => (
              <TaskCard key={t.id} t={t} today={today} onOpen={open} />
            ))}
          </SimpleGrid>
        </Box>
      )}
      {rest.length ? (
        <SimpleGrid gridTemplateColumns={cardColumns} gap={{ base: '3', md: '4' }}>
          {rest.map((t) => (
            <TaskCard key={t.id} t={t} today={today} onOpen={open} />
          ))}
        </SimpleGrid>
      ) : packed.length ? null : (
        <Empty>{view === 'backlog' ? 'Бэклог пуст — и это нормально.' : view === 'stuck' ? 'Ничего не буксует.' : 'Здесь пусто.'}</Empty>
      )}
      {dialog}
    </>
  )
}
