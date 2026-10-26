import { Badge, Box, Button, CloseButton, Flex, Heading, HStack, Input, InputGroup, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuArchive, LuArchiveRestore, LuPencil, LuPlus, LuSearch } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { Check, Chips, Empty, Field, Modal, notify, NumInput, PageHeader, StarRating, TextArea, TextInput } from '../components/ui'
import { fmt } from '../lib/calc'
import { isPlaster, moldPurposeLabel, moldPurposePlural, wickSchemeLabel } from '../lib/labels'
import { moldStats, sortMolds } from '../lib/selectors'
import { useAppDispatch, useData } from '../store'
import { actions } from '../store/dataSlice'
import type { Mold, MoldPurpose, WickScheme } from '../types'

export const blankMold = (fragrancePct: number): Omit<Mold, 'id'> => ({
  name: '',
  purpose: 'holder',
  copies: 1,
  waterVolumeMl: 0,
  waterPct: 25,
  waxCapacityG: 0,
  fragrancePct,
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
        <Field
          label="Что отливаем"
          helper={isPlaster(m.purpose) ? 'из гипса · в новом замесе' : 'из воска · в свечах и декоре'}
        >
          <Chips
            value={m.purpose}
            onChange={(v) => v && set('purpose', v as MoldPurpose)}
            options={Object.entries(moldPurposeLabel).map(([value, label]) => ({ value: value as MoldPurpose, label }))}
          />
        </Field>
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
          В архиве — порвалась или больше не нужна, не показывать при заливке
        </Check>
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
        if (mold.archived) notify(`«${mold.name}» снова в работе`)
        else
          notify(`«${mold.name}» в архиве`, 'success', undefined, {
            label: 'Вернуть',
            onClick: () => dispatch(actions.upsertMold(mold)),
          })
      }}
    >
      {mold.archived ? <LuArchiveRestore /> : <LuArchive />} {mold.archived ? 'Из архива' : 'В архив'}
    </Button>
  )
}

const normalize = (s: string) => s.toLowerCase().replace(/ё/g, 'е')

export default function Molds() {
  const d = useData()
  const nav = useNavigate()
  const [edit, setEdit] = useState<(Omit<Mold, 'id'> & { id?: string }) | null>(null)
  const dispatch = useAppDispatch()
  const [show, setShow] = useState<'active' | 'archive' | 'all'>('active')
  const all = Object.values(d.molds)
  const archived = all.filter((m) => m.archived).length
  const [query, setQuery] = useState('')
  const q = normalize(query.trim())
  const list = sortMolds(
    d,
    all.filter((m) => (show === 'all' || (show === 'archive') === !!m.archived) && (!q || normalize(m.name).includes(q))),
  )
  // Grouped by type in a fixed order; inside a group the best-rated and most used come first.
  const groups = (Object.keys(moldPurposeLabel) as MoldPurpose[])
    .map((p) => ({ purpose: p, molds: list.filter((m) => m.purpose === p) }))
    .filter((g) => g.molds.length)

  return (
    <>
      <PageHeader title="Силиконовые формы" back="/more">
        <Button size="sm" onClick={() => setEdit(blankMold(d.settings.fragrancePct))}>
          <LuPlus /> Форма
        </Button>
      </PageHeader>
      <InputGroup mb="3" startElement={<LuSearch />} endElement={query && <CloseButton size="xs" onClick={() => setQuery('')} aria-label="Очистить" />}>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по названию" />
      </InputGroup>
      <Box mb="4">
        <Chips
          value={show}
          onChange={(v) => setShow((v as typeof show) ?? 'active')}
          options={[
            { value: 'active', label: `Активные · ${all.length - archived}` },
            { value: 'archive', label: `Архив · ${archived}` },
            { value: 'all', label: `Все · ${all.length}` },
          ]}
        />
      </Box>
      {!list.length && (
        <Empty>
          {q
            ? `Не нашлось форм с «${query.trim()}» в названии.`
            : all.length
            ? show === 'archive'
              ? 'В архиве пусто.'
              : 'Все формы в архиве.'
            : 'Форм пока нет. Добавьте вручную или импортируйте из таблицы в настройках.'}
        </Empty>
      )}
      {groups.map((g) => (
        <Box key={g.purpose} mb="6">
          <Heading size="lg" fontWeight="semibold" color="ember.100" mb="2">
            {moldPurposePlural[g.purpose]} · {g.molds.length}
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
            {g.molds.map((m) => {
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
                      {m.archived && <Badge colorPalette="gray">в архиве</Badge>}
                    </HStack>
                  </Flex>
                  <Text fontSize="xs" color="fg.muted" mt="1">
                    {m.id}
                    {isPlaster(m.purpose) && ` · ${m.waterVolumeMl} мл · ${m.waterPct}% воды`}
                    {m.waxCapacityG ? ` · воск ${m.waxCapacityG} г` : ''}
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
        </Box>
      ))}
      {edit && <MoldDialog mold={edit} onClose={() => setEdit(null)} />}
    </>
  )
}
