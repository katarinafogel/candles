import { Badge, Box, Button, Flex, HStack, Input, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuPlus, LuShoppingCart, LuTriangleAlert } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { Check, Chips, Empty, Field, Modal, notify, NumInput, PageHeader, Section, Select, TextArea, TextInput } from '../components/ui'
import { fmt, isLow, stockOf } from '../lib/calc'
import { nowLocal, toIso } from '../lib/dates'
import { categoryLabel, categoryUnit, scentNotes, seasons, unitLabel } from '../lib/labels'
import { fallbackUse } from '../lib/selectors'
import { useAppDispatch, useData } from '../store'
import { actions } from '../store/dataSlice'
import type { Material, MaterialCategory, Unit } from '../types'

type Draft = Omit<Material, 'id' | 'movements'> & { id?: string; initialQty?: number }

export const blankMaterial = (category: MaterialCategory = 'plaster'): Draft => ({
  category,
  name: '',
  maker: '',
  unit: categoryUnit[category],
  review: '',
})

export function MaterialDialog({ material, onClose }: { material: Draft; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [m, setM] = useState<Draft>(material)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setM({ ...m, [k]: v })
  const isDye = m.category === 'plasterDye' || m.category === 'waxDye'
  return (
    <Modal
      open
      onClose={onClose}
      title={m.id ? m.name : 'Новый материал'}
      footer={
        <Button
          disabled={!m.name.trim()}
          onClick={() => {
            dispatch(actions.upsertMaterial(m))
            onClose()
          }}
        >
          Сохранить
        </Button>
      }
    >
      <Stack gap="4">
        <Field label="Категория">
          <Select
            value={m.category}
            onChange={(v) => setM({ ...m, category: v as MaterialCategory, unit: m.id ? m.unit : categoryUnit[v as MaterialCategory] })}
            options={Object.entries(categoryLabel).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        <Field label="Название">
          <TextInput value={m.name} onChange={(v) => set('name', v)} />
        </Field>
        <Field label="Производитель">
          <TextInput value={m.maker} onChange={(v) => set('maker', v)} />
        </Field>
        <SimpleGrid columns={2} gap="3">
          <Field label="Единица">
            <Select value={m.unit} onChange={(v) => set('unit', v as Unit)} options={Object.entries(unitLabel).map(([value, label]) => ({ value, label }))} />
          </Field>
          {!m.id && (
            <Field label="Начальный остаток">
              <NumInput value={m.initialQty} onChange={(v) => set('initialQty', v)} suffix={unitLabel[m.unit]} />
            </Field>
          )}
          <Field label="Порог «заканчивается»" helper="пусто — считается сам">
            <NumInput value={m.thresholdOverride} onChange={(v) => set('thresholdOverride', v)} suffix={unitLabel[m.unit]} />
          </Field>
        </SimpleGrid>
        {m.category === 'wick' && (
          <Field label="Ширина фитиля">
            <Chips
              value={m.wickWidthCm ? String(m.wickWidthCm) : undefined}
              onChange={(v) => set('wickWidthCm', v ? (Number(v) as 0.5 | 1) : undefined)}
              options={[
                { value: '0.5', label: '0,5 см' },
                { value: '1', label: '1 см' },
              ]}
            />
          </Field>
        )}
        {isDye && (
          <SimpleGrid columns={2} gap="3">
            <Field label="Цвет">
              <TextInput value={m.color ?? ''} onChange={(v) => set('color', v)} />
            </Field>
            <Field label="Форма">
              <Chips
                value={m.dyeForm}
                onChange={(v) => set('dyeForm', v as Material['dyeForm'])}
                options={[
                  { value: 'liquid', label: 'жидкий' },
                  { value: 'solid', label: 'твёрдый' },
                ]}
              />
            </Field>
          </SimpleGrid>
        )}
        {m.category === 'fragrance' && (
          <>
            <Field label="Сезоны">
              <Chips multi value={m.seasons ?? []} onChange={(v) => set('seasons', (v as string[]) ?? [])} options={seasons.map((s) => ({ value: s, label: s }))} />
            </Field>
            <Field label="Ноты">
              <Chips multi value={m.notes ?? []} onChange={(v) => set('notes', (v as string[]) ?? [])} options={[...new Set([...scentNotes, ...(m.notes ?? [])])].map((s) => ({ value: s, label: s }))} />
            </Field>
          </>
        )}
        <Check checked={!!m.toBuy} onChange={(v) => set('toBuy', v || undefined)}>
          Нужно докупить
        </Check>
        <Field label="Оценка">
          <Chips
            value={m.rating ? String(m.rating) : undefined}
            onChange={(v) => set('rating', v ? Number(v) : undefined)}
            options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: '★'.repeat(n) }))}
          />
        </Field>
        <Field label="Отзыв о материале">
          <TextArea value={m.review} onChange={(v) => set('review', v)} placeholder="понравилось или нет, особенности работы" />
        </Field>
      </Stack>
    </Modal>
  )
}

