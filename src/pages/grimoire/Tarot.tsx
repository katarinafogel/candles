// «Таро»: a journal of readings with a real deck — the card of the day and spreads. The app never draws
// cards: she draws them herself and picks them here. A card's page gathers every time it came up and
// what she read in it then, so her own dictionary of the deck grows by itself.
import { Box, Button, Flex, HStack, Input, SimpleGrid, Stack, Tabs, Text } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { LuRotateCcw, LuX } from 'react-icons/lu'
import { useAttempt } from '../../components/grimoire/RoundBlocks'
import { SuggestInput } from '../../components/grimoire/SuggestInput'
import { Check, Chips, DateInput, DeleteButton, Empty, Field, Modal, PageHeader, Panel, Select, TextArea, TextInput } from '@shared/components/ui'
import { useToday } from '../../grimoire/act'
import { humanDay } from '@grimoire-core/grimoire/days'
import { cardHistory, cardName, tarotCards, tarotLayouts } from '@grimoire-core/grimoire/tarot'
import type { TarotCardPick, TarotReading } from '@grimoire-core/grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '@grimoire-core/store/grimoireSlice'

type Draft = Partial<TarotReading> & { type: TarotReading['type']; day: string; cards: TarotCardPick[] }

const cameLabel = { yes: 'сбылось', partly: 'отчасти', no: 'нет' } as const

/** A card picked by its name; the arrows turn it upside down. */
function CardPicker({ value, onChange, label }: { value?: TarotCardPick; onChange: (v?: TarotCardPick) => void; label?: string }) {
  const options = useMemo(() => tarotCards.map((c) => ({ value: c.key, label: c.name })), [])
  return (
    <Field label={label}>
      {value ? (
        <HStack gap="2" wrap="wrap">
          <Text fontWeight="semibold">
            {cardName(value.card)}
            {value.reversed ? ' (перевёрнутая)' : ''}
          </Text>
          <Button size="2xs" variant="ghost" onClick={() => onChange({ ...value, reversed: !value.reversed || undefined })}>
            <LuRotateCcw /> перевернуть
          </Button>
          <Button size="2xs" variant="ghost" aria-label="Убрать карту" onClick={() => onChange(undefined)}>
            <LuX />
          </Button>
        </HStack>
      ) : (
        <SuggestInput placeholder="название карты" options={options} onPick={(card) => onChange({ card, position: label })} />
      )}
    </Field>
  )
}

