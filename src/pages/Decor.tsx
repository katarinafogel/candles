import { Badge, Box, Button, Flex, Input, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuPlus } from 'react-icons/lu'
import { StockHint } from '../components/StockHint'
import { Chips, Empty, Field, Modal, notify, NumInput, PageHeader, Select, TextArea, TextInput } from '../components/ui'
import { fmt, fmtDate } from '../lib/calc'
import { nowLocal, toIso } from '../lib/dates'
import { decorKindLabel } from '../lib/labels'
import { byId, materialOptions } from '../lib/selectors'
import { useAppDispatch, useData } from '../store'
import { actions } from '../store/dataSlice'
import type { DecorKind } from '../types'

function NewBatch({ onClose }: { onClose: () => void }) {
  const d = useData()
  const dispatch = useAppDispatch()
  const [kind, setKind] = useState<DecorKind>('wax')
  const [name, setName] = useState('')
  const [date, setDate] = useState(nowLocal())
  const [waxMaterialId, setWax] = useState<string>()
  const [waxG, setWaxG] = useState<number>()
  const [dyeMaterialId, setDye] = useState<string>()
  const [dyePct, setDyePct] = useState<number>()
  const [moldId, setMoldId] = useState<string>()
  const [qty, setQty] = useState<number>()
  const [comment, setComment] = useState('')
  return (
    <Modal
      open
      onClose={onClose}
      title="Новая партия декора"
      footer={
        <Button
          disabled={!name.trim() || !qty}
          onClick={() => {
            dispatch(
              actions.addDecorBatch({
                kind,
                name,
                date: toIso(date),
                waxMaterialId: kind === 'wax' ? waxMaterialId : undefined,
                waxG: kind === 'wax' ? waxG : undefined,
                dyeMaterialId: kind === 'wax' ? dyeMaterialId : undefined,
                dyePct: kind === 'wax' ? dyePct : undefined,
                moldId: kind === 'wax' ? moldId : undefined,
                qty: qty!,
                comment,
              }),
            )
            notify('Партия декора добавлена')
            onClose()
          }}
        >
          Сохранить
        </Button>
      }
    >
      <Stack gap="4">
        <Field label="Вид">
          <Chips value={kind} onChange={(v) => v && setKind(v as DecorKind)} options={Object.entries(decorKindLabel).map(([value, label]) => ({ value: value as DecorKind, label }))} />
        </Field>
        {kind !== 'wax' && (
          <Text fontSize="sm" color="fg.muted">
            Невосковой декор удобнее вести на складе как материал категории «Декор». Партия здесь — если хотите учитывать его отдельно.
          </Text>
        )}
        <Field label="Название">
          <TextInput value={name} onChange={setName} placeholder="листики, ягоды" />
        </Field>
        <Field label="Дата">
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {kind === 'wax' && (
          <>
            <SimpleGrid columns={2} gap="3">
              <Field label="Воск">
                <Select value={waxMaterialId} onChange={(v) => setWax(v || undefined)} placeholder="—" options={materialOptions(d, 'wax')} />
                <StockHint materialId={waxMaterialId} need={waxG ?? 0} />
              </Field>
              <Field label="Сколько воска">
                <NumInput value={waxG} onChange={setWaxG} suffix="г" />
              </Field>
              <Field label="Краситель">
                <Select value={dyeMaterialId} onChange={(v) => setDye(v || undefined)} placeholder="—" options={materialOptions(d, 'waxDye')} />
              </Field>
              <Field label="% красителя">
                <NumInput value={dyePct} onChange={setDyePct} suffix="%" />
              </Field>
            </SimpleGrid>
            <Field label="Форма">
              <Select
                value={moldId}
                onChange={(v) => setMoldId(v || undefined)}
                placeholder="—"
                options={Object.values(d.molds)
                  .filter((m) => m.purpose === 'decor')
                  .map((m) => ({ value: m.id, label: m.name }))}
              />
            </Field>
          </>
        )}
        <Field label="Количество">
          <NumInput value={qty} onChange={setQty} suffix="шт" />
        </Field>
        <Field label="Комментарий">
          <TextArea value={comment} onChange={setComment} rows={2} />
        </Field>
      </Stack>
    </Modal>
  )
}

export default function Decor() {
  const d = useData()
  const [add, setAdd] = useState(false)
  const list = byId(d.decor)
  return (
    <>
      <PageHeader title="Декор" back="/more">
        <Button size="sm" onClick={() => setAdd(true)}>
          <LuPlus /> Партия
        </Button>
      </PageHeader>
      {!list.length && <Empty>Партий декора пока нет.</Empty>}
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
        {list.map((b) => {
          const left = b.qty - b.used
          return (
            <Box key={b.id} p="3" borderWidth="1px" borderColor="border" bg="bg.subtle" borderRadius="l3">
              <Flex justify="space-between" gap="2">
                <Text fontWeight="semibold">
                  {b.id} · {b.name}
                </Text>
                <Badge colorPalette={left <= 0 ? 'red' : 'emerald'}>
                  {left} из {b.qty} шт
                </Badge>
              </Flex>
              <Text fontSize="xs" color="fg.muted" mt="1">
                {decorKindLabel[b.kind]} · {fmtDate(b.date)}
                {b.waxMaterialId && ` · ${d.materials[b.waxMaterialId]?.name} ${fmt(b.waxG)} г`}
                {b.dyeMaterialId && ` · ${d.materials[b.dyeMaterialId]?.name} ${fmt(b.dyePct)}%`}
                {b.moldId && ` · форма ${d.molds[b.moldId]?.name}`}
              </Text>
              {b.comment && <Text fontSize="sm" mt="1">{b.comment}</Text>}
            </Box>
          )
        })}
      </SimpleGrid>
      {add && <NewBatch onClose={() => setAdd(false)} />}
    </>
  )
}
