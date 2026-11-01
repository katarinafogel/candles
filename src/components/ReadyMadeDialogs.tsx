// Items made before the app or outside it: they enter at the end of the way, with no recipe and no stock taken.
import { Button, Input, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { nowLocal, toIso } from '../lib/dates'
import { isPlaster, plasterPurposes, wickSchemeLabel } from '../lib/labels'
import { sortMolds } from '../lib/selectors'
import { useAppDispatch, useData } from '../store'
import { actions } from '../store/dataSlice'
import type { WickScheme } from '../types'
import { MoldPicker } from './MoldPicker'
import { Chips, Field, Modal, notify, NumInput, Select, TextInput } from './ui'

const itemsOf = (counts: Record<string, number>) => Object.entries(counts).filter(([, n]) => n > 0).map(([moldId, count]) => ({ moldId, count }))
const total = (counts: Record<string, number>) => Object.values(counts).reduce((a, n) => a + n, 0)

export function ReadyHoldersDialog({ onClose, onDone }: { onClose: () => void; onDone: (stage: 'dampers' | 'done') => void }) {
  const d = useData()
  const dispatch = useAppDispatch()
  const molds = sortMolds(d, Object.values(d.molds).filter((m) => !m.archived && isPlaster(m.purpose)))
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [date, setDate] = useState(nowLocal())
  const n = total(counts)
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Добавить готовые изделия"
      footer={
        <Button
          disabled={!n}
          onClick={() => {
            const items = itemsOf(counts)
            dispatch(actions.addReadyHolders({ items, date: toIso(date) }))
            notify(`Добавлено: ${n} шт.`)
            onDone(items.some((i) => d.molds[i.moldId]?.purpose === 'holder') ? 'dampers' : 'done')
          }}
        >
          Добавить · {n}
        </Button>
      }
    >
      <Stack gap="4">
        <Text fontSize="sm" color="fg.muted">
          Подсвечники встанут на этап «ждёт фитиля», тарелки и фигурки сразу будут готовы. Со склада ничего не спишется.
        </Text>
        <MoldPicker molds={molds} kinds={plasterPurposes} counts={counts} onChange={setCounts} />
        <Field label="Дата">
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </Stack>
    </Modal>
  )
}

export function ReadyCandlesDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const d = useData()
  const dispatch = useAppDispatch()
  const molds = sortMolds(d, Object.values(d.molds).filter((m) => !m.archived && (m.purpose === 'holder' || m.purpose === 'candle')))
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [scheme, setScheme] = useState<WickScheme>()
  const [length, setLength] = useState<number>()
  const [instructionId, setInstructionId] = useState<string | undefined>('default')
  const [date, setDate] = useState(nowLocal())
  const n = total(counts)
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Добавить готовые свечи"
      footer={
        <Button
          disabled={!n}
          onClick={() => {
            dispatch(actions.addReadyCandles({ items: itemsOf(counts), name: name.trim(), scheme, lengthCm: length, instructionId, date: toIso(date) }))
            notify(`Добавлено свечей: ${n}`)
            onDone()
          }}
        >
          Добавить · {n}
        </Button>
      }
    >
      <Stack gap="4">
        <Text fontSize="sm" color="fg.muted">
          Свечи встанут на этап «готова», дальше их можно подарить. Со склада ничего не спишется.
        </Text>
        <MoldPicker molds={molds} kinds={['holder', 'candle']} counts={counts} onChange={setCounts} />
        <Field label="Название" helper="пусто — как у формы">
          <TextInput value={name} onChange={setName} />
        </Field>
        <Field label="Схема фитиля" helper="не выбрана — из формы">
          <Chips
            value={scheme}
            onChange={(v) => setScheme(v as WickScheme | undefined)}
            options={Object.entries(wickSchemeLabel).map(([value, label]) => ({ value: value as WickScheme, label }))}
          />
        </Field>
        <Field label="Длина фитиля" helper="пусто — из формы">
          <NumInput value={length} onChange={setLength} suffix="см" />
        </Field>
        <Field label="Инструкция">
          <Select
            value={instructionId}
            onChange={(v) => setInstructionId(v || undefined)}
            placeholder="— без инструкции —"
            options={Object.values(d.instructions).map((i) => ({ value: i.id, label: i.title }))}
          />
        </Field>
        <Field label="Дата готовности">
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </Stack>
    </Modal>
  )
}
