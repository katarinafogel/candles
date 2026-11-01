import { Button, Flex, Input, SimpleGrid, Stack, Table, Text } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chips, Field, notify, NumInput, PageHeader, Section, Select, TextArea, TextInput } from '../components/ui'
import { MoldPicker } from '../components/MoldPicker'
import { StockHint } from '../components/StockHint'
import { calcPlaster, fmt, round2 } from '../lib/calc'
import { nowLocal, toIso } from '../lib/dates'
import { materialOptions, sortMolds } from '../lib/selectors'
import { useAppDispatch, useData } from '../store'
import { actions } from '../store/dataSlice'
import { isPlaster, plasterPurposes } from '../lib/labels'
import type { MixPart } from '../types'

type PartKey = 'water' | 'plaster' | 'plasticizer' | 'defoamer' | 'dye'

export default function NewMix() {
  const d = useData()
  const dispatch = useAppDispatch()
  const nav = useNavigate()
  const s = d.settings
  const molds = sortMolds(
    d,
    Object.values(d.molds).filter((m) => !m.archived && isPlaster(m.purpose)),
  )

  const [counts, setCounts] = useState<Record<string, number>>({})
  const [date, setDate] = useState(nowLocal())
  const [waterPct, setWaterPct] = useState<number | undefined>(s.plasterWaterPct)
  const [lossPct, setLossPct] = useState<number | undefined>(s.plasterLossPct)
  const [pct, setPct] = useState({ plasticizer: s.plasticizerPct, defoamer: s.defoamerPct, dye: s.plasterDyePct })
  const [mat, setMat] = useState<Partial<Record<PartKey, string>>>({})
  const [dyeColor, setDyeColor] = useState('')
  const [dyeForm, setDyeForm] = useState<'liquid' | 'solid' | undefined>('liquid')
  const [fact, setFact] = useState<Partial<Record<PartKey, number>>>({})
  const [comment, setComment] = useState('')

  const picked = molds.filter((m) => counts[m.id])
  const volume = picked.reduce((a, m) => a + m.waterVolumeMl * counts[m.id], 0)

  const calc = useMemo(
    () =>
      calcPlaster(volume, {
        density: s.plasterDensity,
        waterPct: waterPct ?? 0,
        lossPct: lossPct ?? 0,
        plasticizerPct: pct.plasticizer,
        dyePct: pct.dye,
        defoamerPct: pct.defoamer,
      }),
    [volume, waterPct, lossPct, pct, s.plasterDensity],
  )
  const calcOf: Record<PartKey, number> = {
    water: calc.waterG,
    plaster: calc.plasterG,
    plasticizer: calc.plasticizerG,
    defoamer: calc.defoamerG,
    dye: calc.dyeG,
  }
  const factOf = (k: PartKey) => fact[k] ?? calcOf[k]

  const rows: { key: PartKey; label: string; cats: Parameters<typeof materialOptions>[1][]; pctKey?: keyof typeof pct }[] = [
    { key: 'water', label: 'Вода', cats: [] },
    { key: 'plaster', label: 'Гипс', cats: ['plaster'] },
    { key: 'plasticizer', label: 'Пластификатор', cats: ['plasticizer'], pctKey: 'plasticizer' },
    { key: 'defoamer', label: 'Пеногаситель', cats: ['defoamer'], pctKey: 'defoamer' },
    { key: 'dye', label: 'Краситель', cats: ['plasterDye'], pctKey: 'dye' },
  ]

  function save() {
    const moldIds = picked.flatMap((m) => Array(counts[m.id]).fill(m.id) as string[])
    if (!moldIds.length) return notify('Отметьте хотя бы одну форму', 'warning')
    const part = (k: PartKey, p: number): MixPart => ({
      materialId: mat[k],
      pct: p,
      calcG: calcOf[k],
      factG: round2(factOf(k)),
    })
    dispatch(
      actions.createMix({
        date: toIso(date),
        moldIds,
        mix: {
          water: part('water', waterPct ?? 0),
          plaster: part('plaster', 100 - (waterPct ?? 0)),
          plasticizer: part('plasticizer', pct.plasticizer),
          defoamer: part('defoamer', pct.defoamer),
          dye: { ...part('dye', pct.dye), color: dyeColor, form: dyeForm },
          density: s.plasterDensity,
          lossPct: lossPct ?? 0,
          comment,
        },
      }),
    )
    notify(`Замес сохранён: изделий ${moldIds.length}`)
    nav('/holders?stage=drying')
  }

  return (
    <>
      <PageHeader title="Создать подсвечники" back="/" />
      <Section>
        <MoldPicker molds={molds} kinds={plasterPurposes} counts={counts} onChange={setCounts} limitCopies />
        <Text mt="3" fontSize="sm" color="fg.muted">
          Объём по воде: <b>{fmt(volume)} мл</b> · масса замеса: <b>{fmt(calc.totalG)} г</b>
        </Text>
      </Section>

      <Section title="Рецепт и расчёт">
        <SimpleGrid columns={{ base: 1, md: 3 }} gap="4" mb="4">
          <Field label="Дата и время">
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="% воды">
            <NumInput value={waterPct} onChange={setWaterPct} suffix="%" />
          </Field>
          <Field label="% раствора на потери">
            <NumInput value={lossPct} onChange={setLossPct} suffix="%" />
          </Field>
        </SimpleGrid>

        <Table.ScrollArea>
          <Table.Root size="sm" variant="line">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Компонент</Table.ColumnHeader>
                <Table.ColumnHeader>Материал</Table.ColumnHeader>
                <Table.ColumnHeader>%</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">Расчёт, г</Table.ColumnHeader>
                <Table.ColumnHeader>Факт, г</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((r) => (
                <Table.Row key={r.key}>
                  <Table.Cell fontWeight="medium">{r.label}</Table.Cell>
                  <Table.Cell minW="180px">
                    {r.cats.length ? (
                      <Stack gap="1">
                        <Select
                          size="sm"
                          value={mat[r.key]}
                          onChange={(v) => setMat({ ...mat, [r.key]: v || undefined })}
                          placeholder="— не списывать —"
                          options={materialOptions(d, ...r.cats)}
                        />
                        <StockHint materialId={mat[r.key]} need={factOf(r.key)} />
                      </Stack>
                    ) : (
                      <Text color="fg.subtle" fontSize="xs">
                        не учитывается на складе
                      </Text>
                    )}
                  </Table.Cell>
                  <Table.Cell minW="90px">
                    {r.pctKey ? (
                      <NumInput
                        size="sm"
                        value={pct[r.pctKey]}
                        onChange={(v) => setPct({ ...pct, [r.pctKey!]: v ?? 0 })}
                      />
                    ) : r.key === 'water' ? (
                      `${waterPct ?? '—'}`
                    ) : (
                      ''
                    )}
                  </Table.Cell>
                  <Table.Cell textAlign="end">{fmt(calcOf[r.key])}</Table.Cell>
                  <Table.Cell minW="100px">
                    <NumInput size="sm" value={factOf(r.key)} onChange={(v) => setFact({ ...fact, [r.key]: v })} />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Table.ScrollArea>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap="4" mt="4">
          <Field label="Цвет красителя">
            <TextInput value={dyeColor} onChange={setDyeColor} placeholder="например, терракота" />
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
        <Field label="Комментарий" mt="4">
          <TextArea value={comment} onChange={setComment} rows={2} />
        </Field>
      </Section>

      <Flex justify="flex-end" gap="2">
        <Button variant="ghost" onClick={() => nav(-1)}>
          Отмена
        </Button>
        <Button onClick={save} disabled={!picked.length}>
          Сохранить · {picked.reduce((a, m) => a + counts[m.id], 0)} подсвечн.
        </Button>
      </Flex>
    </>
  )
}
