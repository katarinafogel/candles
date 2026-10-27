// A mirror entry on its own page, not in a dialog: the wheel is big and the «+» details are many.
// Top to bottom on a phone, wheel left and fields right on a wide screen. Routes: /g/mirror/new,
// /g/mirror/evening, /g/mirror/:id; `?task=` ties a new entry to a deed, `?source=` says where from.
import { Box, Button, Flex, Grid, HStack, Input, Stack, Text } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { LuPlus, LuX } from 'react-icons/lu'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { EmotionPicker, WordChip } from '../../components/grimoire/EmotionWheel'
import { WordCard } from '../../components/grimoire/WordCard'
import { Chips, confirmAction, Field, PageHeader, Section, TextArea, TextInput } from '../../components/ui'
import { useToday } from '../../grimoire/act'
import { bodyZones, emotionActions, emotionWords, mirrorFactors, wordColor } from '../../grimoire/emotions'
import { isOpenTask } from '../../grimoire/selectors'
import type { JournalEntry } from '../../grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'

export const energyNames = ['почти нет', 'мало', 'ровно', 'бодро', 'через край']

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

/** A schematic figure: tap a zone to mark where the feeling sits. */
function BodyMap({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const on = (k: string) => value.includes(k)
  const flip = (k: string) => onChange(on(k) ? value.filter((x) => x !== k) : [...value, k])
  const zone = (k: string) => ({
    role: 'button',
    'aria-label': bodyZones.find((z) => z.key === k)!.label,
    'aria-pressed': on(k),
    tabIndex: 0,
    onClick: () => flip(k),
    onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && flip(k),
    fill: on(k) ? 'var(--chakra-colors-ember-300)' : 'rgba(246,230,200,.08)',
    stroke: on(k) ? '#fff6dc' : 'rgba(246,230,200,.45)',
    strokeWidth: 1.5,
    style: { cursor: 'pointer', outline: 'none' },
  })
  return (
    <HStack gap="4" align="center">
      <svg viewBox="0 0 120 220" width="96" height="176" aria-label="Где в теле">
        <circle cx="60" cy="24" r="18" {...zone('head')} />
        <rect x="52" y="43" width="16" height="12" rx="4" {...zone('throat')} />
        <path d="M34 58h52l-4 44H38z" {...zone('chest')} />
        <path d="M38 104h44l-2 40H40z" {...zone('belly')} />
        <path d="M30 60l-16 66 10 3 16-60zM90 60l16 66-10 3-16-60z" {...zone('arms')} />
        <path d="M42 147h16l-3 68H43zM62 147h16l-1 68H65z" {...zone('legs')} />
      </svg>
      <Flex gap="1.5" wrap="wrap" flex="1">
        {bodyZones.map((z) => (
          <Button key={z.key} size="xs" variant={on(z.key) ? 'solid' : 'outline'} borderRadius="full" onClick={() => flip(z.key)}>
            {z.label}
          </Button>
        ))}
      </Flex>
    </HStack>
  )
}

/** A searched list with the chosen ones as chips: deeds of today and the backlog, or workshop people. */
function PickList({ chosen, options, multi, placeholder, onChange }: { chosen: string[]; options: { id: string; label: string }[]; multi?: boolean; placeholder: string; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase().replace(/^@/, '')
  const found = needle ? options.filter((o) => !chosen.includes(o.id) && o.label.toLowerCase().includes(needle)).slice(0, 6) : []
  const label = (id: string) => options.find((o) => o.id === id)?.label ?? '…'
  return (
    <Stack gap="2">
      {chosen.length > 0 && (
        <Flex gap="1.5" wrap="wrap">
          {chosen.map((id) => (
            <Button key={id} size="xs" variant="subtle" borderRadius="full" onClick={() => onChange(chosen.filter((x) => x !== id))}>
              {label(id)} <LuX />
            </Button>
          ))}
        </Flex>
      )}
      {(multi || !chosen.length) && <Input size="sm" w="full" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />}
      {found.length > 0 && (
        <Flex gap="1.5" wrap="wrap">
          {found.map((o) => (
            <Button
              key={o.id}
              size="xs"
              variant="outline"
              onClick={() => {
                onChange(multi ? [...chosen, o.id] : [o.id])
                setQ('')
              }}
            >
              {o.label}
            </Button>
          ))}
        </Flex>
      )}
    </Stack>
  )
}

/** The evening's strip: every word of the day as a dot along the hours, in its petal's colour. */
function DayStrip({ entries }: { entries: JournalEntry[] }) {
  const marks = entries.flatMap((e) => (e.words ?? []).map((k) => ({ k, at: new Date(e.at) }))).sort((a, b) => +a.at - +b.at)
  if (!marks.length)
    return (
      <Text fontSize="sm" color="fg.subtle">
        Сегодня слов в зеркале ещё не было.
      </Text>
    )
  // From 6:00 to the next 2:00 — the owl's evening still fits.
  const pos = (d: Date) => {
    const h = (d.getHours() + d.getMinutes() / 60 - 6 + 24) % 24
    return Math.min(100, Math.max(0, (h / 20) * 100))
  }
  // Words written together would hide each other: each dot steps right of the one before if too close.
  let last = -10
  const left = marks.map((m) => (last = Math.max(pos(m.at), last + 3.5)))
  return (
    <Box>
      <Box position="relative" h="22px" borderRadius="full" bg="bg.muted">
        {marks.map((m, i) => (
          <Box key={i} position="absolute" top="50%" left={`${Math.min(98, left[i])}%`} w="12px" h="12px" ml="-6px" mt="-6px" borderRadius="full" bg={wordColor(m.k)} borderWidth="1px" borderColor="rgba(20,16,12,.8)" title={`${m.at.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })} · ${emotionWords[m.k].word}`} />
        ))}
      </Box>
      <Flex justify="space-between" fontSize="2xs" color="fg.subtle" mt="1">
        <Text>6:00</Text>
        <Text>12:00</Text>
        <Text>18:00</Text>
        <Text>2:00</Text>
      </Flex>
    </Box>
  )
}

export default function MirrorEntry() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const g = useAppSelector((s) => s.grimoire)
  const people = useAppSelector((s) => s.data.people)
  const today = useToday()
  const entry = id && id !== 'new' && id !== 'evening' ? g.journal[id] : undefined
  const evening = id === 'evening' || entry?.type === 'evening'
  const source = params.get('source') as JournalEntry['source'] | null
  const [e, setE] = useState<Partial<JournalEntry>>(
    () => entry ?? { taskId: params.get('task') ?? undefined, words: params.get('word') ? [params.get('word')!] : undefined },
  )
  const [at, setAt] = useState(entry?.at ?? new Date().toISOString())
  const [info, setInfo] = useState<string>()
  const [more, setMore] = useState(!!(entry?.bodyZones?.length || entry?.trigger || entry?.action || entry?.taskId || entry?.people?.length || params.get('task')))
  const set = (p: Partial<JournalEntry>) => setE({ ...e, ...p })
  const location = useLocation()
  // Back where she came from (a deed, the scroll); opened by a link — to the mirror.
  const back = () => (location.key !== 'default' ? navigate(-1) : navigate('/g/mirror'))

  const taskOptions = useMemo(
    () =>
      Object.values(g.tasks)
        .filter((t) => !t.habitId && ((isOpenTask(t) && (!t.doOn || t.doOn <= today)) || t.doneDay === today || t.id === e.taskId))
        .map((t) => ({ id: t.id, label: t.title })),
    [g.tasks, today, e.taskId],
  )
  const personOptions = Object.values(people).map((p) => ({ id: p.id, label: p.name }))
  const todays = Object.values(g.journal)
    .filter((x) => x.day === today && x.id !== entry?.id)
    .sort((a, b) => a.at.localeCompare(b.at))
  const todaysWords = [...new Set(todays.flatMap((x) => x.words ?? []))]

  if (id && !entry && id !== 'new' && id !== 'evening')
    return (
      <>
        <PageHeader title="Запись" back="/g/mirror" />
        <Text color="fg.muted">Такой записи нет — может, её удалили.</Text>
      </>
    )

  const empty = !e.words?.length && !e.energy && !e.factors?.length && !e.text?.trim() && !e.wentWell && !e.putOff && !e.grateful && !e.trigger?.trim() && !e.bodyZones?.length
  const save = () => {
    const fields = { ...e, text: e.text?.trim() || undefined, trigger: e.trigger?.trim() || undefined }
    if (entry) dispatch(A.updateJournal({ ...fields, id: entry.id, at }))
    else {
      const type = evening ? 'evening' : source === 'task_done' ? 'taskFeedback' : 'entry'
      dispatch(A.addJournal({ entry: { ...fields, type, source: evening ? 'evening' : source ?? 'mirror' }, at }))
    }
    back()
  }

  const details = (
    <Stack gap="4" p="3" borderRadius="l2" borderWidth="1px" borderColor="border" bg="bg.subtle">
      <Field label="Где в теле">
        <BodyMap value={e.bodyZones ?? []} onChange={(bodyZones) => set({ bodyZones: bodyZones.length ? bodyZones : undefined })} />
      </Field>
      <Field label="Что случилось">
        <TextInput value={e.trigger ?? ''} onChange={(v) => set({ trigger: v || undefined })} placeholder="одной строкой" />
      </Field>
      <Field label="Связанное дело">
        <PickList chosen={e.taskId ? [e.taskId] : []} options={taskOptions} placeholder="найти дело на сегодня или в бэклоге" onChange={(v) => set({ taskId: v[0] })} />
      </Field>
      <Field label="С кем">
        <PickList multi chosen={e.people ?? []} options={personOptions} placeholder="@имя" onChange={(v) => set({ people: v.length ? v : undefined })} />
      </Field>
      <Field label="Что с этим сделаю">
        <Chips value={e.action} onChange={(v) => set({ action: (v as string) ?? undefined })} options={emotionActions.map((a) => ({ value: a.key, label: a.label }))} />
      </Field>
    </Stack>
  )

  return (
    <>
      <PageHeader title={entry ? 'Запись' : evening ? 'Вечерняя страница' : 'Новая запись'} back="/g/mirror" />
      <Grid templateColumns={{ base: '1fr', lg: 'minmax(0, 1.1fr) minmax(0, 1fr)' }} gap={{ base: '5', lg: '8' }} alignItems="start">
        <Stack gap="4">
          {evening && (
            <Section title="Эмоции дня">
              <DayStrip entries={todays} />
            </Section>
          )}
          {evening && (
            <Text fontFamily="heading" fontSize="lg" color="ember.100">
              Какое чувство было главным сегодня?
            </Text>
          )}
          {evening && todaysWords.length > 0 && (
            <Flex gap="1.5" wrap="wrap">
              {todaysWords.map((k) => (
                <Box key={k} opacity={e.words?.includes(k) ? 1 : 0.7}>
                  <WordChip wordKey={k} onClick={() => set({ words: e.words?.includes(k) ? [] : [k] })} />
                </Box>
              ))}
            </Flex>
          )}
          <EmotionPicker max={evening ? 1 : 3} value={e.words ?? []} onChange={(words) => set({ words })} onInfo={setInfo} />
          {!evening && (
            <Box>
              <Button size="sm" variant="ghost" onClick={() => setMore(!more)}>
                {more ? <LuX /> : <LuPlus />}
                {more ? 'Свернуть подробности' : 'Подробнее: тело, что случилось, дело, человек'}
              </Button>
            </Box>
          )}
          {!evening && more && details}
        </Stack>
        <Stack gap="5">
          <EnergySlider value={e.energy} onChange={(energy) => set({ energy })} />
          <Field label="Что влияет">
            <Chips multi value={e.factors ?? []} onChange={(v) => set({ factors: (v as string[]) ?? [] })} options={mirrorFactors.map((f) => ({ value: f.key, label: f.label }))} />
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
          <Field label="Когда">
            <input
              type="datetime-local"
              value={toLocalInput(at)}
              max={toLocalInput(new Date().toISOString())}
              onChange={(ev) => ev.target.value && setAt(new Date(ev.target.value).toISOString())}
              style={{ background: 'transparent', color: 'inherit', border: '1px solid var(--chakra-colors-border)', borderRadius: 6, padding: '6px 8px', colorScheme: 'dark' }}
            />
          </Field>
          <Flex gap="2" wrap="wrap">
            <Button disabled={empty} onClick={save}>
              Записать
            </Button>
            <Button variant="ghost" onClick={back}>
              Отмена
            </Button>
            {entry && (
              <Button
                variant="ghost"
                colorPalette="red"
                ml="auto"
                onClick={() => {
                  if (confirmAction('Удалить запись?')) {
                    dispatch(A.deleteJournal(entry.id))
                    back()
                  }
                }}
              >
                Удалить
              </Button>
            )}
          </Flex>
        </Stack>
      </Grid>
      {info && <WordCard wordKey={info} onClose={() => setInfo(undefined)} onPick={setInfo} />}
    </>
  )
}
