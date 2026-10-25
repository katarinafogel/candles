import { Button, HStack, IconButton, Input, Stack, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { LuPlus, LuTrash2 } from 'react-icons/lu'
import { nowLocal, toIso } from '../lib/dates'
import { candleDefectReasons, decorKindLabel, defectReasonLabel, holderDefectReasons, holderNextTitle, varnishKindLabel, wickSchemeLabel } from '../lib/labels'
import { materialOptions } from '../lib/selectors'
import { nextHolderStage, actions, type HolderStepParams } from '../store/dataSlice'
import { useAppDispatch, useData } from '../store'
import type { DecorUse, DefectReason, VarnishKind, WickScheme } from '../types'
import { StockHint } from './StockHint'
import { Check, Chips, Field, Modal, notify, NumInput, Select, TextArea, TextInput } from './ui'
import { withUndo } from '../lib/undo'

/** Bulk "Дальше" for holders: parameters are entered once for all selected items. */
export function HolderStepDialog({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const d = useData()
  const dispatch = useAppDispatch()
  const holders = ids.map((i) => d.holders[i]).filter(Boolean)
  const step = holders.length ? nextHolderStage(holders[0]) : undefined
  const same = holders.every((h) => nextHolderStage(h) === step)
  const first = holders[0]
  const mold = first ? d.molds[first.moldId] : undefined

  const [date, setDate] = useState(nowLocal())
  const [materialId, setMaterialId] = useState<string>()
  const [layers, setLayers] = useState<number | undefined>(2)
  const [kind, setKind] = useState<VarnishKind>('gloss')
  const [count, setCount] = useState<number | undefined>(3)
  const [skip, setSkip] = useState(false)
  const [description, setDescription] = useState('')
  const [paints, setPaints] = useState<{ materialId: string; qty: number }[]>([])
  const [scheme, setScheme] = useState<WickScheme>(mold?.defaultWick?.scheme ?? 'double05')
  const [length, setLength] = useState<number | undefined>(mold?.defaultWick?.lengthCm)
  const [name, setName] = useState('')
  const [instructionId, setInstructionId] = useState<string | undefined>('default')
  const [comment, setComment] = useState('')

  useEffect(() => {
    setScheme(mold?.defaultWick?.scheme ?? 'double05')
    setLength(mold?.defaultWick?.lengthCm)
    setName(mold?.name ?? '')
  }, [mold?.id, mold?.defaultWick?.scheme, mold?.defaultWick?.lengthCm, mold?.name])

  if (!holders.length || !step) return null
  const n = holders.length
  const mlPerLayer = d.settings.varnishMlPerLayer

  function save() {
    let params: HolderStepParams
    switch (step) {
      case 'dried':
        params = { step, dryEnd: toIso(date) }
        break
      case 'varnishIn':
        params = { step, materialId, layers: layers ?? 1 }
        break
      case 'painted':
        params = { step, skip, description, paints: paints.filter((p) => p.materialId) }
        break
      case 'varnishOut':
        params = { step, kind, materialId, layers: layers ?? 1 }
        break
      case 'dampers':
        params = { step, materialId, count: count ?? 0 }
        break
      case 'done':
        params = { step }
        break
      case 'wicked':
        if (!length) return notify('Укажите длину фитиля', 'warning')
        params = { step, wick: { scheme, lengthCm: length }, materialId, name: name || mold?.name || '', instructionId }
        break
      default:
        return
    }
    withUndo(
      'holder',
      ids,
      () => dispatch(actions.advanceHolders({ ids, date: toIso(date), params, comment })),
      `${holderNextTitle(holders[0]) ?? 'Готово'}: ${n} шт.`,
    )
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${holderNextTitle(holders[0])} · ${n} шт.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={save} disabled={!same}>
            Сохранить
          </Button>
        </>
      }
    >
      <Stack gap="4">
        {!same && (
          <Text color="orange.300" fontSize="sm">
            Выбраны изделия на разных этапах — отметьте изделия одного этапа.
          </Text>
        )}
        <Text fontSize="sm" color="fg.muted">
          {holders.map((h) => h.id).join(', ')}
        </Text>
        <Field label={step === 'dried' ? 'Дата конца сушки' : 'Дата'}>
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>

        {(step === 'varnishIn' || step === 'varnishOut') && (
          <>
            {step === 'varnishOut' && (
              <Field label="Вид">
                <Chips
                  value={kind}
                  onChange={(v) => v && setKind(v as VarnishKind)}
                  options={Object.entries(varnishKindLabel).map(([value, label]) => ({ value: value as VarnishKind, label }))}
                />
              </Field>
            )}
            <Field label={kind === 'wax' && step === 'varnishOut' ? 'Воск' : 'Лак'}>
              <Select
                value={materialId}
                onChange={(v) => setMaterialId(v || undefined)}
                placeholder="— не списывать —"
                options={materialOptions(d, ...(step === 'varnishIn' ? (['varnishIn'] as const) : (['varnishOut', 'wax'] as const)))}
              />
              <StockHint materialId={materialId} need={(layers ?? 0) * mlPerLayer * n} />
            </Field>
            <Field label="Число слоёв" helper={`Норма: ${mlPerLayer} мл на слой на подсвечник`}>
              <NumInput value={layers} onChange={setLayers} />
            </Field>
          </>
        )}

        {step === 'painted' && (
          <>
            <Check checked={skip} onChange={setSkip}>
              Пропустить роспись
            </Check>
            {!skip && (
              <>
                <Field label="Описание">
                  <TextArea value={description} onChange={setDescription} rows={2} />
                </Field>
                <Field label="Краски (расход на один подсвечник)">
                  <Stack gap="2" w="100%">
                    {paints.map((p, i) => (
                      <HStack key={i}>
                        <Select
                          value={p.materialId}
                          onChange={(v) => setPaints(paints.map((x, j) => (j === i ? { ...x, materialId: v } : x)))}
                          placeholder="краска"
                          options={materialOptions(d, 'paint')}
                        />
                        <NumInput
                          width="120px"
                          value={p.qty}
                          onChange={(v) => setPaints(paints.map((x, j) => (j === i ? { ...x, qty: v ?? 0 } : x)))}
                          suffix="мл"
                        />
                        <IconButton variant="ghost" aria-label="убрать" onClick={() => setPaints(paints.filter((_, j) => j !== i))}>
                          <LuTrash2 />
                        </IconButton>
                      </HStack>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => setPaints([...paints, { materialId: '', qty: 1 }])}>
                      <LuPlus /> Краска
                    </Button>
                  </Stack>
                </Field>
              </>
            )}
          </>
        )}

        {step === 'dampers' && (
          <>
            <Field label="Материал">
              <Select
                value={materialId}
                onChange={(v) => setMaterialId(v || undefined)}
                placeholder="— не списывать —"
                options={materialOptions(d, 'cork')}
              />
              <StockHint materialId={materialId} need={(count ?? 0) * n} />
            </Field>
            <Field label="Количество на подсвечник, шт">
              <NumInput value={count} onChange={setCount} />
            </Field>
          </>
        )}

        {step === 'wicked' && (
          <>
            <Field label="Название / дизайн свечи" helper="видно получателю">
              <TextInput value={name} onChange={setName} />
            </Field>
            <Field label="Схема фитиля">
              <Chips
                value={scheme}
                onChange={(v) => v && setScheme(v as WickScheme)}
                options={Object.entries(wickSchemeLabel).map(([value, label]) => ({ value: value as WickScheme, label }))}
              />
            </Field>
            <Field label="Длина фитиля" helper="по умолчанию из формы; списывается 2 × длина">
              <NumInput value={length} onChange={setLength} suffix="см" />
            </Field>
            <Field label="Фитиль со склада">
              <Select
                value={materialId}
                onChange={(v) => setMaterialId(v || undefined)}
                placeholder="— не списывать —"
                options={materialOptions(d, 'wick')}
              />
              <StockHint materialId={materialId} need={(length ?? 0) * 2 * n} />
            </Field>
            <Field label="Инструкция">
              <Select
                value={instructionId}
                onChange={(v) => setInstructionId(v || undefined)}
                placeholder="— без инструкции —"
                options={Object.values(d.instructions).map((i) => ({ value: i.id, label: i.title }))}
              />
            </Field>
          </>
        )}

        <Field label="Комментарий">
          <TextArea value={comment} onChange={setComment} rows={2} />
        </Field>
      </Stack>
    </Modal>
  )
}

export function DefectDialog({
  kind,
  ids,
  onClose,
}: {
  kind: 'holder' | 'candle'
  ids: string[]
  onClose: () => void
}) {
  const dispatch = useAppDispatch()
  const [reason, setReason] = useState<DefectReason>()
  const [comment, setComment] = useState('')
  const [date, setDate] = useState(nowLocal())
  return (
    <Modal
      open
      onClose={onClose}
      title={`Брак · ${ids.length} шт.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            colorPalette="red"
            disabled={!reason}
            onClick={() => {
              withUndo(
                kind,
                ids,
                () => dispatch(actions.markDefect({ kind, ids, reason: reason!, comment, date: toIso(date) })),
                'Отмечено как брак. Материалы не возвращаются.',
                'info',
              )
              onClose()
            }}
          >
            В брак
          </Button>
        </>
      }
    >
      <Stack gap="4">
        <Text fontSize="sm" color="fg.muted">
          {ids.join(', ')}
        </Text>
        <Field label="Причина">
          <Chips
            value={reason}
            onChange={(v) => setReason(v as DefectReason)}
            options={(kind === 'holder' ? holderDefectReasons : candleDefectReasons).map((value) => ({ value, label: defectReasonLabel[value] }))}
          />
        </Field>
        <Field label="Дата">
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Комментарий">
          <TextArea value={comment} onChange={setComment} rows={2} />
        </Field>
      </Stack>
    </Modal>
  )
}

/** Decorating candles: decor batches or plain decor materials, amounts per candle. */
export function DecorateDialog({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const d = useData()
  const dispatch = useAppDispatch()
  const [items, setItems] = useState<(DecorUse & { key: string })[]>([])
  const [date, setDate] = useState(nowLocal())
  const options = [
    ...Object.values(d.decor)
      .filter((b) => b.qty - b.used > 0)
      .map((b) => ({ value: `d:${b.id}`, label: `${b.id} · ${b.name} (${decorKindLabel[b.kind]}, ост. ${b.qty - b.used})` })),
    ...materialOptions(d, 'decor').map((o) => ({ ...o, value: `m:${o.value}` })),
  ]
  return (
    <Modal
      open
      onClose={onClose}
      title={`Украсить · ${ids.length} шт.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={() => {
              const decor: DecorUse[] = items
                .filter((i) => i.key)
                .map((i) => ({
                  decorId: i.key.startsWith('d:') ? i.key.slice(2) : undefined,
                  materialId: i.key.startsWith('m:') ? i.key.slice(2) : undefined,
                  qty: i.qty,
                  dyed: i.dyed,
                }))
              withUndo(
                'candle',
                ids,
                () => dispatch(actions.advanceCandles({ ids, date: toIso(date), params: { step: 'decorated', decor } })),
                'Свечи украшены',
              )
              onClose()
            }}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <Stack gap="4">
        <Field label="Дата">
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Декор на одну свечу">
          <Stack gap="2" w="100%">
            {items.map((it, i) => (
              <Stack key={i} gap="1" p="2" borderWidth="1px" borderColor="border" borderRadius="l2">
                <HStack>
                  <Select
                    value={it.key}
                    onChange={(v) => setItems(items.map((x, j) => (j === i ? { ...x, key: v } : x)))}
                    placeholder="выберите"
                    options={options}
                  />
                  <NumInput
                    width="110px"
                    value={it.qty}
                    onChange={(v) => setItems(items.map((x, j) => (j === i ? { ...x, qty: v ?? 0 } : x)))}
                    suffix="шт"
                  />
                  <IconButton variant="ghost" aria-label="убрать" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                    <LuTrash2 />
                  </IconButton>
                </HStack>
                <Check checked={it.dyed} onChange={(v) => setItems(items.map((x, j) => (j === i ? { ...x, dyed: v } : x)))}>
                  окрашен
                </Check>
              </Stack>
            ))}
            <Button size="sm" variant="outline" onClick={() => setItems([...items, { key: '', qty: 1, dyed: false }])}>
              <LuPlus /> Декор
            </Button>
          </Stack>
        </Field>
      </Stack>
    </Modal>
  )
}
