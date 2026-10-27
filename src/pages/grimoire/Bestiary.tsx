// «Бестиарий»: the workshop's people seen from the grimoire — a memo (birthday and dates, likes, gift
// ideas, questions to ask, dated facts), kindness and scars, and the balance of the last year. One
// person = one card: the name lives on the workshop `person`, the memo in the grimoire's
// `person_notes`, so candles given to them show here too. Scars are hidden until tapped.
import { Badge, Box, Button, Flex, HStack, IconButton, Input, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { nanoid } from '@reduxjs/toolkit'
import { useState, type ReactNode } from 'react'
import { LuCheck, LuEye, LuEyeOff, LuPlus, LuTrash2, LuUndo2 } from 'react-icons/lu'
import { Link as RouterLink, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTaskDialog } from '../../components/grimoire/TaskDialog'
import { Chips, confirmAction, Empty, Field, Modal, PageHeader, Section, TextArea, TextInput } from '../../components/ui'
import { useToday } from '../../grimoire/act'
import { days, humanDay, plural } from '../../grimoire/days'
import { countPetals } from '../../grimoire/mirrorStats'
import { liveScars, nextOccurrence, personBalance, upcomingDates } from '../../grimoire/people'
import { isOpenTask } from '../../grimoire/selectors'
import type { PersonList, PersonNotes } from '../../grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { actions } from '../../store/dataSlice'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { PetalBar } from './MirrorInsights'

/** «14.03» or «14.03.1990» ↔ «03-14» or «1990-03-14». */
export function parseDate(s: string): string | undefined {
  const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{4}))?$/)
  if (!m) return undefined
  const [d, mo] = [+m[1], +m[2]]
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined
  const md = `${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return m[3] ? `${m[3]}-${md}` : md
}
export const showDate = (v?: string) => (v ? (v.length > 5 ? `${v.slice(8)}.${v.slice(5, 7)}.${v.slice(0, 4)}` : `${v.slice(3)}.${v.slice(0, 2)}`) : '')

/** A date typed as «14.03» or «14.03.1990»; saved when it parses, cleared when emptied. */
function DateField({ value, onChange }: { value?: string; onChange: (v?: string) => void }) {
  const [text, setText] = useState(showDate(value))
  const bad = !!text.trim() && !parseDate(text)
  return (
    <Box>
      <Input
        size="sm"
        w="150px"
        value={text}
        placeholder="14.03 или 14.03.1990"
        borderColor={bad ? 'red.500' : undefined}
        onChange={(e) => {
          setText(e.target.value)
          if (!e.target.value.trim()) onChange(undefined)
          else if (parseDate(e.target.value)) onChange(parseDate(e.target.value))
        }}
      />
    </Box>
  )
}

const ddmm = (day: string) => `${day.slice(8)}.${day.slice(5, 7)}.${day.slice(2, 4)}`

/** A dated list on the card: add a line (today by default), delete it; `extra` adds a toggle per line. */
function Lines({ personId, list, title, placeholder, lines, extra, hint }: { personId: string; list: PersonList; title: string; placeholder: string; lines: PersonNotes[PersonList]; extra?: (l: NonNullable<PersonNotes[PersonList]>[number]) => ReactNode; hint?: string }) {
  const dispatch = useAppDispatch()
  const today = useToday()
  const [text, setText] = useState('')
  const [on, setOn] = useState(today)
  const add = () => {
    dispatch(A.addPersonLine({ personId, list, text, on }))
    setText('')
  }
  const sorted = [...(lines ?? [])].sort((a, b) => b.day.localeCompare(a.day))
  return (
    <Field label={title} helper={hint}>
      <Stack gap="1.5">
        {sorted.map((l) => (
          <HStack key={l.id} gap="2" align="flex-start" opacity={l.released || l.asked ? 0.55 : 1}>
            <Text fontSize="xs" color="fg.subtle" pt="0.5" flexShrink={0} w="58px">
              {ddmm(l.day)}
            </Text>
            <Text fontSize="sm" flex="1" textDecoration={l.asked ? 'line-through' : undefined}>
              {l.text}
              {l.released && (
                <Text as="span" color="fg.subtle" fontSize="xs">
                  {' '}
                  · отпустила {ddmm(l.released)}
                </Text>
              )}
            </Text>
            {extra?.(l)}
            <IconButton size="2xs" variant="ghost" aria-label="Удалить" onClick={() => confirmAction('Удалить запись?') && dispatch(A.deletePersonLine({ personId, list, id: l.id }))}>
              <LuTrash2 />
            </IconButton>
          </HStack>
        ))}
        <Flex gap="2" wrap="wrap">
          <Input size="sm" flex="1" minW="180px" value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && text.trim() && add()} />
          <input
            type="date"
            value={on}
            max={today}
            aria-label="Когда"
            onChange={(e) => e.target.value && setOn(e.target.value)}
            style={{ background: 'transparent', color: 'inherit', border: '1px solid var(--chakra-colors-border)', borderRadius: 6, padding: '4px 6px', colorScheme: 'dark', fontSize: 13 }}
          />
          <IconButton size="sm" variant="outline" aria-label="Добавить" disabled={!text.trim()} onClick={add}>
            <LuPlus />
          </IconButton>
        </Flex>
      </Stack>
    </Field>
  )
}

function NewPerson({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const save = () => {
    const id = nanoid(8)
    dispatch(actions.upsertPerson({ id, name: name.trim(), contact: '', notes: '' }))
    onClose()
    navigate(`/g/people/${id}`)
  }
  return (
    <Modal open onClose={onClose} title="Новый человек" footer={<Button disabled={!name.trim()} onClick={save}>Создать</Button>}>
      <Field label="Имя" helper="тот же человек появится в «Людях» мастерской">
        <TextInput value={name} onChange={setName} />
      </Field>
    </Modal>
  )
}

export default function Bestiary() {
  const people = useAppSelector((s) => s.data.people)
  const g = useAppSelector((s) => s.grimoire)
  const today = useToday()
  const [q, setQ] = useState('')
  const [circle, setCircle] = useState<string>()
  const [adding, setAdding] = useState(false)
  const soon = upcomingDates(g.personNotes, today, 30).filter((d) => people[d.personId])
  const list = Object.values(people)
    .filter((p) => (!q || `${p.name} ${g.personNotes[p.id]?.nickname ?? ''}`.toLowerCase().includes(q.toLowerCase())) && (!circle || g.personNotes[p.id]?.circle === circle))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  return (
    <>
      <PageHeader title="Бестиарий">
        <Button size="sm" onClick={() => setAdding(true)}>
          <LuPlus /> Человек
        </Button>
      </PageHeader>
      {soon.length > 0 && (
        <Section title="Ближайшие даты">
          <Stack gap="1">
            {soon.map((d) => (
              <Text key={`${d.personId}${d.label}`} fontSize="sm">
                🎂{' '}
                <RouterLink to={`/g/people/${d.personId}`}>
                  <Text as="span" color="ember.100">
                    {people[d.personId].name}
                  </Text>
                </RouterLink>{' '}
                — {d.label}
                {d.age ? `, ${d.age}` : ''} · {d.inDays === 0 ? 'сегодня' : d.inDays === 1 ? 'завтра' : `через ${days(d.inDays)}`}
              </Text>
            ))}
          </Stack>
        </Section>
      )}
      <Flex gap="2" wrap="wrap" align="center" mb="3">
        <Input size="sm" maxW="260px" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени" />
        <Chips value={circle} onChange={(v) => setCircle(v as string | undefined)} options={(g.meta.circles ?? []).map((c) => ({ value: c, label: c }))} />
      </Flex>
      {list.length ? (
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="2">
          {list.map((p) => {
            const n = g.personNotes[p.id]
            const b = personBalance(g, p.id, today)
            return (
              <RouterLink key={p.id} to={`/g/people/${p.id}`}>
                <Box p="3" borderRadius="l2" borderWidth="1px" borderColor="border" bg="bg.subtle" _hover={{ bg: 'bg.muted' }}>
                  <HStack gap="2" wrap="wrap">
                    <Text fontWeight="semibold">{p.name}</Text>
                    {n?.nickname && <Text color="fg.muted">«{n.nickname}»</Text>}
                    {n?.circle && <Badge variant="outline">{n.circle}</Badge>}
                  </HStack>
                  <Text fontSize="xs" color="fg.muted" mt="0.5">
                    {[n?.birthday && `🎂 ${showDate(n.birthday)}`, b.forThem && `для него/неё: ${b.forThem}`, b.kindness && `добрых дел: ${b.kindness}`, b.scars && `шрамов: ${b.scars}`].filter(Boolean).join(' · ') || 'памятка пустая'}
                  </Text>
                </Box>
              </RouterLink>
            )
          })}
        </SimpleGrid>
      ) : (
        <Empty>{Object.keys(people).length ? 'Под этот фильтр никого нет.' : 'Пока никого. Люди мастерской появятся здесь же.'}</Empty>
      )}
      {adding && <NewPerson onClose={() => setAdding(false)} />}
    </>
  )
}

export function BestiaryCard() {
  const { id = '' } = useParams()
  const dispatch = useAppDispatch()
  const person = useAppSelector((s) => s.data.people[id])
  const allCandles = useAppSelector((s) => s.data.candles)
  const g = useAppSelector((s) => s.grimoire)
  const today = useToday()
  const { open, dialog } = useTaskDialog()
  const [scarsShown, setScarsShown] = useState(false)
  if (!person) return <Navigate to="/g/people" replace />
  const n: PersonNotes = g.personNotes[id] ?? { id }
  const candles = Object.values(allCandles).filter((c) => c.personId === id)
  const set = (p: Partial<PersonNotes>) => dispatch(A.updatePersonNotes({ id, ...p }))
  const b = personBalance(g, id, today)
  const deeds = Object.values(g.tasks).filter((t) => t.personIds?.includes(id) && t.status !== 'cancelled')
  const openDeeds = deeds.filter(isOpenTask)
  const mirror = Object.values(g.journal).filter((e) => e.people?.includes(id))
  const live = liveScars(n)
  const next = n.birthday ? nextOccurrence(n.birthday, today) : undefined

  return (
    <>
      <PageHeader title={person.name} back="/g/people">
        <Button asChild size="sm" variant="ghost">
          <RouterLink to={`/people?p=${id}`}>в мастерской</RouterLink>
        </Button>
      </PageHeader>
      <Section>
        <Text fontSize="sm" color="fg.muted">
          За 12 месяцев: ты для неё/него — {plural(b.forThem, 'дело', 'дела', 'дел')} · добрых дел от неё/него — {b.kindness} · шрамов — {b.scars}
        </Text>
        {next && (
          <Text fontSize="sm" mt="1">
            🎂 {humanDay(next, today)}
            {n.birthday!.length > 5 ? `, исполнится ${+next.slice(0, 4) - +n.birthday!.slice(0, 4)}` : ''}
          </Text>
        )}
      </Section>
      <SimpleGrid columns={{ base: 1, lg: 2 }} gap="4" alignItems="start">
        <Stack gap="4">
          <Section title="Памятка">
            <Stack gap="4">
              <Field label="Прозвище" helper="как ты его про себя называешь">
                <TextInput value={n.nickname ?? ''} onChange={(v) => set({ nickname: v || undefined })} />
              </Field>
              <Field label="Круг">
                <Chips value={n.circle} onChange={(v) => set({ circle: (v as string) ?? undefined })} options={(g.meta.circles ?? []).map((c) => ({ value: c, label: c }))} />
              </Field>
              <Field label="День рождения" helper="год можно не писать">
                <DateField value={n.birthday} onChange={(birthday) => set({ birthday })} />
              </Field>
              <Field label="Другие даты" helper="годовщины, именины, день знакомства">
                <Stack gap="1.5">
                  {(n.dates ?? []).map((d) => (
                    <HStack key={d.id} gap="2">
                      <Text fontSize="sm" flex="1">
                        {d.label} · {showDate(d.date)}
                      </Text>
                      <IconButton size="2xs" variant="ghost" aria-label="Удалить" onClick={() => set({ dates: n.dates!.filter((x) => x.id !== d.id) })}>
                        <LuTrash2 />
                      </IconButton>
                    </HStack>
                  ))}
                  <NewDate onAdd={(label, date) => set({ dates: [...(n.dates ?? []), { id: nanoid(6), label, date }] })} />
                </Stack>
              </Field>
              <Field label="Нравится" helper="вкусы, хобби, цветы и ароматы — пригодится для свечей">
                <TextArea value={n.likes ?? ''} onChange={(v) => set({ likes: v || undefined })} rows={2} />
              </Field>
              <Field label="Не нравится" helper="аллергии, что не дарить, болезненные темы">
                <TextArea value={n.dislikes ?? ''} onChange={(v) => set({ dislikes: v || undefined })} rows={2} />
              </Field>
            </Stack>
          </Section>
          <Section title="Идеи и вопросы">
            <Stack gap="4">
              <Lines personId={id} list="gifts" title="Идеи подарков" placeholder="свеча с бергамотом" lines={n.gifts} />
              <Lines
                personId={id}
                list="ask"
                title="Что спросить"
                placeholder="как прошло собеседование"
                lines={n.ask}
                extra={(l) => (
                  <IconButton size="2xs" variant="ghost" aria-label={l.asked ? 'Ещё не спросила' : 'Спросила'} onClick={() => dispatch(A.updatePersonLine({ personId: id, list: 'ask', id: l.id, patch: { asked: l.asked ? undefined : today } }))}>
                    {l.asked ? <LuUndo2 /> : <LuCheck />}
                  </IconButton>
                )}
              />
            </Stack>
          </Section>
        </Stack>
        <Stack gap="4">
          <Section title="Заметки и добрые дела">
            <Stack gap="4">
              <Lines personId={id} list="facts" title="Заметки" placeholder="переехал в Казань" lines={n.facts} />
              <Lines personId={id} list="kindness" title="Добрые дела" placeholder="помогла с переездом" lines={n.kindness} />
            </Stack>
          </Section>
          <Section
            title="Шрамы"
            actions={
              <Button size="xs" variant="ghost" onClick={() => setScarsShown(!scarsShown)}>
                {scarsShown ? <LuEyeOff /> : <LuEye />}
                {scarsShown ? 'скрыть' : `показать${n.scars?.length ? ` (${n.scars.length})` : ''}`}
              </Button>
            }
          >
            {scarsShown ? (
              <Lines
                personId={id}
                list="scars"
                title="Где задел или воспользовался"
                hint="«отпустила» убирает шрам из предупреждений, но оставляет в истории"
                placeholder="не пришла на мой день рождения"
                lines={n.scars}
                extra={(l) => (
                  <Button size="2xs" variant="ghost" onClick={() => dispatch(A.updatePersonLine({ personId: id, list: 'scars', id: l.id, patch: { released: l.released ? undefined : today } }))}>
                    {l.released ? 'вернуть' : 'отпустила'}
                  </Button>
                )}
              />
            ) : (
              <Text fontSize="sm" color="fg.subtle">
                Скрыты — нажми «показать». {live.length ? `Не отпущено: ${live.length}.` : ''}
              </Text>
            )}
          </Section>
          <Section title="Дела и свечи">
            <Stack gap="1.5" fontSize="sm">
              {openDeeds.map((t) => (
                <Text key={t.id} cursor="pointer" onClick={() => open(t)}>
                  ✦ {t.title}
                  {t.doOn ? ` · ${humanDay(t.doOn, today)}` : ''}
                </Text>
              ))}
              {deeds.length > openDeeds.length && <Text color="fg.muted">Сделано для неё/него: {deeds.length - openDeeds.length}</Text>}
              {candles.map((c) => (
                <Text key={c.id} color="fg.muted">
                  🕯 {c.name}
                </Text>
              ))}
              {!deeds.length && !candles.length && <Text color="fg.subtle">Пока ничего. Дела привязываются через @имя.</Text>}
            </Stack>
          </Section>
          {mirror.some((e) => e.words?.length) && (
            <Section title="В зеркале">
              <PetalBar label={plural(mirror.length, 'запись', 'записи', 'записей')} counts={countPetals(mirror)} />
            </Section>
          )}
        </Stack>
      </SimpleGrid>
      {dialog}
    </>
  )
}

function NewDate({ onAdd }: { onAdd: (label: string, date: string) => void }) {
  const [label, setLabel] = useState('')
  const [date, setDate] = useState('')
  const ok = label.trim() && parseDate(date)
  return (
    <Flex gap="2" wrap="wrap">
      <Input size="sm" flex="1" minW="140px" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="годовщина свадьбы" />
      <Input size="sm" w="150px" value={date} onChange={(e) => setDate(e.target.value)} placeholder="14.03" />
      <IconButton
        size="sm"
        variant="outline"
        aria-label="Добавить дату"
        disabled={!ok}
        onClick={() => {
          onAdd(label.trim(), parseDate(date)!)
          setLabel('')
          setDate('')
        }}
      >
        <LuPlus />
      </IconButton>
    </Flex>
  )
}
