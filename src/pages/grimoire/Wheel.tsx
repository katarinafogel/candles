// The wheel of the year: eight sectors, a «today» hand, months outside, full moons inside.
// Tap a sector to see its sabbat and the deeds and practices of the segment: «хочу», «в дела», «не моё».
import { Box, Button, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Chips, Empty, Field, Modal, notify, PageHeader, Section, TextArea, TextInput } from '../../components/ui'
import { useToday } from '../../grimoire/act'
import { addDays, days, humanDay } from '../../grimoire/days'
import type { Sabbat, WheelPractice } from '../../grimoire/types'
import { moonPhase, sabbatOrder, sabbats, segmentOf, wheelNow } from '../../grimoire/wheel'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'

const SIZE = 440
const C = SIZE / 2
const R = 176
const r = 62
const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

/** Point at `turn` (0–1 from the top, clockwise) and radius. */
const at = (turn: number, radius: number) => {
  const a = turn * 2 * Math.PI - Math.PI / 2
  return [C + radius * Math.cos(a), C + radius * Math.sin(a)] as const
}

function sectorPath(i: number) {
  const [x1, y1] = at(i / 8, R)
  const [x2, y2] = at((i + 1) / 8, R)
  const [x3, y3] = at((i + 1) / 8, r)
  const [x4, y4] = at(i / 8, r)
  return `M${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 0 0 ${x4} ${y4} Z`
}

function WheelSvg({ today, hemisphere, selected, onSelect, marks }: { today: string; hemisphere: 'north' | 'south'; selected: Sabbat; onSelect: (s: Sabbat) => void; marks: Record<Sabbat, { want: number; lived: number }> }) {
  const now = wheelNow(today, hemisphere)
  const year = +today.slice(0, 4)
  // Where each month and each full moon of this turn falls on the drawn wheel.
  const monthMarks = months.map((m, i) => ({ m, turn: wheelNow(`${year}-${String(i + 1).padStart(2, '0')}-15`, hemisphere).turn }))
  const fullMoons = useMemo(() => {
    const out: number[] = []
    let d = addDays(today, -183)
    for (let i = 0; i < 366; i++, d = addDays(d, 1)) if (moonPhase(d) === 4 && moonPhase(addDays(d, -1)) !== 4) out.push(wheelNow(d, hemisphere).turn)
    return out
  }, [today, hemisphere])
  const [hx, hy] = at(now.turn, R + 6)
  const [hx0, hy0] = at(now.turn, r - 4)

  return (
    <Box maxW="440px" mx="auto" w="100%">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" role="group" aria-label="Колесо года">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={C} cy={C} r={R + 4} fill="none" stroke="var(--chakra-colors-ember-800)" strokeWidth="1" />
        {sabbatOrder.map((s, i) => {
          const info = sabbats[s]
          const isNow = s === now.current.sabbat
          const isSel = s === selected
          const [lx, ly] = at((i + 0.5) / 8, (R + r) / 2 + 6)
          const [sx, sy] = at((i + 0.5) / 8, (R + r) / 2 - 18)
          const m = marks[s]
          return (
            <g
              key={s}
              role="button"
              tabIndex={0}
              aria-label={`${info.name}${isNow ? ', сейчас' : ''}`}
              aria-pressed={isSel}
              style={{ cursor: 'pointer', outline: 'none' }}
              onClick={() => onSelect(s)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(s)}
            >
              <path d={sectorPath(i)} fill={info.color} fillOpacity={isSel ? 0.55 : isNow ? 0.4 : 0.2} stroke={isSel ? 'var(--chakra-colors-ember-200)' : 'var(--chakra-colors-border-emphasized)'} strokeWidth={isSel ? 2 : 1} filter={isNow ? 'url(#glow)' : undefined} />
              <text x={sx} y={sy} textAnchor="middle" dominantBaseline="middle" fontSize="18">
                {info.symbol}
              </text>
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="var(--chakra-colors-fg)" fontSize="13" fontFamily="'Cormorant Garamond', Georgia, serif" fontWeight="600">
                {info.name}
              </text>
              {(m.want > 0 || m.lived > 0) && (
                <text x={lx} y={ly + 15} textAnchor="middle" fill="var(--chakra-colors-ember-200)" fontSize="9">
                  {m.want ? `♡${m.want}` : ''} {m.lived ? `✓${m.lived}` : ''}
                </text>
              )}
            </g>
          )
        })}
        {/* sparkles on the borders between sectors */}
        {sabbatOrder.map((s, i) => {
          const [x, y] = at(i / 8, R + 4)
          return <path key={s} transform={`translate(${x - 5} ${y - 5}) scale(.42)`} d="M12 1c.6 5.6 2.4 8.4 11 11-8.6 2.6-10.4 5.4-11 11-.6-5.6-2.4-8.4-11-11 8.6-2.6 10.4-5.4 11-11z" fill="var(--chakra-colors-ember-300)" />
        })}
        {monthMarks.map(({ m, turn }) => {
          const [x, y] = at(turn, R + 20)
          return (
            <text key={m} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="var(--chakra-colors-fg-subtle)">
              {m}
            </text>
          )
        })}
        {fullMoons.map((turn, i) => {
          const [x, y] = at(turn, r + 8)
          return <circle key={i} cx={x} cy={y} r="2.6" fill="var(--chakra-colors-ember-100)" fillOpacity=".75" />
        })}
        {/* the wood slice with the moon in the centre */}
        <circle cx={C} cy={C} r={r - 6} fill="#4b3424" />
        <circle cx={C} cy={C} r={r - 10} fill="#b88a5c" />
        <circle cx={C} cy={C} r={r - 22} fill="none" stroke="#9a7049" strokeWidth=".8" />
        <text x={C} y={C - 6} textAnchor="middle" fontSize="26" fontFamily="'Cormorant Garamond', Georgia, serif" fontWeight="700" fill="#1b1814">
          {now.daysToNext}
        </text>
        <text x={C} y={C + 14} textAnchor="middle" fontSize="9" fill="#1b1814">
          до {sabbats[now.next.sabbat].dative}
        </text>
        <line x1={hx0} y1={hy0} x2={hx} y2={hy} stroke="var(--chakra-colors-ember-300)" strokeWidth="2" strokeLinecap="round" />
        <circle cx={hx} cy={hy} r="4" fill="var(--chakra-colors-ember-300)" />
      </svg>
    </Box>
  )
}

