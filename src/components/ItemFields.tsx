import { Box, Button, Flex, HStack, IconButton, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { LuPlus, LuTrash2 } from 'react-icons/lu'
import { fmt } from '../lib/calc'
import type { CandleForm, HolderForm } from '../lib/itemForms'
import { decorKindLabel, varnishKindLabel, wickSchemeLabel } from '../lib/labels'
import { materialOptions } from '../lib/selectors'
import { useData } from '../store'
import { varnishTarget } from '../store/dataSlice'
import type { MaterialCategory, VarnishKind, WickScheme } from '../types'
import { Check, Chips, Field, LeafMark, NumInput, Section, Select, TextArea, TextInput } from './ui'

const dyeForms = [
  { value: 'liquid' as const, label: 'жидкий' },
  { value: 'solid' as const, label: 'твёрдый' },
]

function LayerLeaves({ value, target, onChange }: { value: number; target: number; onChange: (n: number) => void }) {
  return (
    <Flex gap="0" wrap="wrap" align="center">
      {Array.from({ length: Math.max(target, value) }, (_, i) => (
        <Box as="button" key={i} p="0.5" cursor="pointer" aria-label={`Слой ${i + 1}`} onClick={() => onChange(i + 1 === value ? i : i + 1)}>
          <LeafMark on={i < value} size={26} />
        </Box>
      ))}
      <Text ml="2" fontSize="sm" color="fg.muted">
        {value}/{target}
      </Text>
    </Flex>
  )
}

export interface HolderSections {
  mix?: boolean
  varnishIn?: boolean
  painting?: boolean
  varnishOut?: boolean
  dampers?: boolean
}

/** Everything tracked about a holder; all of it is optional. `show` leaves out what the item hasn't reached. */
export function HolderFields({ f, onChange, show, showMixComment }: { f: HolderForm; onChange: (f: HolderForm) => void; show: HolderSections; showMixComment?: boolean }) {
  const d = useData()
  const set = (patch: Partial<HolderForm>) => onChange({ ...f, ...patch })
  const part = (key: keyof HolderForm['grams'], label: string, cat?: MaterialCategory) => (
    <Field label={label}>
      <HStack w="100%">
        {cat && (
          <Select value={f.mat[key]} onChange={(v) => set({ mat: { ...f.mat, [key]: v || undefined } })} placeholder="— материал —" options={materialOptions(d, cat)} />
        )}
        <NumInput width={cat ? '130px' : undefined} value={f.grams[key]} onChange={(v) => set({ grams: { ...f.grams, [key]: v } })} suffix="г" />
      </HStack>
    </Field>
  )
  return (
    <>
      {show.mix && (
        <Section title="Рецепт гипса">
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
            {part('water', 'Вода')}
            {part('plaster', 'Гипс', 'plaster')}
            {part('plasticizer', 'Пластификатор', 'plasticizer')}
            {part('defoamer', 'Пеногаситель', 'defoamer')}
            {part('dye', 'Краситель', 'plasterDye')}
            <Field label="Цвет красителя">
              <TextInput value={f.dyeColor} onChange={(v) => set({ dyeColor: v })} />
            </Field>
            <Field label="Вид красителя">
              <Chips value={f.dyeForm} onChange={(v) => set({ dyeForm: v as HolderForm['dyeForm'] })} options={dyeForms} />
            </Field>
          </SimpleGrid>
          {showMixComment && (
            <Field label="Комментарий к замесу" mt="4">
              <TextArea value={f.mixComment} onChange={(v) => set({ mixComment: v })} rows={2} />
            </Field>
          )}
        </Section>
      )}
      {(show.varnishIn || show.painting || show.varnishOut || show.dampers) && (
        <Section title="Отделка">
          <Stack gap="4">
            {show.varnishIn && (
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                <Field label="Лак внутри">
                  <Select value={f.varnishInMat} onChange={(v) => set({ varnishInMat: v || undefined })} placeholder="— материал —" options={materialOptions(d, 'varnishIn')} />
                </Field>
                <Field label="Слои лака внутри">
                  <LayerLeaves value={f.varnishInLayers} target={varnishTarget(d, 'varnishIn')} onChange={(n) => set({ varnishInLayers: n })} />
                </Field>
              </SimpleGrid>
            )}
            {show.painting && (
              <>
                <Field label="Роспись">
                  <TextArea value={f.description} onChange={(v) => set({ description: v })} rows={2} />
                </Field>
                {materialOptions(d, 'paint').length > 0 && (
                  <Field label="Краски">
                    <Chips multi value={f.paintIds} onChange={(v) => set({ paintIds: (v as string[]) ?? [] })} options={materialOptions(d, 'paint')} />
                  </Field>
                )}
              </>
            )}
            {show.varnishOut && (
              <>
                <Field label="Покрытие снаружи">
                  <Chips
                    value={f.varnishOutKind}
                    onChange={(v) => v && set({ varnishOutKind: v as VarnishKind })}
                    options={Object.entries(varnishKindLabel).map(([value, label]) => ({ value: value as VarnishKind, label }))}
                  />
                </Field>
                <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                  <Field label={f.varnishOutKind === 'wax' ? 'Воск снаружи' : 'Лак снаружи'}>
                    <Select value={f.varnishOutMat} onChange={(v) => set({ varnishOutMat: v || undefined })} placeholder="— материал —" options={materialOptions(d, 'varnishOut', 'wax')} />
                  </Field>
                  <Field label="Слои снаружи">
                    <LayerLeaves value={f.varnishOutLayers} target={varnishTarget(d, 'varnishOut')} onChange={(n) => set({ varnishOutLayers: n })} />
                  </Field>
                </SimpleGrid>
              </>
            )}
            {show.dampers && (
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                <Field label="Демпферы">
                  <Select value={f.dampersMat} onChange={(v) => set({ dampersMat: v || undefined })} placeholder="— материал —" options={materialOptions(d, 'cork')} />
                </Field>
                <Field label="Количество на подсвечник">
                  <NumInput value={f.dampersCount} onChange={(v) => set({ dampersCount: v })} suffix="шт" />
                </Field>
              </SimpleGrid>
            )}
          </Stack>
        </Section>
      )}
    </>
  )
}

export function HolderCommentField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Комментарий">
      <TextArea value={value} onChange={onChange} rows={2} />
    </Field>
  )
}

