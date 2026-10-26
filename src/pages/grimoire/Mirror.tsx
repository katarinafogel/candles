// «Зеркало»: the journal and mood tracker in one entity — a mark, a text, or both; the evening page;
// a day feed with what was done around each entry; mood and energy over 30 days.
import { Box, Button, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { Chips, confirmAction, Empty, Field, PageHeader, Section, TextArea, TextInput } from '../../components/ui'
import { useToday } from '../../grimoire/act'
import { addDays, humanDay } from '../../grimoire/days'
import type { JournalEntry } from '../../grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'

const moodNames = ['тьма', 'тускло', 'ровно', 'светло', 'сияние']

/** A moon lit by the mood: 1 is a thin sliver, 5 the full moon. */
function Moon({ level, size = 22 }: { level: number; size?: number }) {
  // How far the shadow disc slides off the moon: the further, the more of it is lit.
  const shift = [3, 6, 9, 13, 0][level - 1] ?? 3
  const id = `m${level}`
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <defs>
        <mask id={id}>
          <rect width="20" height="20" fill="#fff" />
          {shift > 0 && <circle cx={10 - shift} cy="10" r="9" fill="#000" />}
        </mask>
      </defs>
      <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeOpacity=".35" />
      <circle cx="10" cy="10" r="9" fill="currentColor" mask={`url(#${id})`} />
    </svg>
  )
}

function Scale({ value, onChange, label, moons }: { value?: number; onChange: (v?: number) => void; label: string; moons?: boolean }) {
  return (
    <Field label={label}>
      <HStack gap="1">
        {[1, 2, 3, 4, 5].map((n) => (
          <Box
            as="button"
            key={n}
            onClick={() => onChange(value === n ? undefined : n)}
            p="1.5"
            borderRadius="l2"
            borderWidth="1px"
            borderColor={value === n ? 'ember.500' : 'border'}
            bg={value === n ? 'ember.subtle' : 'transparent'}
            color={value === n ? 'ember.200' : 'fg.muted'}
            minW="9"
            aria-pressed={value === n}
            title={moons ? moodNames[n - 1] : String(n)}
          >
            {moons ? <Moon level={n} /> : <Text fontSize="sm">{n}</Text>}
          </Box>
        ))}
      </HStack>
    </Field>
  )
}

function NewEntry({ evening, onDone }: { evening: boolean; onDone: () => void }) {
  const dispatch = useAppDispatch()
  const meta = useAppSelector((s) => s.grimoire.meta)
  const [e, setE] = useState<Partial<JournalEntry>>({})
  const set = (p: Partial<JournalEntry>) => setE({ ...e, ...p })
  const empty = !e.mood && !e.energy && !e.text?.trim() && !e.emotions?.length && !e.wentWell && !e.putOff && !e.grateful
  return (
    <Stack gap="4">
      <HStack gap="6" wrap="wrap" align="flex-start">
        <Scale label="Настроение" value={e.mood} onChange={(v) => set({ mood: v })} moons />
        <Scale label="Энергия" value={e.energy} onChange={(v) => set({ energy: v })} />
      </HStack>
      <Field label="Эмоции">
        <Chips multi value={e.emotions ?? []} onChange={(v) => set({ emotions: (v as string[]) ?? [] })} options={meta.emotions.map((x) => ({ value: x, label: x }))} />
      </Field>
      <Field label="Что влияет">
        <Chips multi value={e.factors ?? []} onChange={(v) => set({ factors: (v as string[]) ?? [] })} options={meta.factors.map((x) => ({ value: x, label: x }))} />
      </Field>
      {evening && (
        <>
          <Field label="Что получилось">
            <TextInput value={e.wentWell ?? ''} onChange={(v) => set({ wentWell: v || undefined })} />
          </Field>
          <Field label="Что отложила и почему">
            <TextInput value={e.putOff ?? ''} onChange={(v) => set({ putOff: v || undefined })} />
          </Field>
          <Field label="За что благодарна">
            <TextInput value={e.grateful ?? ''} onChange={(v) => set({ grateful: v || undefined })} />
          </Field>
        </>
      )}
      <Field label="Запись">
        <TextArea value={e.text ?? ''} onChange={(v) => set({ text: v })} rows={evening ? 3 : 5} />
      </Field>
      <Button
        alignSelf="flex-start"
        disabled={empty}
        onClick={() => {
          dispatch(A.addJournal({ entry: { ...e, text: e.text?.trim() || undefined, type: evening ? 'evening' : 'entry' } }))
          onDone()
        }}
      >
        Записать
      </Button>
    </Stack>
  )
}

/** Daily average of mood and energy over 30 days, with gaps where nothing was written. */
function Chart({ entries, today }: { entries: JournalEntry[]; today: string }) {
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29))
  const avg = (d: string, k: 'mood' | 'energy') => {
    const xs = entries.filter((e) => e.day === d && e[k]).map((e) => e[k]!)
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined
  }
  const W = 300
  const H = 80
  // Inset from the edges so the dots of the first and last day are not cut in half.
  const px = (i: number) => 4 + (i / 29) * (W - 8)
  const py = (v: number) => H - ((v - 1) / 4) * (H - 8) - 4
  const path = (k: 'mood' | 'energy') => {
    let d = ''
    let pen = false
    days.forEach((day, i) => {
      const v = avg(day, k)
      if (v == null) return void (pen = false)
      d += `${pen ? 'L' : 'M'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`
      pen = true
    })
    return d
  }
  // Dots are HTML, not SVG: the chart stretches to the width and would squash circles into ovals.
  const dots = (k: 'mood' | 'energy', color: string) =>
    days.map((day, i) => {
      const v = avg(day, k)
      return v == null ? null : (
        <Box key={k + day} position="absolute" left={`${(px(i) / W) * 100}%`} top={`${py(v)}px`} w="5px" h="5px" ml="-2.5px" mt="-2.5px" borderRadius="full" bg={color} />
      )
    })
  return (
    <Box>
      <Box position="relative" h={`${H}px`}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-label="Настроение и энергия за 30 дней">
          <path d={path('mood')} fill="none" stroke="var(--chakra-colors-ember-300)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <path d={path('energy')} fill="none" stroke="var(--chakra-colors-emerald-400)" strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
        </svg>
        {dots('energy', 'emerald.400')}
        {dots('mood', 'ember.300')}
      </Box>
      <HStack gap="4" fontSize="xs" color="fg.muted">
        <Text>
          <Text as="span" color="ember.300">
            —
          </Text>{' '}
          настроение
        </Text>
        <Text>
          <Text as="span" color="emerald.400">
            - -
          </Text>{' '}
          энергия
        </Text>
        <Text ml="auto">30 дней</Text>
      </HStack>
    </Box>
  )
}

