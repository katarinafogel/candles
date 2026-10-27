// «Зеркало»: the emotion dictionary instead of a mood scale. An entry is up to three words from the
// wheel, energy, «что влияет» and a text — any of them; the evening page is an entry too. Two tabs:
// the feed (filters by petal, deed, person; energy over 30 days) and the dictionary (the wheel coloured
// by how often each word was marked).
import { Box, Button, Flex, HStack, Stack, Tabs, Text } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { EmotionPicker, EmotionWheel, WordChip } from '../../components/grimoire/EmotionWheel'
import { WordCard } from '../../components/grimoire/WordCard'
import { Chips, confirmAction, Empty, Field, Modal, PageHeader, Section, Select, TextArea, TextInput } from '../../components/ui'
import { useToday } from '../../grimoire/act'
import { addDays, dayKey, humanDay, plural } from '../../grimoire/days'
import { emotionWords, factorLabel, mirrorFactors, petalOrder, petals, wordColor, wordPetals, type Petal } from '../../grimoire/emotions'
import { navTest } from '../../grimoire/habits'
import type { JournalEntry } from '../../grimoire/types'
import { wheelNow } from '../../grimoire/wheel'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'

const energyNames = ['почти нет', 'мало', 'ровно', 'бодро', 'через край']

/** `datetime-local` wants the local time without a zone. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

/** A slider 1–5; untouched means «не отмечала». */
function EnergySlider({ value, onChange }: { value?: number; onChange: (v?: number) => void }) {
  return (
    <Field label={`Энергия${value ? `: ${energyNames[value - 1]}` : ''}`}>
      <HStack gap="3">
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={value ?? 3}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Уровень энергии"
          style={{ flex: 1, accentColor: 'var(--chakra-colors-emerald-400)', opacity: value ? 1 : 0.45 }}
        />
        {value ? (
          <Button size="2xs" variant="ghost" onClick={() => onChange(undefined)}>
            сбросить
          </Button>
        ) : (
          <Text fontSize="xs" color="fg.subtle" w="16">
            не отмечено
          </Text>
        )}
      </HStack>
    </Field>
  )
}