export function ReadingDialog({ reading, onClose }: { reading: Draft; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const meta = useAppSelector((s) => s.grimoire.meta)
  const [r, setR] = useState<Draft>(reading)
  const set = (p: Partial<Draft>) => setR((x) => ({ ...x, ...p }))
  const layouts = [...tarotLayouts, ...(meta.tarotLayouts ?? [])]
  const layout = layouts.find((l) => l.name === r.layout)
  const positions = r.type === 'day' ? ['Карта дня'] : layout ? layout.positions : r.cards.map((c, i) => c.position ?? `Карта ${i + 1}`).concat(`Карта ${r.cards.length + 1}`)
  const check = useAttempt()
  const [newLayout, setNewLayout] = useState('')
  const save = () =>
    check.attempt(r.cards.length > 0, () => {
      dispatch(A.upsertTarot({ reading: { ...r, cards: r.cards.filter(Boolean), meaning: r.meaning?.trim() || undefined } }))
      if (r.type === 'spread' && !layout && newLayout.trim()) dispatch(A.saveTarotLayout({ name: newLayout, positions: r.cards.map((c, i) => c.position ?? `Карта ${i + 1}`) }))
      onClose()
    })
  const setCard = (i: number, pos: string, v?: TarotCardPick) => {
    const cards = [...r.cards]
    if (v) cards[i] = { ...v, position: pos }
    else cards.splice(i, 1)
    set({ cards: cards.filter(Boolean) })
  }
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={r.id ? (r.type === 'day' ? 'Карта дня' : r.question || r.layout || 'Расклад') : r.type === 'day' ? 'Карта дня' : 'Новый расклад'}
      footer={
        <>
          {r.id && (
            <DeleteButton confirm="Удалить запись?" onDelete={() => {
              dispatch(A.deleteTarot(r.id!))
              onClose()
            }}
            />
          )}
          <Button onClick={save}>Сохранить</Button>
        </>
      }
    >
      <Stack gap="4">
        <HStack gap="3" wrap="wrap" align="flex-end">
          <Field label="День" w="180px">
            <DateInput value={r.day} onChange={(v) => v && set({ day: v })} />
          </Field>
          <Field label="Колода" flex="1" minW="180px">
            <SuggestInput
              placeholder={r.deck || 'название колоды'}
              options={(meta.tarotDecks ?? []).map((d) => ({ value: d, label: d }))}
              onPick={(deck) => set({ deck })}
              onCreate={(deck) => set({ deck: deck.trim() || undefined })}
              commitOnBlur
            />
            {r.deck && (
              <Text fontSize="xs" color="fg.muted" mt="1">
                {r.deck}
              </Text>
            )}
          </Field>
        </HStack>
        {r.type === 'spread' && (
          <>
            <Field label="Вопрос">
              <TextInput value={r.question ?? ''} onChange={(question) => set({ question: question || undefined })} />
            </Field>
            <Field label="Схема">
              <Select value={r.layout ?? ''} onChange={(v) => set({ layout: v || undefined, cards: [] })} placeholder="свободная" options={layouts.map((l) => ({ value: l.name, label: `${l.name} · ${l.positions.length}` }))} />
            </Field>
          </>
        )}
        <Panel display="flex" flexDirection="column" gap="3">
          {positions.map((pos, i) => (
            <CardPicker key={`${r.layout ?? ''}-${i}`} label={positions.length > 1 || r.type === 'spread' ? pos : undefined} value={r.cards[i]} onChange={(v) => setCard(i, pos, v)} />
          ))}
          {check.missing(!r.cards.length) && (
            <Text fontSize="sm" color="red.400">
              Выбери хотя бы одну карту
            </Text>
          )}
        </Panel>
        {r.type === 'spread' && !layout && r.cards.length > 1 && (
          <Field label="Сохранить схему" helper="позиции этого расклада станут твоей схемой">
            <TextInput value={newLayout} onChange={setNewLayout} />
          </Field>
        )}
        <Field label={r.type === 'day' ? 'Предсказание' : 'Толкование'}>
          <TextArea value={r.meaning ?? ''} onChange={(meaning) => set({ meaning })} rows={3} />
        </Field>
        {r.id && (
          <>
            <Field label={r.type === 'day' ? 'Сбылось?' : 'Чем кончилось'}>
              <Chips value={r.came} onChange={(v) => set({ came: (v as TarotReading['came']) ?? undefined })} options={(Object.keys(cameLabel) as (keyof typeof cameLabel)[]).map((k) => ({ value: k, label: cameLabel[k] }))} />
            </Field>
            <Field label="Пара слов">
              <TextArea value={r.outcome ?? ''} onChange={(outcome) => set({ outcome: outcome || undefined })} rows={2} />
            </Field>
          </>
        )}
      </Stack>
    </Modal>
  )
}

export const blankDay = (day: string): Draft => ({ type: 'day', day, cards: [] })
export const blankSpread = (day: string): Draft => ({ type: 'spread', day, cards: [], layout: '3 карты' })

/** Every time a card came up, with what she read in it. */
function CardPage({ card, onClose, onOpen }: { card: string; onClose: () => void; onOpen: (r: TarotReading) => void }) {
  const tarot = useAppSelector((s) => s.grimoire.tarot)
  const today = useToday()
  const history = cardHistory(tarot, card)
  return (
    <Modal open onClose={onClose} title={cardName(card)}>
      <Text fontSize="sm" color="fg.muted" mb="3">
        Выпадала: {history.length} · перевёрнутой: {history.filter((h) => h.pick.reversed).length}
      </Text>
      <Stack gap="2">
        {history.map(({ reading, pick }) => (
          <Panel key={reading.id + (pick.position ?? '')} p="2.5" onClick={() => onOpen(reading)}>
            <Text fontSize="xs" color="fg.muted">
              {humanDay(reading.day, today)} · {reading.type === 'day' ? 'карта дня' : `${reading.layout ?? 'расклад'}${pick.position ? `, ${pick.position}` : ''}`}
              {pick.reversed ? ' · перевёрнутая' : ''}
              {reading.came ? ` · ${cameLabel[reading.came]}` : ''}
            </Text>
            {reading.meaning && <Text fontSize="sm">{reading.meaning}</Text>}
          </Panel>
        ))}
      </Stack>
    </Modal>
  )
}