function PracticeDialog({ sabbat, onClose }: { sabbat: Sabbat; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [p, setP] = useState<Omit<WheelPractice, 'id'>>({ title: '', sabbat, mode: 'once' })
  return (
    <Modal
      open
      onClose={onClose}
      title={`Своё к ${sabbats[sabbat].dative}`}
      footer={
        <Button
          disabled={!p.title.trim()}
          onClick={() => {
            dispatch(A.upsertPractice({ ...p, title: p.title.trim(), steps: p.steps?.filter(Boolean) }))
            onClose()
          }}
        >
          Добавить
        </Button>
      }
    >
      <Stack gap="4">
        <Field label="Название">
          <TextInput value={p.title} onChange={(v) => setP({ ...p, title: v })} />
        </Field>
        <Field label="Когда">
          <Chips value={p.mode} onChange={(v) => setP({ ...p, mode: (v as WheelPractice['mode']) ?? 'once' })} options={[
            { value: 'day', label: 'в день саббата' },
            { value: 'segment', label: 'весь отрезок' },
            { value: 'once', label: 'однажды за отрезок' },
          ]} />
        </Field>
        <Field label="Это бытовое сезонное дело">
          <Chips value={p.seasonal ? 'yes' : 'no'} onChange={(v) => setP({ ...p, seasonal: v === 'yes' })} options={[
            { value: 'no', label: 'практика' },
            { value: 'yes', label: 'бытовое' },
          ]} />
        </Field>
        <Field label="Ритуал по шагам" helper="по шагу на строку">
          <TextArea value={(p.steps ?? []).join('\n')} onChange={(v) => setP({ ...p, steps: v ? v.split('\n') : undefined })} rows={4} />
        </Field>
        <Field label="Источник" helper="ссылка на пост или книгу">
          <TextInput value={p.source ?? ''} onChange={(v) => setP({ ...p, source: v || undefined })} />
        </Field>
      </Stack>
    </Modal>
  )
}

export default function Wheel() {
  const dispatch = useAppDispatch()
  const g = useAppSelector((s) => s.grimoire)
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const hemisphere = g.meta.hemisphere
  const now = wheelNow(today, hemisphere)
  const selected = (params.get('s') as Sabbat) || now.current.sabbat
  const [adding, setAdding] = useState(false)
  const [editNotes, setEditNotes] = useState(false)
  const info = sabbats[selected]
  const seg = segmentOf(selected, today, hemisphere)
  const year = today.slice(0, 4)

  const wanted = useMemo(() => new Set(Object.values(g.wishes).filter((w) => w.practiceId && (w.status === 'dream' || w.status === 'inProgress')).map((w) => w.practiceId!)), [g.wishes])
  const lived = useMemo(() => {
    const out = new Map<string, number>()
    for (const t of Object.values(g.tasks)) if (t.practiceId && t.status === 'done' && (t.doneDay ?? '').startsWith(year)) out.set(t.practiceId, (out.get(t.practiceId) ?? 0) + 1)
    return out
  }, [g.tasks, year])
  const marks = Object.fromEntries(
    sabbatOrder.map((s) => {
      const ps = Object.values(g.practices).filter((p) => p.sabbat === s && !p.hidden)
      return [s, { want: ps.filter((p) => wanted.has(p.id)).length, lived: ps.filter((p) => lived.has(p.id)).length }]
    }),
  ) as Record<Sabbat, { want: number; lived: number }>

  // Wished ones first: the segment passes, and then it is a whole year of waiting.
  const practices = Object.values(g.practices)
    .filter((p) => p.sabbat === selected && !p.hidden)
    .sort((a, b) => Number(wanted.has(b.id)) - Number(wanted.has(a.id)) || Number(!!a.seasonal) - Number(!!b.seasonal) || a.title.localeCompare(b.title))
  const pastJournal = Object.values(g.journal).filter((j) => j.tags?.includes(`саббат:${selected}`))

  return (
    <>
      <PageHeader title="Колесо года">
        <Text fontSize="sm" color="fg.muted">
          сейчас {sabbats[now.current.sabbat].name} · до {sabbats[now.next.sabbat].dative} {days(now.daysToNext)}
        </Text>
      </PageHeader>
      <WheelSvg today={today} hemisphere={hemisphere} selected={selected} onSelect={(s) => setParams({ s }, { replace: true })} marks={marks} />

      <Section
        title={`${info.symbol} ${info.name}`}
        actions={
          <Button size="xs" variant="ghost" onClick={() => setEditNotes(!editNotes)}>
            {editNotes ? 'Готово' : 'Моя традиция'}
          </Button>
        }
      >
        <Text fontSize="sm" color="fg.muted">
          {humanDay(seg.from, today)} — {humanDay(seg.to, today)} · {info.theme}
        </Text>
        {editNotes ? (
          <Box mt="3">
            <TextArea
              value={g.meta.sabbatNotes[selected] ?? ''}
              onChange={(v) => dispatch(A.updateMeta({ sabbatNotes: { ...g.meta.sabbatNotes, [selected]: v } }))}
              placeholder="смысл, цвета, травы, камни, символы, еда"
              rows={5}
            />
          </Box>
        ) : (
          g.meta.sabbatNotes[selected] && (
            <Text fontSize="sm" mt="3" whiteSpace="pre-wrap">
              {g.meta.sabbatNotes[selected]}
            </Text>
          )
        )}
      </Section>

      <Section title="Что можно сделать" actions={<Button size="xs" variant="outline" onClick={() => setAdding(true)}>Добавить своё</Button>}>
        {practices.length ? (
          <Stack gap="2">
            {practices.map((p) => {
              const want = wanted.has(p.id)
              return (
                <Flex key={p.id} gap="3" align="center" wrap="wrap" py="2" borderBottomWidth="1px" borderColor="border.muted" _last={{ borderBottomWidth: 0 }}>
                  <Box flex="1" minW="160px">
                    <Text fontSize="sm">
                      {want && <Text as="span" color="ember.300">♡ </Text>}
                      {p.title}
                    </Text>
                    <Text fontSize="xs" color="fg.subtle">
                      {p.seasonal ? 'бытовое · ' : ''}
                      {p.mode === 'day' ? 'в день саббата' : p.mode === 'segment' ? 'весь отрезок' : 'однажды за отрезок'}
                      {lived.get(p.id) ? ` · прожито в этом году` : ''}
                      {p.source ? ` · ${p.source}` : ''}
                    </Text>
                  </Box>
                  <HStack gap="1">
                    <Button size="xs" variant={want ? 'solid' : 'outline'} colorPalette="ember" onClick={() => dispatch(want ? A.unwantPractice(p.id) : A.wantPractice({ practiceId: p.id }))}>
                      Хочу
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        const doOn = p.mode === 'day' && seg.from >= today ? seg.from : undefined
                        dispatch(A.practiceToTask({ practiceId: p.id, doOn }))
                        notify(doOn ? `В делах на ${humanDay(doOn, today)}` : 'В бэклоге')
                      }}
                    >
                      В дела
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        dispatch(A.upsertPractice({ ...p, hidden: true }))
                        notify('Скрыто', 'info', undefined, { label: 'Вернуть', onClick: () => dispatch(A.upsertPractice({ ...p, hidden: false })) })
                      }}
                    >
                      Не моё
                    </Button>
                  </HStack>
                </Flex>
              )
            })}
          </Stack>
        ) : (
          <Empty>Для этого отрезка пока ничего нет.</Empty>
        )}
        {pastJournal.length > 0 && (
          <Text fontSize="xs" color="fg.muted" mt="3">
            Записей о прошлых {info.name}ах: {pastJournal.length}
          </Text>
        )}
      </Section>
      {adding && <PracticeDialog sabbat={selected} onClose={() => setAdding(false)} />}
    </>
  )
}
