import { Box, Button, Flex, HStack, IconButton, Input, SimpleGrid, Stack, Table, Text } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { LuPlus, LuTrash2 } from 'react-icons/lu'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { StockHint } from '../components/StockHint'
import { Check, Chips, Empty, Field, notify, NumInput, PageHeader, Section, Select, TextArea, TextInput } from '../components/ui'
import { calcWax, fmt, round2 } from '../lib/calc'
import { nowLocal, toIso } from '../lib/dates'
import { wickSchemeLabel } from '../lib/labels'
import { capacityOf, materialOptions, moldOfCandle } from '../lib/selectors'
import { useAppDispatch, useData } from '../store'
import { actions } from '../store/dataSlice'
import type { WaxPart } from '../types'

export default function NewPour() {
  const d = useData()
  const dispatch = useAppDispatch()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const s = d.settings
  const candidates = Object.values(d.candles)
    .filter((c) => c.stage === 'wicked')
    .sort((a, b) => a.id.localeCompare(b.id, 'ru', { numeric: true }))

  const [sel, setSel] = useState<string[]>(() => (sp.get('ids') ?? '').split(',').filter((i) => d.candles[i]?.stage === 'wicked'))
  const firstMold = sel.length ? moldOfCandle(d, d.candles[sel[0]]) : undefined
  const [date, setDate] = useState(nowLocal())
  const [waxes, setWaxes] = useState<WaxPart[]>([{ materialId: undefined, share: 100 }])
  const [lossPct, setLossPct] = useState<number | undefined>(s.waxLossPct)
  const [fragrancePct, setFragrancePct] = useState<number | undefined>()
  const [fragranceId, setFragranceId] = useState<string>()
  const [dyeId, setDyeId] = useState<string>()
  const [dyePct, setDyePct] = useState<number | undefined>(s.waxDyePct)
  const [dyeColor, setDyeColor] = useState('')
  const [dyeForm, setDyeForm] = useState<'liquid' | 'solid' | undefined>('solid')
  const [tFrag, setTFrag] = useState<number | undefined>()
  const [tPour, setTPour] = useState<number | undefined>()
  const [tMold, setTMold] = useState<number | undefined>()
  const [noHeat, setNoHeat] = useState(true)
  const [fact, setFact] = useState<{ wax: (number | undefined)[]; fragrance?: number; dye?: number }>({ wax: [] })
  const [comment, setComment] = useState('')

  const fPct = fragrancePct ?? firstMold?.fragrancePct ?? s.fragrancePct
  const capacity = sel.reduce((a, id) => a + capacityOf(d, d.candles[id]), 0)
  const calc = useMemo(
    () => calcWax(capacity, { lossPct: lossPct ?? 0, fragrancePct: fPct, dyePct: dyePct ?? 0, shares: waxes.map((w) => w.share) }),
    [capacity, lossPct, fPct, dyePct, waxes],
  )
  const waxFact = waxes.map((_, i) => fact.wax[i] ?? calc.waxByPart[i])
  const fragFact = fact.fragrance ?? calc.fragranceG
  const dyeFact = fact.dye ?? calc.dyeG
  const shareSum = waxes.reduce((a, w) => a + w.share, 0)

  function save() {
    if (!sel.length) return notify('Отметьте свечи', 'warning')
    if (Math.abs(shareSum - 100) > 0.01) return notify('Доли воска должны давать 100%', 'warning')
    dispatch(
      actions.createPour({
        pour: {
          date: toIso(date),
          candleIds: sel,
          waxes,
          lossPct: lossPct ?? 0,
          fragrance: { materialId: fragranceId, pct: fPct },
          dye: { materialId: dyeId, pct: dyePct ?? 0, color: dyeColor, form: dyeForm },
          tempFragranceC: tFrag,
          tempPourC: tPour,
          tempMoldC: noHeat ? 'none' : tMold,
          calc: { totalG: calc.totalG, waxG: calc.waxG, fragranceG: calc.fragranceG, dyeG: calc.dyeG },
          fact: { waxG: waxFact.map((x) => round2(x ?? 0)), fragranceG: round2(fragFact), dyeG: round2(dyeFact) },
          comment,
        },
      }),
    )
    notify(`Заливка сохранена: свечей ${sel.length}, дозревают`)
    nav('/candles?stage=curing')
  }

  return (
    <>
      <PageHeader title="Новая заливка" back="/" />
      <Section title="Свечи с приклеенным фитилём">
        {!candidates.length && <Empty>Нет свечей с фитилём. Приклейте фитиль на подсвечниках с демпферами.</Empty>}
        <Stack gap="1">
          {candidates.map((c) => {
            const on = sel.includes(c.id)
            const m = moldOfCandle(d, c)
            return (
              <Flex key={c.id} align="center" gap="3" p="2" borderRadius="l2" bg={on ? 'emerald.subtle' : undefined}>
                <Check checked={on} onChange={(v) => setSel(v ? [...sel, c.id] : sel.filter((x) => x !== c.id))} />
                <Box flex="1">
                  <Text fontWeight={on ? 'semibold' : 'normal'}>
                    {c.id} · {c.name || m?.name}
                  </Text>
                  <Text fontSize="xs" color="fg.muted">
                    {m?.waxCapacityG ?? '?'} г · {wickSchemeLabel[c.wick.scheme]}, {fmt(c.wick.lengthCm)} см
                  </Text>
                </Box>
              </Flex>
            )
          })}
        </Stack>
        <Text mt="3" fontSize="sm" color="fg.muted">
          Сумма ёмкостей: <b>{fmt(capacity)} г</b>
        </Text>
      </Section>

      <Section title="Рецепт">
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
          <Field label="Дата и время">
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Запас на потери">
            <NumInput value={lossPct} onChange={setLossPct} suffix="%" />
          </Field>
        </SimpleGrid>

        <Field label={`Воск${waxes.length > 1 ? ` (доли: ${fmt(shareSum)}%)` : ''}`} mt="4" invalid={Math.abs(shareSum - 100) > 0.01}>
          <Stack gap="2" w="100%">
            {waxes.map((w, i) => (
              <HStack key={i}>
                <Select
                  value={w.materialId}
                  onChange={(v) => setWaxes(waxes.map((x, j) => (j === i ? { ...x, materialId: v || undefined } : x)))}
                  placeholder="— не списывать —"
                  options={materialOptions(d, 'wax')}
                />
                <NumInput width="110px" value={w.share} onChange={(v) => setWaxes(waxes.map((x, j) => (j === i ? { ...x, share: v ?? 0 } : x)))} suffix="%" />
                {waxes.length > 1 && (
                  <IconButton variant="ghost" aria-label="убрать" onClick={() => setWaxes(waxes.filter((_, j) => j !== i))}>
                    <LuTrash2 />
                  </IconButton>
                )}
              </HStack>
            ))}
            <Box>
              <Button size="xs" variant="outline" onClick={() => setWaxes([...waxes, { materialId: undefined, share: 0 }])}>
                <LuPlus /> Ещё воск (композит)
              </Button>
            </Box>
          </Stack>
        </Field>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap="4" mt="4">
          <Field label="Отдушка">
            <Select value={fragranceId} onChange={(v) => setFragranceId(v || undefined)} placeholder="— без отдушки —" options={materialOptions(d, 'fragrance')} />
          </Field>
          <Field label="% отдушки" helper="по умолчанию из формы">
            <NumInput value={fPct} onChange={setFragrancePct} suffix="%" />
          </Field>
          <Field label="Краситель для воска">
            <Select value={dyeId} onChange={(v) => setDyeId(v || undefined)} placeholder="— без красителя —" options={materialOptions(d, 'waxDye')} />
          </Field>
          <Field label="% красителя (от воска)">
            <NumInput value={dyePct} onChange={setDyePct} suffix="%" />
          </Field>
          <Field label="Цвет">
            <TextInput value={dyeColor} onChange={setDyeColor} />
          </Field>
          <Field label="Краситель">
            <Chips
              value={dyeForm}
              onChange={(v) => setDyeForm(v as typeof dyeForm)}
              options={[
                { value: 'liquid', label: 'жидкий' },
                { value: 'solid', label: 'твёрдый' },
              ]}
            />
          </Field>
        </SimpleGrid>
      </Section>

      <Section title="Температуры">
        <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
          <Field label="Ввод отдушки">
            <NumInput value={tFrag} onChange={setTFrag} suffix="°C" />
          </Field>
          <Field label="Заливка">
            <NumInput value={tPour} onChange={setTPour} suffix="°C" />
          </Field>
          <Field label="Форма / подсвечник">
            <Stack gap="2">
              <Check checked={noHeat} onChange={setNoHeat}>
                не грела
              </Check>
              {!noHeat && <NumInput value={tMold} onChange={setTMold} suffix="°C" />}
            </Stack>
          </Field>
        </SimpleGrid>
      </Section>

      <Section title="Расчёт">
        <Text fontSize="sm" color="fg.muted" mb="2">
          Общая масса: <b>{fmt(calc.totalG)} г</b>
        </Text>
        <Table.ScrollArea>
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Компонент</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">Расчёт, г</Table.ColumnHeader>
                <Table.ColumnHeader>Факт, г</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {waxes.map((w, i) => (
                <Table.Row key={i}>
                  <Table.Cell>
                    {w.materialId ? d.materials[w.materialId]?.name : 'Воск'} {waxes.length > 1 && `(${fmt(w.share)}%)`}
                    <StockHint materialId={w.materialId} need={waxFact[i] ?? 0} />
                  </Table.Cell>
                  <Table.Cell textAlign="end">{fmt(calc.waxByPart[i])}</Table.Cell>
                  <Table.Cell minW="110px">
                    <NumInput size="sm" value={waxFact[i]} onChange={(v) => setFact({ ...fact, wax: waxes.map((_, j) => (j === i ? v : fact.wax[j])) })} />
                  </Table.Cell>
                </Table.Row>
              ))}
              <Table.Row>
                <Table.Cell>
                  Отдушка ({fmt(fPct)}%)
                  <StockHint materialId={fragranceId} need={fragFact} />
                </Table.Cell>
                <Table.Cell textAlign="end">{fmt(calc.fragranceG)}</Table.Cell>
                <Table.Cell>
                  <NumInput size="sm" value={fragFact} onChange={(v) => setFact({ ...fact, fragrance: v })} />
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell>
                  Краситель ({fmt(dyePct)}%)
                  <StockHint materialId={dyeId} need={dyeFact} />
                </Table.Cell>
                <Table.Cell textAlign="end">{fmt(calc.dyeG)}</Table.Cell>
                <Table.Cell>
                  <NumInput size="sm" value={dyeFact} onChange={(v) => setFact({ ...fact, dye: v })} />
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Root>
        </Table.ScrollArea>
        <Field label="Комментарий" mt="4">
          <TextArea value={comment} onChange={setComment} rows={2} />
        </Field>
      </Section>

      <Flex justify="flex-end" gap="2">
        <Button variant="ghost" onClick={() => nav(-1)}>
          Отмена
        </Button>
        <Button onClick={save} disabled={!sel.length}>
          Сохранить · {sel.length} св.
        </Button>
      </Flex>
    </>
  )
}