export function PurchaseDialog({ materialId, onClose }: { materialId: string; onClose: () => void }) {
  const d = useData()
  const dispatch = useAppDispatch()
  const m = d.materials[materialId]
  const [date, setDate] = useState(nowLocal())
  const [qty, setQty] = useState<number>()
  const [price, setPrice] = useState<number>()
  const [link, setLink] = useState('')
  const [comment, setComment] = useState('')
  return (
    <Modal
      open
      onClose={onClose}
      title={`Закупка · ${m.name}`}
      footer={
        <Button
          disabled={!qty}
          onClick={() => {
            dispatch(actions.purchase({ materialId, date: toIso(date), qty: qty!, price, link, comment }))
            notify('Закупка внесена')
            onClose()
          }}
        >
          Сохранить
        </Button>
      }
    >
      <Stack gap="4">
        <Field label="Дата">
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <SimpleGrid columns={2} gap="3">
          <Field label="Количество">
            <NumInput value={qty} onChange={setQty} suffix={unitLabel[m.unit]} />
          </Field>
          <Field label="Цена за всё" helper={qty && price ? `${fmt(price / qty, 3)} ₽ за ${unitLabel[m.unit]}` : 'необязательно'}>
            <NumInput value={price} onChange={setPrice} suffix="₽" />
          </Field>
        </SimpleGrid>
        <Field label="Ссылка">
          <TextInput value={link} onChange={setLink} />
        </Field>
        <Field label="Комментарий">
          <TextArea value={comment} onChange={setComment} rows={2} />
        </Field>
      </Stack>
    </Modal>
  )
}

export function InventoryDialog({ materialId, onClose }: { materialId: string; onClose: () => void }) {
  const d = useData()
  const dispatch = useAppDispatch()
  const m = d.materials[materialId]
  const [actual, setActual] = useState<number | undefined>(stockOf(m))
  const [comment, setComment] = useState('')
  return (
    <Modal
      open
      onClose={onClose}
      title={`Инвентаризация · ${m.name}`}
      footer={
        <Button
          disabled={actual == null}
          onClick={() => {
            dispatch(actions.inventory({ materialId, date: new Date().toISOString(), actual: actual!, comment }))
            notify('Остаток исправлен')
            onClose()
          }}
        >
          Сохранить
        </Button>
      }
    >
      <Stack gap="4">
        <Text fontSize="sm" color="fg.muted">
          По учёту: {fmt(stockOf(m))} {unitLabel[m.unit]}
        </Text>
        <Field label="Фактический остаток">
          <NumInput value={actual} onChange={setActual} suffix={unitLabel[m.unit]} />
        </Field>
        <Field label="Комментарий">
          <TextArea value={comment} onChange={setComment} rows={2} />
        </Field>
      </Stack>
    </Modal>
  )
}

