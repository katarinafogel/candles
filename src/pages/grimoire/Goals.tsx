// «Цели на год»: a calendar year's goals, each tied to what moves it — books, wishes, jars, rituals.
// Its progress is read from them: books read, wishes come true, jars collected; rituals just show
// how they go. Yule offers to sum up the year and set the next one's goals.
import { Box, Button, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { useAttempt } from '../../components/grimoire/RoundBlocks'
import { Chips, confirmAction, Empty, Field, Modal, PageHeader, Section, TextArea, TextInput } from '../../components/ui'
import { useToday } from '../../grimoire/act'
import type { Goal, GrimoireState } from '../../grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'

type Draft = Partial<Goal> & { title: string; year: number }

const statusLabel: Record<Goal['status'], string> = { active: 'в пути', done: 'достигнута', dropped: 'отпущена' }

/** Share of the tied things that are done: books read, wishes come true, jars collected or spent. */
export function goalProgress(g: GrimoireState, goal: Goal) {
  const parts = [
    ...(goal.projectIds ?? []).map((id) => g.projects[id]?.status === 'done'),
    ...(goal.wishIds ?? []).map((id) => g.wishes[id]?.status === 'fulfilled'),
    ...(goal.jarIds ?? []).map((id) => ['collected', 'spent'].includes(g.jars[id]?.status ?? '')),
  ]
  return parts.length ? { done: parts.filter(Boolean).length, all: parts.length } : undefined
}

function LinkPicker({ label, value, options, onChange }: { label: string; value: string[]; options: { value: string; label: string }[]; onChange: (v: string[]) => void }) {
  if (!options.length) return null
  return (
    <Field label={label}>
      <Chips multi value={value} onChange={(v) => onChange((v as string[]) ?? [])} options={options} />
    </Field>
  )
}

export function GoalDialog({ goal, onClose }: { goal: Draft; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const g = useAppSelector((s) => s.grimoire)
  const [x, setX] = useState<Draft>(goal)
  const set = (p: Partial<Draft>) => setX((v) => ({ ...v, ...p }))
  const check = useAttempt()
  const save = () =>
    check.attempt(!!x.title.trim(), () => {
      dispatch(A.upsertGoal({ goal: { status: 'active', ...x } }))
      onClose()
    })
  const nonEmpty = (ids: string[]) => (ids.length ? ids : undefined)
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={x.id ? x.title : `Цель на ${x.year}`}
      footer={
        <>
          {x.id && (
            <Button
              variant="ghost"
              colorPalette="red"
              mr="auto"
              onClick={async () => {
                if (await confirmAction('Удалить цель? Книги, желания и копилки останутся.')) {
                  dispatch(A.deleteGoal(x.id!))
                  onClose()
                }
              }}
            >
              Удалить
            </Button>
          )}
          <Button onClick={save}>Сохранить</Button>
        </>
      }
    >
      <Stack gap="4">
        <Field label="Цель" invalid={check.missing(!x.title.trim())} error="Назови цель">
          <TextInput value={x.title} onChange={(title) => set({ title })} />
        </Field>
        <Field label="Зачем и как пойму, что достигла">
          <TextArea value={x.description ?? ''} onChange={(description) => set({ description: description || undefined })} rows={3} />
        </Field>
        <HStack gap="3" wrap="wrap">
          <Field label="Год" w="120px">
            <Chips value={String(x.year)} onChange={(v) => v && set({ year: Number(v) })} options={[x.year - 1, x.year, x.year + 1].map((y) => ({ value: String(y), label: String(y) }))} />
          </Field>
          {x.id && (
            <Field label="Состояние">
              <Chips value={x.status ?? 'active'} onChange={(v) => v && set({ status: v as Goal['status'] })} options={(Object.keys(statusLabel) as Goal['status'][]).map((s) => ({ value: s, label: statusLabel[s] }))} />
            </Field>
          )}
        </HStack>
        <Text fontSize="sm" color="fg.muted">
          Что ведёт к цели:
        </Text>
        <LinkPicker
          label="Книги"
          value={x.projectIds ?? []}
          onChange={(v) => set({ projectIds: nonEmpty(v) })}
          options={Object.values(g.projects)
            .filter((p) => p.status !== 'archived' || x.projectIds?.includes(p.id))
            .map((p) => ({ value: p.id, label: `${p.sigil ?? '🌿'} ${p.title}` }))}
        />
        <LinkPicker
          label="Желания"
          value={x.wishIds ?? []}
          onChange={(v) => set({ wishIds: nonEmpty(v) })}
          options={Object.values(g.wishes)
            .filter((w) => w.status !== 'released' || x.wishIds?.includes(w.id))
            .map((w) => ({ value: w.id, label: w.title }))}
        />
        <LinkPicker
          label="Копилки"
          value={x.jarIds ?? []}
          onChange={(v) => set({ jarIds: nonEmpty(v) })}
          options={Object.values(g.jars)
            .filter((j) => j.status !== 'closed' || x.jarIds?.includes(j.id))
            .map((j) => ({ value: j.id, label: j.title }))}
        />
        <LinkPicker
          label="Ритуалы"
          value={x.habitIds ?? []}
          onChange={(v) => set({ habitIds: nonEmpty(v) })}
          options={Object.values(g.habits)
            .filter((h) => h.status !== 'archived' || x.habitIds?.includes(h.id))
            .map((h) => ({ value: h.id, label: h.title }))}
        />
      </Stack>
    </Modal>
  )
}

function GoalCard({ goal, onOpen }: { goal: Goal; onOpen: () => void }) {
  const g = useAppSelector((s) => s.grimoire)
  const p = goalProgress(g, goal)
  const ties = [
    ...(goal.projectIds ?? []).map((id) => g.projects[id] && `${g.projects[id].sigil ?? '🌿'} ${g.projects[id].title}`),
    ...(goal.wishIds ?? []).map((id) => g.wishes[id]?.title),
    ...(goal.jarIds ?? []).map((id) => g.jars[id] && `🫙 ${g.jars[id].title}`),
    ...(goal.habitIds ?? []).map((id) => g.habits[id] && `🌙 ${g.habits[id].title}`),
  ].filter(Boolean)
  return (
    <Box as="button" textAlign="left" w="full" p="4" borderRadius="l3" borderWidth="1px" borderColor={goal.status === 'done' ? 'ember.700' : 'border'} bg="bg.subtle" opacity={goal.status === 'dropped' ? 0.6 : 1} _hover={{ bg: 'bg.muted' }} onClick={onOpen}>
      <Flex justify="space-between" gap="2" align="baseline" wrap="wrap">
        <Text fontFamily="heading" fontSize="xl" fontWeight="semibold">
          {goal.title}
        </Text>
        <Text fontSize="xs" color={goal.status === 'done' ? 'ember.200' : 'fg.muted'}>
          {statusLabel[goal.status]}
        </Text>
      </Flex>
      {goal.description && (
        <Text fontSize="sm" color="fg.muted" mt="1" lineClamp={2}>
          {goal.description}
        </Text>
      )}
      {p && (
        <HStack gap="2" mt="2">
          <Box flex="1" h="4px" borderRadius="full" bg="bg.muted" overflow="hidden">
            <Box h="100%" w={`${(p.done / p.all) * 100}%`} bg="ember.400" borderRadius="full" />
          </Box>
          <Text fontSize="xs" color="fg.muted">
            {p.done}/{p.all}
          </Text>
        </HStack>
      )}
      {ties.length > 0 && (
        <Text fontSize="xs" color="fg.subtle" mt="2">
          {ties.join(' · ')}
        </Text>
      )}
    </Box>
  )
}

export default function Goals() {
  const goals = useAppSelector((s) => s.grimoire.goals)
  const today = useToday()
  const thisYear = Number(today.slice(0, 4))
  // From December the next year's page opens by default: goals are set around Yule.
  const [year, setYear] = useState(today.slice(5, 7) === '12' ? thisYear + 1 : thisYear)
  const [edit, setEdit] = useState<Draft>()
  const years = [...new Set([thisYear, thisYear + 1, ...Object.values(goals).map((x) => x.year)])].sort()
  const list = Object.values(goals)
    .filter((x) => x.year === year)
    .sort((a, b) => Number(a.status !== 'active') - Number(b.status !== 'active') || a.createdAt.localeCompare(b.createdAt))
  return (
    <>
      <PageHeader title="Цели на год">
        <Button size="sm" onClick={() => setEdit({ title: '', year })}>
          Цель на {year}
        </Button>
      </PageHeader>
      <Box mb="4">
        <Chips value={String(year)} onChange={(v) => v && setYear(Number(v))} options={years.map((y) => ({ value: String(y), label: String(y) }))} />
      </Box>
      <Section>
        {list.length ? (
          <Stack gap="3">
            {list.map((x) => (
              <GoalCard key={x.id} goal={x} onOpen={() => setEdit(x)} />
            ))}
          </Stack>
        ) : (
          <Empty>Целей на {year} пока нет. Цель — то, к чему ведут книги, желания, копилки и ритуалы.</Empty>
        )}
      </Section>
      {edit && <GoalDialog goal={edit} onClose={() => setEdit(undefined)} />}
    </>
  )
}