export default function Tarot() {
  const tarot = useAppSelector((s) => s.grimoire.tarot)
  const today = useToday()
  const [tab, setTab] = useState<'all' | 'day' | 'spread' | 'cards'>('all')
  const [edit, setEdit] = useState<Draft>()
  const [card, setCard] = useState<string>()
  const [majorOnly, setMajorOnly] = useState(false)
  const list = Object.values(tarot)
    .filter((r) => tab === 'all' || tab === 'cards' || r.type === tab)
    .sort((a, b) => b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt))
  const counts = useMemo(() => {
    const n: Record<string, number> = {}
    for (const r of Object.values(tarot)) for (const c of r.cards) n[c.card] = (n[c.card] ?? 0) + 1
    return n
  }, [tarot])
  const hasToday = Object.values(tarot).some((r) => r.type === 'day' && r.day === today)
  return (
    <>
      <PageHeader title="Таро">
        <HStack gap="2">
          {!hasToday && (
            <Button size="sm" variant="outline" onClick={() => setEdit(blankDay(today))}>
              Карта дня
            </Button>
          )}
          <Button size="sm" onClick={() => setEdit(blankSpread(today))}>
            Расклад
          </Button>
        </HStack>
      </PageHeader>
      <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value as typeof tab)} variant="line" size="sm" mb="4">
        <Tabs.List>
          <Tabs.Trigger value="all">Всё</Tabs.Trigger>
          <Tabs.Trigger value="day">Карты дня</Tabs.Trigger>
          <Tabs.Trigger value="spread">Расклады</Tabs.Trigger>
          <Tabs.Trigger value="cards">Колода</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
      {tab === 'cards' ? (
        <>
          <Box mb="3">
            <Check checked={majorOnly} onChange={setMajorOnly}>
              Только старшие арканы
            </Check>
          </Box>
          <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} gap="2">
            {tarotCards
              .filter((c) => !majorOnly || c.arcana === 'major')
              .map((c) => (
                <Panel display="flex" key={c.key} onClick={() => setCard(c.key)} justifyContent="space-between" gap="2" p="2" opacity={counts[c.key] ? 1 : 0.55}>
                  <Text fontSize="sm" textAlign="left">
                    {c.name}
                  </Text>
                  {counts[c.key] ? (
                    <Text fontSize="xs" color="ember.200">
                      {counts[c.key]}
                    </Text>
                  ) : null}
                </Panel>
              ))}
          </SimpleGrid>
        </>
      ) : list.length ? (
        <Stack gap="2">
          {list.map((r) => (
            <Panel key={r.id} onClick={() => setEdit(r)}>
              <Text fontSize="xs" color="fg.muted">
                {humanDay(r.day, today)} · {r.type === 'day' ? 'карта дня' : r.layout ?? 'расклад'}
                {r.deck ? ` · ${r.deck}` : ''}
                {r.came ? ` · ${cameLabel[r.came]}` : ''}
              </Text>
              {r.question && <Text fontWeight="semibold">{r.question}</Text>}
              <Text fontSize="sm">{r.cards.map((c) => `${cardName(c.card)}${c.reversed ? ' ↓' : ''}`).join(' · ')}</Text>
              {r.meaning && (
                <Text fontSize="sm" color="fg.muted" lineClamp={2}>
                  {r.meaning}
                </Text>
              )}
            </Panel>
          ))}
        </Stack>
      ) : (
        <Empty>Пока пусто. Вытяни карту из своей колоды и запиши её — со временем здесь соберётся твой словарь колоды.</Empty>
      )}
      {edit && <ReadingDialog reading={edit} onClose={() => setEdit(undefined)} />}
      {card && (
        <CardPage
          card={card}
          onClose={() => setCard(undefined)}
          onOpen={(r) => {
            setCard(undefined)
            setEdit(r)
          }}
        />
      )}
    </>
  )
}