export default function Stock() {
  const d = useData()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [onlyLow, setOnlyLow] = useState(false)
  const [onlyBuy, setOnlyBuy] = useState(false)
  const [add, setAdd] = useState(false)
  const [buy, setBuy] = useState<string>()
  const [inv, setInv] = useState<string>()

  const all = Object.values(d.materials).filter((m) => !m.archived)
  const filtered = all.filter(
    (m) =>
      (!q || `${m.name} ${m.maker} ${(m.notes ?? []).join(' ')} ${(m.seasons ?? []).join(' ')}`.toLowerCase().includes(q.toLowerCase())) &&
      (!onlyLow || isLow(m, fallbackUse(d, m))) &&
      (!onlyBuy || !!m.toBuy),
  )
  const cats = (Object.keys(categoryLabel) as MaterialCategory[]).filter((c) => filtered.some((m) => m.category === c))

  return (
    <>
      <PageHeader title="Склад">
        <Button size="sm" onClick={() => setAdd(true)}>
          <LuPlus /> Материал
        </Button>
      </PageHeader>
      <Flex gap="2" mb="4" wrap="wrap">
        <Input flex="1" minW="220px" placeholder="Поиск: название, нота, сезон" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant={onlyLow ? 'solid' : 'outline'} onClick={() => setOnlyLow(!onlyLow)} flexShrink={0}>
          <LuTriangleAlert /> На исходе
        </Button>
        <Button variant={onlyBuy ? 'solid' : 'outline'} onClick={() => setOnlyBuy(!onlyBuy)} flexShrink={0}>
          <LuShoppingCart /> Купить · {all.filter((m) => m.toBuy).length}
        </Button>
      </Flex>
      {!filtered.length && <Empty>Материалов пока нет.</Empty>}
      {cats.map((cat) => (
        <Section key={cat} title={categoryLabel[cat]}>
          <Stack gap="0">
            {filtered
              .filter((m) => m.category === cat)
              .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
              .map((m) => {
                const st = stockOf(m)
                const low = isLow(m, fallbackUse(d, m))
                return (
                  <Flex key={m.id} align="center" gap="2" py="2" borderBottomWidth="1px" borderColor="border.muted" _last={{ borderBottomWidth: 0 }}>
                    <Box flex="1" minW="0" cursor="pointer" onClick={() => nav(`/stock/${m.id}`)}>
                      <HStack gap="2">
                        <Text truncate fontWeight="medium">
                          {m.name}
                        </Text>
                        {m.rating && (
                          <Text fontSize="xs" color="emerald.300">
                            {'★'.repeat(m.rating)}
                          </Text>
                        )}
                      </HStack>
                      <Text fontSize="xs" color="fg.muted" truncate>
                        {[m.maker, m.color, ...(m.notes ?? []), ...(m.seasons ?? [])].filter(Boolean).join(' · ')}
                      </Text>
                    </Box>
                    <HStack gap="1">
                      {m.toBuy && <Badge colorPalette="blue">купить</Badge>}
                      {low && <Badge colorPalette={st < 0 ? 'red' : 'orange'}>мало</Badge>}
                      <Text fontSize="sm" color={st < 0 ? 'red.400' : undefined} whiteSpace="nowrap">
                        {fmt(st)} {unitLabel[m.unit]}
                      </Text>
                    </HStack>
                    <HStack gap="1" display={{ base: 'none', sm: 'flex' }}>
                      <Button size="xs" variant="outline" onClick={() => setBuy(m.id)}>
                        Закупка
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => setInv(m.id)}>
                        Инвент.
                      </Button>
                    </HStack>
                  </Flex>
                )
              })}
          </Stack>
        </Section>
      ))}
      {add && <MaterialDialog material={blankMaterial()} onClose={() => setAdd(false)} />}
      {buy && <PurchaseDialog materialId={buy} onClose={() => setBuy(undefined)} />}
      {inv && <InventoryDialog materialId={inv} onClose={() => setInv(undefined)} />}
    </>
  )
}