export default function Mirror() {
  const dispatch = useAppDispatch()
  const g = useAppSelector((s) => s.grimoire)
  const today = useToday()
  const [mode, setMode] = useState<'entry' | 'evening'>()
  const [q, setQ] = useState('')
  const entries = useMemo(() => Object.values(g.journal).sort((a, b) => b.at.localeCompare(a.at)), [g.journal])
  const needle = q.trim().toLowerCase()
  const shown = entries.filter((e) => !needle || [e.text, e.wentWell, e.putOff, e.grateful, ...(e.emotions ?? []), ...(e.factors ?? [])].some((x) => x?.toLowerCase().includes(needle)))
  const byDay = new Map<string, JournalEntry[]>()
  for (const e of shown.slice(0, 120)) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e])
  const doneOn = (d: string) => Object.values(g.tasks).filter((t) => t.doneDay === d && !t.habitId)

  return (
    <>
      <PageHeader title="Зеркало">
        <Button size="sm" variant={mode === 'entry' ? 'solid' : 'outline'} onClick={() => setMode(mode === 'entry' ? undefined : 'entry')}>
          Запись
        </Button>
        <Button size="sm" variant={mode === 'evening' ? 'solid' : 'outline'} onClick={() => setMode(mode === 'evening' ? undefined : 'evening')}>
          Вечерняя страница
        </Button>
      </PageHeader>
      {mode && (
        <Section title={mode === 'evening' ? 'Вечерняя страница' : 'Новая запись'}>
          <NewEntry evening={mode === 'evening'} onDone={() => setMode(undefined)} />
        </Section>
      )}
      <Section>
        <Chart entries={entries} today={today} />
      </Section>
      <TextInput value={q} onChange={setQ} placeholder="Поиск по записям, эмоциям, факторам" />
      <Box mt="4">
        {byDay.size ? (
          [...byDay.entries()].map(([day, list]) => (
            <Box key={day} mb="5">
              <Text fontFamily="heading" fontSize="lg" color="ember.100" mb="1">
                {humanDay(day, today)}
              </Text>
              <Stack gap="2">
                {list.map((e) => {
                  const task = e.taskId ? g.tasks[e.taskId] : undefined
                  return (
                    <Box key={e.id} p="3" borderRadius="l2" borderWidth="1px" borderColor="border" bg="bg.subtle">
                      <Flex justify="space-between" gap="2" align="flex-start">
                        <HStack gap="2" color="ember.200" fontSize="sm" wrap="wrap">
                          {e.mood && <Moon level={e.mood} size={16} />}
                          {e.energy && <Text color="emerald.300">энергия {e.energy}</Text>}
                          {e.type === 'taskFeedback' && <Text color="fg.muted">как далось: {task?.title ?? 'дело'}</Text>}
                          {e.type === 'evening' && <Text color="fg.muted">вечер</Text>}
                          <Text color="fg.subtle" fontSize="xs">
                            {new Date(e.at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </HStack>
                        <Button size="2xs" variant="ghost" color="fg.subtle" onClick={() => confirmAction('Удалить запись?') && dispatch(A.deleteJournal(e.id))}>
                          ×
                        </Button>
                      </Flex>
                      {e.type === 'taskFeedback' && task && e.realStars != null && (
                        <Text fontSize="xs" color="fg.muted">
                          ожидание: ★{task.stars} ☠{task.dread} → на деле ★{e.realStars} ☠{e.realDread}
                        </Text>
                      )}
                      {[...(e.emotions ?? []), ...(e.factors ?? [])].length > 0 && (
                        <Text fontSize="xs" color="fg.muted">
                          {[...(e.emotions ?? []), ...(e.factors ?? [])].join(' · ')}
                        </Text>
                      )}
                      {e.wentWell && <Text fontSize="sm">Получилось: {e.wentWell}</Text>}
                      {e.putOff && <Text fontSize="sm">Отложила: {e.putOff}</Text>}
                      {e.grateful && <Text fontSize="sm">Благодарна: {e.grateful}</Text>}
                      {e.text && (
                        <Text fontSize="sm" whiteSpace="pre-wrap" mt="1">
                          {e.text}
                        </Text>
                      )}
                    </Box>
                  )
                })}
                {doneOn(day).length > 0 && (
                  <Text fontSize="xs" color="fg.subtle" px="1">
                    Сделано в этот день: {doneOn(day).map((t) => t.title).join(', ')}
                  </Text>
                )}
              </Stack>
            </Box>
          ))
        ) : (
          <Empty>Записей пока нет. Можно просто отметить настроение — без слов.</Empty>
        )}
      </Box>
    </>
  )
}
