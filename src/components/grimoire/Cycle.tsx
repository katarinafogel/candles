// The cycle in the grimoire: marked on the evening page only — the period started, how heavy and how
// it felt, then that it ended. Phases, forecasts and statistics are not shown anywhere yet.
import { Button, Flex, Input, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { useToday, withUndo } from '../../grimoire/act'
import { cycleSymptoms, openPeriod } from '../../grimoire/cycle'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { Chips, Field } from '../ui'

const ddmm = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}`

function DateInput({ value, max, onChange }: { value: string; max?: string; onChange: (v: string) => void }) {
  return (
    <Input size="sm" type="date" w="160px" value={value} max={max} onChange={(e) => e.target.value && onChange(e.target.value)} style={{ colorScheme: 'dark' }} />
  )
}

/** «Начались» with a day, or for the open period: intensity, how it felt and «Закончились». */
export function CycleMark() {
  const dispatch = useAppDispatch()
  const cycles = useAppSelector((s) => s.grimoire.cycles) ?? {}
  const today = useToday()
  const [on, setOn] = useState(today)
  const open = openPeriod(cycles)
  if (!open)
    return (
      <Flex gap="2" align="center" wrap="wrap">
        <Button size="sm" onClick={() => withUndo('Цикл отмечен', () => dispatch(A.upsertCycle({ start: on })))}>
          Месячные начались {on === today ? 'сегодня' : ddmm(on)}
        </Button>
        <DateInput value={on} max={today} onChange={setOn} />
      </Flex>
    )
  return (
    <Stack gap="3">
      <Text fontSize="sm">{open.start === today ? 'Месячные начались сегодня' : `Месячные идут с ${ddmm(open.start)}`}</Text>
      <Field label="Интенсивность">
        <Chips
          value={open.flow ? String(open.flow) : undefined}
          onChange={(v) => dispatch(A.upsertCycle({ ...open, flow: v ? (Number(v) as 1 | 2 | 3) : undefined }))}
          options={[
            { value: '1', label: 'легко' },
            { value: '2', label: 'средне' },
            { value: '3', label: 'обильно' },
          ]}
        />
      </Field>
      <Field label="Самочувствие">
        <Chips multi value={open.symptoms ?? []} onChange={(v) => dispatch(A.upsertCycle({ ...open, symptoms: (v as string[])?.length ? (v as string[]) : undefined }))} options={cycleSymptoms.map((x) => ({ value: x.key, label: x.label }))} />
      </Field>
      <Flex gap="2" align="center" wrap="wrap">
        <Button size="sm" variant="outline" onClick={() => withUndo('Цикл отмечен', () => dispatch(A.upsertCycle({ ...open, end: on < open.start ? open.start : on })))}>
          Закончились {on === today ? 'сегодня' : ddmm(on)}
        </Button>
        <DateInput value={on} max={today} onChange={setOn} />
      </Flex>
    </Stack>
  )
}
