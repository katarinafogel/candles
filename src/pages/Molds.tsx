import { Badge, Box, Button, Flex, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuArchive, LuArchiveRestore, LuPencil, LuPlus } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { Check, Chips, Empty, Field, Modal, notify, NumInput, PageHeader, Select, StarRating, TextArea, TextInput } from '../components/ui'
import { fmt } from '../lib/calc'
import { moldPurposeLabel, moldStatusLabel, wickSchemeLabel } from '../lib/labels'
import { moldStats, sortMolds } from '../lib/selectors'
import { useAppDispatch, useData } from '../store'
import { actions } from '../store/dataSlice'
import type { Mold, MoldPurpose, MoldStatus, WickScheme } from '../types'

export const blankMold = (fragrancePct: number): Omit<Mold, 'id'> => ({
  name: '',
  purpose: 'holder',
  hasLid: false,
  copies: 1,
  waterVolumeMl: 0,
  waterPct: 25,
  waxCapacityG: 0,
  fragrancePct,
  status: 'active',
  comment: '',
})

export function MoldDialog({ mold, onClose }: { mold: Omit<Mold, 'id'> & { id?: string }; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [m, setM] = useState(mold)
  const set = <K extends keyof Mold>(k: K, v: Mold[K]) => setM({ ...m, [k]: v })
  return (
    <Modal
      open
      onClose={onClose}
      title={m.id ? `Форма ${m.id}` : 'Новая форма'}
      footer={
        <Button
          disabled={!m.name.trim()}
          onClick={() => {
            dispatch(actions.upsertMold(m))
            onClose()
          }}
        >
          Сохранить
        </Button>
      }
    >
      <Stack gap="4">
        <Field label="Название">
          <TextInput value={m.name} onChange={(v) => set('name', v)} />
        </Field>
        <Field label="Назначение">
          <Chips
            value={m.purpose}
            onChange={(v) => v && set('purpose', v as MoldPurpose)}
            options={Object.entries(moldPurposeLabel).map(([value, label]) => ({ value: value as MoldPurpose, label }))}
          />
        </Field>
        <Check checked={m.hasLid} onChange={(v) => set('hasLid', v)}>
          Есть крышка (льётся отдельно)
        </Check>
        <SimpleGrid columns={2} gap="3">
          <Field label="Число копий">
            <NumInput value={m.copies} onChange={(v) => set('copies', Math.max(1, v ?? 1))} />
          </Field>
          <Field label="Объём по воде">
            <NumInput value={m.waterVolumeMl} onChange={(v) => set('waterVolumeMl', v ?? 0)} suffix="мл" />
          </Field>
          <Field label="% воды по умолчанию">
            <NumInput value={m.waterPct} onChange={(v) => set('waterPct', v ?? 0)} suffix="%" />
          </Field>
          <Field label="Ёмкость под воск">
            <NumInput value={m.waxCapacityG} onChange={(v) => set('waxCapacityG', v ?? 0)} suffix="г" />
          </Field>
          <Field label="% отдушки по умолчанию">
            <NumInput value={m.fragrancePct} onChange={(v) => set('fragrancePct', v ?? 0)} suffix="%" />
          </Field>
          <Field label="Длина фитиля">
            <NumInput
              value={m.defaultWick?.lengthCm}
              onChange={(v) => set('defaultWick', v ? { scheme: m.defaultWick?.scheme ?? 'double05', lengthCm: v } : undefined)}
              suffix="см"
            />
          </Field>
        </SimpleGrid>
        <Field label="Схема фитиля по умолчанию">
          <Chips
            value={m.defaultWick?.scheme}
            onChange={(v) => v && set('defaultWick', { scheme: v as WickScheme, lengthCm: m.defaultWick?.lengthCm ?? 0 })}
            options={Object.entries(wickSchemeLabel).map(([value, label]) => ({ value: value as WickScheme, label }))}
          />
        </Field>
        <Field label="Оценка" helper="чем больше звёзд, тем выше форма в списках">
          <StarRating value={m.rating} onChange={(v) => set('rating', v)} />
        </Field>
        <Check checked={!!m.archived} onChange={(v) => set('archived', v || undefined)}>
          В архиве — не показывать в новом замесе
        </Check>
        <Field label="Статус">
          <Select
            value={m.status}
            onChange={(v) => set('status', v as MoldStatus)}
            options={Object.entries(moldStatusLabel).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        <Field label="Комментарий">
          <TextArea value={m.comment} onChange={(v) => set('comment', v)} />
        </Field>
      </Stack>
    </Modal>
  )
}

export function ArchiveButton({ mold, size = 'xs' }: { mold: Mold; size?: 'xs' | 'sm' }) {
  const dispatch = useAppDispatch()
  return (
    <Button
      size={size}
      variant={size === 'xs' ? 'ghost' : 'outline'}
      onClick={(e) => {
        e.stopPropagation()
        dispatch(actions.upsertMold({ ...mold, archived: mold.archived ? undefined : true }))
        notify(mold.archived ? `«${mold.name}» снова в работе` : `«${mold.name}» в архиве`)
      }}
    >
      {mold.archived ? <LuArchiveRestore /> : <LuArchive />} {mold.archived ? 'Из архива' : 'В архив'}
    </Button>
  )
}

export default function Molds() {
  const d = useData()
  const nav = useNavigate()
  const [edit, setEdit] = useState<(Omit<Mold, 'id'> & { id?: string }) | null>(null)
  const dispatch = useAppDispatch()
  const [showArchive, setShowArchive] = useState(false)
  const hidden = (m: Mold) => !!m.archived || m.status !== 'active'
  const all = Object.values(d.molds)
  const list = sortMolds(
    d,
    all.filter((m) => showArchive || !hidden(m)),
  )
  const hiddenCount = all.filter(hidden).length

  return (
    <>
      <PageHeader title="Силиконовые формы" back="/more">
        <Button size="sm" onClick={() => setEdit(blankMold(d.settings.fragrancePct))}>
          <LuPlus /> Форма
        </Button>
      </PageHeader>
      <Box mb="3">
        <Check checked={showArchive} onChange={setShowArchive}>
          <Text fontSize="sm">Показать архив, порванные и списанные · {hiddenCount}</Text>
        </Check>
      </Box>
      {!list.length && <Empty>Форм пока нет. Добавьте вручную или импортируйте из таблицы в настройках.</Empty>}
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
        {list.map((m) => {
          const st = moldStats(d, m.id)
          return (
            <Box
              key={m.id}
              p="3"
              borderWidth="1px"
              borderColor="border"
              bg="bg.subtle"
              borderRadius="l3"
              cursor="pointer"
              _hover={{ borderColor: 'emerald.700' }}
              onClick={() => nav(`/molds/${m.id}`)}
            >
              <Flex justify="space-between" gap="2">
                <Text fontWeight="semibold" truncate minW="0">
                  {m.name}
                </Text>
                <HStack gap="1">
                  <Badge variant="subtle">{moldPurposeLabel[m.purpose]}</Badge>
                  {m.archived && <Badge colorPalette="gray">в архиве</Badge>}
                  {m.status !== 'active' && <Badge colorPalette="red">{moldStatusLabel[m.status]}</Badge>}
                </HStack>
              </Flex>
              <Text fontSize="xs" color="fg.muted" mt="1">
                {m.id} · {m.waterVolumeMl} мл · {m.waterPct}% воды · воск {m.waxCapacityG} г
                {m.defaultWick ? ` · ${wickSchemeLabel[m.defaultWick.scheme]} ${fmt(m.defaultWick.lengthCm)} см` : ''}
              </Text>
              <Text fontSize="xs" color="fg.muted">
                отлито {st.holders.length} · брак {st.defectPct != null ? `${fmt(st.defectPct, 0)}%` : '—'} · оценка{' '}
                {st.avgOverall != null ? fmt(st.avgOverall, 1) : '—'}
              </Text>
              <Flex mt="2" align="center" justify="space-between" gap="2" wrap="wrap">
                <StarRating size="sm" value={m.rating} onChange={(v) => dispatch(actions.upsertMold({ ...m, rating: v }))} />
                <HStack gap="1">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEdit(m)
                    }}
                  >
                    <LuPencil /> Изменить
                  </Button>
                  <ArchiveButton mold={m} />
                </HStack>
              </Flex>
            </Box>
          )
        })}
      </SimpleGrid>
      {edit && <MoldDialog mold={edit} onClose={() => setEdit(null)} />}
    </>
  )
}