/** One screen, top to bottom: the wheel, energy, what affects, the text. At least one of them. */
function EntryDialog({ entry, evening, onClose }: { entry?: JournalEntry; evening?: boolean; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [e, setE] = useState<Partial<JournalEntry>>(entry ?? {})
  const [at, setAt] = useState(entry?.at ?? new Date().toISOString())
  const [info, setInfo] = useState<string>()
  const set = (p: Partial<JournalEntry>) => setE({ ...e, ...p })
  const isEvening = evening || e.type === 'evening'
  const empty = !e.words?.length && !e.energy && !e.factors?.length && !e.text?.trim() && !e.wentWell && !e.putOff && !e.grateful
  const save = () => {
    const fields = { ...e, text: e.text?.trim() || undefined }
    if (entry) dispatch(A.updateJournal({ ...fields, id: entry.id, at }))
    else dispatch(A.addJournal({ entry: { ...fields, type: isEvening ? 'evening' : 'entry', source: isEvening ? 'evening' : 'mirror' }, at }))
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={entry ? 'Запись' : isEvening ? 'Вечерняя страница' : 'Новая запись'}
      footer={
        <>
          {entry && (
            <Button
              variant="ghost"
              colorPalette="red"
              mr="auto"
              onClick={() => {
                if (confirmAction('Удалить запись?')) {
                  dispatch(A.deleteJournal(entry.id))
                  onClose()
                }
              }}
            >
              Удалить
            </Button>
          )}
          <Button disabled={empty} onClick={save}>
            Записать
          </Button>
        </>
      }
    >
      <Stack gap="5">
        <EmotionPicker value={e.words ?? []} onChange={(words) => set({ words })} onInfo={setInfo} />
        <EnergySlider value={e.energy} onChange={(energy) => set({ energy })} />
        <Field label="Что влияет">
          <Chips multi value={e.factors ?? []} onChange={(v) => set({ factors: (v as string[]) ?? [] })} options={mirrorFactors.map((f) => ({ value: f.key, label: f.label }))} />
        </Field>
        {isEvening && (
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
          <TextArea value={e.text ?? ''} onChange={(v) => set({ text: v })} rows={isEvening ? 3 : 4} />
        </Field>
        <Field label="Когда">
          <input
            type="datetime-local"
            value={toLocalInput(at)}
            max={toLocalInput(new Date().toISOString())}
            onChange={(ev) => ev.target.value && setAt(new Date(ev.target.value).toISOString())}
            style={{ background: 'transparent', color: 'inherit', border: '1px solid var(--chakra-colors-border)', borderRadius: 6, padding: '6px 8px', colorScheme: 'dark' }}
          />
        </Field>
      </Stack>
      {info && <WordCard wordKey={info} onClose={() => setInfo(undefined)} onPick={setInfo} />}
    </Modal>
  )
}

/** Daily energy over 30 days, with gaps where nothing was written; days in the навь shaded. */
function EnergyChart({ entries, today, inNav }: { entries: JournalEntry[]; today: string; inNav: (d: string) => boolean }) {
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29))
  const navDays = days.filter(inNav).length
  const avg = (d: string) => {
    const xs = entries.filter((e) => e.day === d && e.energy).map((e) => e.energy!)
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined
  }
  const W = 300
  const H = 70
  const px = (i: number) => 4 + (i / 29) * (W - 8)
  const py = (v: number) => H - ((v - 1) / 4) * (H - 8) - 4
  let d = ''
  let pen = false
  days.forEach((day, i) => {
    const v = avg(day)
    if (v == null) return void (pen = false)
    d += `${pen ? 'L' : 'M'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`
    pen = true
  })
  // Each day's words as dots under the line, in their petals' colours.
  const wordsOn = (day: string) => entries.filter((e) => e.day === day).flatMap((e) => e.words ?? []).slice(0, 4)
  return (
    <Box>
      <Box position="relative" h={`${H}px`}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" aria-label="Энергия за 30 дней">
          {days.map((day, i) => (inNav(day) ? <rect key={day} x={px(i) - W / 58} y="0" width={W / 29} height={H} fill="var(--chakra-colors-fg-subtle)" fillOpacity=".14" /> : null))}
          <path d={d} fill="none" stroke="var(--chakra-colors-emerald-400)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Dots are HTML, not SVG: the chart stretches to the width and would squash circles into ovals. */}
        {days.map((day, i) => {
          const v = avg(day)
          return v == null ? null : <Box key={day} position="absolute" left={`${(px(i) / W) * 100}%`} top={`${py(v)}px`} w="5px" h="5px" ml="-2.5px" mt="-2.5px" borderRadius="full" bg="emerald.400" />
        })}
      </Box>
      <Box position="relative" h="16px" mt="1">
        {days.map((day, i) => (
          <Flex key={day} position="absolute" left={`${(px(i) / W) * 100}%`} ml="-2px" direction="column" gap="1px">
            {wordsOn(day).map((k, j) => (
              <Box key={j} w="4px" h="4px" borderRadius="full" bg={wordColor(k)} />
            ))}
          </Flex>
        ))}
      </Box>
      <HStack gap="4" fontSize="xs" color="fg.muted">
        <Text>
          <Text as="span" color="emerald.400">
            —
          </Text>{' '}
          энергия
        </Text>
        <Text>точки — слова дня</Text>
        {navDays > 0 && (
          <Text>
            <Text as="span" display="inline-block" w="2.5" h="2.5" mr="1" verticalAlign="middle" bg="fg.subtle" opacity=".35" borderRadius="1px" />
            навь · {navDays}
          </Text>
        )}
        <Text ml="auto">30 дней</Text>
      </HStack>
    </Box>
  )
}

function EntryCard({ e, onOpen, onWord }: { e: JournalEntry; onOpen: () => void; onWord: (k: string) => void }) {
  const tasks = useAppSelector((s) => s.grimoire.tasks)
  const people = useAppSelector((s) => s.data.people)
  const task = e.taskId ? tasks[e.taskId] : undefined
  return (
    <Box p="3" borderRadius="l2" borderWidth="1px" borderColor="border" bg="bg.subtle" cursor="pointer" onClick={onOpen}>
      <HStack gap="2" fontSize="sm" wrap="wrap" mb={e.words?.length ? '1.5' : 0}>
        <Text color="fg.subtle" fontSize="xs">
          {new Date(e.at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {e.energy && <Text color="emerald.300">энергия: {energyNames[e.energy - 1]}</Text>}
        {e.type === 'taskFeedback' && <Text color="fg.muted">после дела: {task?.title ?? 'дело'}</Text>}
        {e.type === 'evening' && <Text color="fg.muted">вечер</Text>}
        {e.type === 'entry' && task && <Text color="fg.muted">дело: {task.title}</Text>}
      </HStack>
      {!!e.words?.length && (
        <Flex gap="1.5" wrap="wrap" onClick={(ev) => ev.stopPropagation()}>
          {e.words.map((k) => (
            <WordChip key={k} wordKey={k} size="xs" onClick={() => onWord(k)} />
          ))}
        </Flex>
      )}
      {e.type === 'taskFeedback' && task && e.realStars != null && (
        <Text fontSize="xs" color="fg.muted" mt="1">
          ожидание: ★{task.stars} ☠{task.dread} → на деле ★{e.realStars} ☠{e.realDread}
        </Text>
      )}
      {(!!e.factors?.length || !!e.people?.length) && (
        <Text fontSize="xs" color="fg.muted" mt="1">
          {[...(e.factors ?? []).map(factorLabel), ...(e.people ?? []).map((id) => people[id] && `@${people[id].name}`).filter(Boolean)].join(' · ')}
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
}

function Feed({ entries, onOpen, onWord }: { entries: JournalEntry[]; onOpen: (e: JournalEntry) => void; onWord: (k: string) => void }) {
  const g = useAppSelector((s) => s.grimoire)
  const people = useAppSelector((s) => s.data.people)
  const today = useToday()
  const [petal, setPetal] = useState<Petal>()
  const [taskId, setTaskId] = useState('')
  const [person, setPerson] = useState('')
  const [q, setQ] = useState('')
  const inNav = useMemo(() => navTest(g.meta, (iso) => dayKey(new Date(iso), g.meta.dayBoundaryHour)), [g.meta])
  // Only deeds and people that some entry is tied to can be filtered by.
  const taskIds = [...new Set(entries.map((e) => e.taskId).filter((x): x is string => !!x && !!g.tasks[x]))]
  const personIds = [...new Set(entries.flatMap((e) => e.people ?? []).filter((x) => people[x]))]
  const needle = q.trim().toLowerCase()
  const shown = entries.filter(
    (e) =>
      (!petal || (e.words ?? []).some((k) => wordPetals(k).includes(petal))) &&
      (!taskId || e.taskId === taskId) &&
      (!person || e.people?.includes(person)) &&
      (!needle || [e.text, e.wentWell, e.putOff, e.grateful, e.trigger, ...(e.words ?? []).map((k) => emotionWords[k]?.word), ...(e.factors ?? []).map(factorLabel)].some((x) => x?.toLowerCase().includes(needle))),
  )
  const byDay = new Map<string, JournalEntry[]>()
  for (const e of shown.slice(0, 150)) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e])
  const doneOn = (d: string) => Object.values(g.tasks).filter((t) => t.doneDay === d && !t.habitId)

  return (
    <>
      <Section>
        <EnergyChart entries={entries} today={today} inNav={inNav} />
      </Section>
      <Stack gap="2" mb="4">
        <Flex gap="1.5" wrap="wrap">
          <Button size="xs" variant={petal ? 'ghost' : 'outline'} borderRadius="full" onClick={() => setPetal(undefined)}>
            все
          </Button>
          {petalOrder.map((p) => (
            <Button key={p} size="xs" variant={petal === p ? 'solid' : 'ghost'} borderRadius="full" onClick={() => setPetal(petal === p ? undefined : p)}>
              <Box w="8px" h="8px" borderRadius="full" bg={petals[p].color} />
              {petals[p].name}
            </Button>
          ))}
        </Flex>
        <Flex gap="2" wrap="wrap">
          <Box flex="1" minW="200px">
            <TextInput value={q} onChange={setQ} placeholder="Поиск по записям и словам" />
          </Box>
          {taskIds.length > 0 && (
            <Box minW="180px">
              <Select size="md" value={taskId} onChange={setTaskId} placeholder="все дела" options={taskIds.map((id) => ({ value: id, label: g.tasks[id].title }))} />
            </Box>
          )}
          {personIds.length > 0 && (
            <Box minW="160px">
              <Select size="md" value={person} onChange={setPerson} placeholder="все люди" options={personIds.map((id) => ({ value: id, label: people[id].name }))} />
            </Box>
          )}
        </Flex>
      </Stack>
      {byDay.size ? (
        [...byDay.entries()].map(([day, list]) => (
          <Box key={day} mb="5">
            <Text fontFamily="heading" fontSize="lg" color="ember.100" mb="1">
              {humanDay(day, today)}
            </Text>
            <Stack gap="2">
              {list.map((e) => (
                <EntryCard key={e.id} e={e} onOpen={() => onOpen(e)} onWord={onWord} />
              ))}
              {doneOn(day).length > 0 && (
                <Text fontSize="xs" color="fg.subtle" px="1">
                  Сделано в этот день: {doneOn(day).map((t) => t.title).join(', ')}
                </Text>
              )}
            </Stack>
          </Box>
        ))
      ) : (
        <Empty>{entries.length ? 'Под этот фильтр записей нет.' : 'Записей пока нет. Можно просто отметить одно слово — два касания.'}</Empty>
      )}
    </>
  )
}

type Period = 'week' | 'month' | 'segment'

/** The wheel coloured by how often each word was marked; words never marked stay dim, no reproach. */
function Dictionary({ entries, onWord }: { entries: JournalEntry[]; onWord: (k: string) => void }) {
  const today = useToday()
  const hemisphere = useAppSelector((s) => s.grimoire.meta.hemisphere)
  const [period, setPeriod] = useState<Period>('month')
  const now = wheelNow(today, hemisphere)
  const from = period === 'week' ? addDays(today, -6) : period === 'month' ? addDays(today, -29) : now.current.day
  const counts = new Map<string, number>()
  for (const e of entries) if (e.day >= from && e.day <= today) for (const k of e.words ?? []) counts.set(k, (counts.get(k) ?? 0) + 1)
  const max = Math.max(1, ...counts.values())
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  const all = Object.values(emotionWords)
  const used = all.filter((w) => counts.has(w.key)).sort((a, b) => counts.get(b.key)! - counts.get(a.key)!)
  const unused = all.filter((w) => !counts.has(w.key))
  return (
    <>
      <Flex gap="2" wrap="wrap" align="center" mb="3">
        <Chips value={period} onChange={(v) => setPeriod((v as Period) ?? period)} options={[
          { value: 'week', label: 'неделя' },
          { value: 'month', label: 'месяц' },
          { value: 'segment', label: 'отрезок колеса' },
        ]} />
        <Text fontSize="sm" color="fg.muted">
          {total ? `${plural(total, 'отметка', 'отметки', 'отметок')}, ${plural(counts.size, 'слово', 'слова', 'слов')}` : 'за этот период отметок нет'}
        </Text>
      </Flex>
      <Section>
        <EmotionWheel onWord={onWord} tint={(k) => (counts.get(k) ?? 0) / max} />
        <Text fontSize="xs" color="fg.subtle" textAlign="center" mt="2">
          Ярче — чаще. Нажми на слово, чтобы прочитать о нём.
        </Text>
      </Section>
      {used.length > 0 && (
        <Flex gap="1.5" wrap="wrap" mb="3">
          {used.map((w) => (
            <HStack key={w.key} gap="1">
              <WordChip wordKey={w.key} onClick={() => onWord(w.key)} />
              <Text fontSize="xs" color="fg.muted">
                ×{counts.get(w.key)}
              </Text>
            </HStack>
          ))}
        </Flex>
      )}
      <Flex gap="1.5" wrap="wrap" opacity=".5">
        {unused.map((w) => (
          <WordChip key={w.key} wordKey={w.key} size="xs" onClick={() => onWord(w.key)} />
        ))}
      </Flex>
    </>
  )
}

export default function Mirror() {
  const journal = useAppSelector((s) => s.grimoire.journal)
  const [tab, setTab] = useState<'feed' | 'dictionary'>('feed')
  const [dialog, setDialog] = useState<{ entry?: JournalEntry; evening?: boolean }>()
  const [info, setInfo] = useState<string>()
  const entries = useMemo(() => Object.values(journal).sort((a, b) => b.at.localeCompare(a.at)), [journal])

  return (
    <>
      <PageHeader title="Зеркало">
        <Button size="sm" onClick={() => setDialog({})}>
          Новая запись
        </Button>
        <Button size="sm" variant="outline" onClick={() => setDialog({ evening: true })}>
          Вечерняя страница
        </Button>
      </PageHeader>
      <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value as 'feed' | 'dictionary')} variant="line" size="sm" mb="4">
        <Tabs.List>
          <Tabs.Trigger value="feed">Записи</Tabs.Trigger>
          <Tabs.Trigger value="dictionary">Словарь эмоций</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
      {tab === 'feed' ? <Feed entries={entries} onOpen={(entry) => setDialog({ entry })} onWord={setInfo} /> : <Dictionary entries={entries} onWord={setInfo} />}
      {dialog && <EntryDialog key={dialog.entry?.id ?? String(dialog.evening)} entry={dialog.entry} evening={dialog.evening} onClose={() => setDialog(undefined)} />}
      {info && <WordCard wordKey={info} onClose={() => setInfo(undefined)} onPick={setInfo} />}
    </>
  )
}