export interface CandleSections {
  pour?: boolean
  decor?: boolean
}

/** Everything tracked about a candle; all of it is optional. `wickHint` says where an empty wick comes from. */
export function CandleFields({ f, onChange, show, wickHint, sharedPour }: { f: CandleForm; onChange: (f: CandleForm) => void; show: CandleSections; wickHint?: string; sharedPour?: string }) {
  const d = useData()
  const set = (patch: Partial<CandleForm>) => onChange({ ...f, ...patch })
  const shareSum = f.waxes.reduce((a, w) => a + w.share, 0)
  const setWax = (i: number, patch: Partial<CandleForm['waxes'][number]>) => set({ waxes: f.waxes.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  const decorOptions = [
    ...Object.values(d.decor)
      .filter((b) => b.qty - b.used > 0 || f.decor.some((x) => x.key === `d:${b.id}`))
      .map((b) => ({ value: `d:${b.id}`, label: `${b.id} · ${b.name} (${decorKindLabel[b.kind]}, ост. ${b.qty - b.used})` })),
    ...materialOptions(d, 'decor').map((o) => ({ ...o, value: `m:${o.value}` })),
  ]
  const setDecor = (i: number, patch: Partial<CandleForm['decor'][number]>) => set({ decor: f.decor.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  return (
    <>
      <Section title="Свеча">
        <Stack gap="4">
          <Field label="Название / дизайн" helper={wickHint ? 'пусто — как у формы; видно получателю' : 'видно получателю'}>
            <TextInput value={f.name} onChange={(v) => set({ name: v })} />
          </Field>
          <Field label="Схема фитиля" helper={wickHint}>
            <Chips
              value={f.scheme}
              onChange={(v) => {
                if (v || wickHint) set({ scheme: v as WickScheme | undefined })
              }}
              options={Object.entries(wickSchemeLabel).map(([value, label]) => ({ value: value as WickScheme, label }))}
            />
          </Field>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
            <Field label="Длина фитиля" helper={wickHint}>
              <NumInput value={f.lengthCm} onChange={(v) => set({ lengthCm: v })} suffix="см" />
            </Field>
            <Field label="Инструкция">
              <Select
                value={f.instructionId}
                onChange={(v) => set({ instructionId: v || undefined })}
                placeholder="— без инструкции —"
                options={Object.values(d.instructions).map((i) => ({ value: i.id, label: i.title }))}
              />
            </Field>
          </SimpleGrid>
          <Field label="Комментарий">
            <TextArea value={f.comment} onChange={(v) => set({ comment: v })} rows={2} />
          </Field>
        </Stack>
      </Section>
      {show.pour && (
        <Section title="Заливка">
          {sharedPour && (
            <Text color="orange.300" fontSize="sm" mb="3">
              {sharedPour}
            </Text>
          )}
          <Field label={`Воск${f.waxes.length > 1 ? ` (доли: ${fmt(shareSum)}%)` : ''}`} invalid={Math.abs(shareSum - 100) > 0.01}>
            <Stack gap="2" w="100%">
              {f.waxes.map((w, i) => (
                <HStack key={i}>
                  <Select value={w.materialId} onChange={(v) => setWax(i, { materialId: v || undefined })} placeholder="— материал —" options={materialOptions(d, 'wax')} />
                  <NumInput width="110px" value={w.share} onChange={(v) => setWax(i, { share: v ?? 0 })} suffix="%" />
                  {f.waxes.length > 1 && (
                    <IconButton variant="ghost" aria-label="убрать" onClick={() => set({ waxes: f.waxes.filter((_, j) => j !== i) })}>
                      <LuTrash2 />
                    </IconButton>
                  )}
                </HStack>
              ))}
              <Box>
                <Button size="xs" variant="outline" onClick={() => set({ waxes: [...f.waxes, { share: 0 }] })}>
                  <LuPlus /> Ещё воск (композит)
                </Button>
              </Box>
            </Stack>
          </Field>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4" mt="4">
            <Field label="Отдушка">
              <Select value={f.fragranceId} onChange={(v) => set({ fragranceId: v || undefined })} placeholder="— без отдушки —" options={materialOptions(d, 'fragrance')} />
            </Field>
            <Field label="% отдушки">
              <NumInput value={f.fragrancePct} onChange={(v) => set({ fragrancePct: v })} suffix="%" />
            </Field>
            <Field label="Краситель для воска">
              <Select value={f.dyeId} onChange={(v) => set({ dyeId: v || undefined })} placeholder="— без красителя —" options={materialOptions(d, 'waxDye')} />
            </Field>
            <Field label="% красителя (от воска)">
              <NumInput value={f.dyePct} onChange={(v) => set({ dyePct: v })} suffix="%" />
            </Field>
            <Field label="Цвет">
              <TextInput value={f.dyeColor} onChange={(v) => set({ dyeColor: v })} />
            </Field>
            <Field label="Вид красителя">
              <Chips value={f.dyeForm} onChange={(v) => set({ dyeForm: v as CandleForm['dyeForm'] })} options={dyeForms} />
            </Field>
          </SimpleGrid>
          <SimpleGrid columns={{ base: 1, md: 3 }} gap="4" mt="4">
            <Field label="Ввод отдушки">
              <NumInput value={f.tFrag} onChange={(v) => set({ tFrag: v })} suffix="°C" />
            </Field>
            <Field label="Заливка">
              <NumInput value={f.tPour} onChange={(v) => set({ tPour: v })} suffix="°C" />
            </Field>
            <Field label="Форма / подсвечник">
              <Stack gap="2">
                <Check checked={f.noHeat} onChange={(v) => set({ noHeat: v })}>
                  не грела
                </Check>
                {!f.noHeat && <NumInput value={f.tMold} onChange={(v) => set({ tMold: v })} suffix="°C" />}
              </Stack>
            </Field>
          </SimpleGrid>
          <Field label="Комментарий к заливке" mt="4">
            <TextArea value={f.pourComment} onChange={(v) => set({ pourComment: v })} rows={2} />
          </Field>
        </Section>
      )}
      {show.decor && (
        <Section title="Декор на одну свечу">
          <Stack gap="2">
            {f.decor.map((it, i) => (
              <Stack key={i} gap="1" p="2" borderWidth="1px" borderColor="border" borderRadius="l2">
                <HStack>
                  <Select value={it.key} onChange={(v) => setDecor(i, { key: v })} placeholder="выберите" options={decorOptions} />
                  <NumInput width="110px" value={it.qty} onChange={(v) => setDecor(i, { qty: v ?? 0 })} suffix="шт" />
                  <IconButton variant="ghost" aria-label="убрать" onClick={() => set({ decor: f.decor.filter((_, j) => j !== i) })}>
                    <LuTrash2 />
                  </IconButton>
                </HStack>
                <Check checked={it.dyed} onChange={(v) => setDecor(i, { dyed: v })}>
                  окрашен
                </Check>
              </Stack>
            ))}
            <Box>
              <Button size="sm" variant="outline" onClick={() => set({ decor: [...f.decor, { key: '', qty: 1, dyed: false }] })}>
                <LuPlus /> Декор
              </Button>
            </Box>
          </Stack>
        </Section>
      )}
    </>
  )
}
