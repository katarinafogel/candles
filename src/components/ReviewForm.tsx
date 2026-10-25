import { Badge, Box, Button, Grid, HStack, Stack, Text, Wrap } from '@chakra-ui/react'
import { fmt, fmtDateTime } from '../lib/calc'
import { reviewQuestions, type ChoiceQuestion } from '../lib/labels'
import type { Review, ReviewAnswers } from '../types'
import { Chips, Field, TextArea, TextInput } from './ui'

function Scale({ value, onChange }: { value?: number; onChange: (v?: number) => void }) {
  return (
    <Grid templateColumns="repeat(10, minmax(0, 1fr))" gap="1" w="100%" maxW="420px">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <Button
          key={n}
          size="sm"
          minW="0"
          px="0"
          variant={value === n ? 'solid' : 'outline'}
          onClick={() => onChange(value === n ? undefined : n)}
        >
          {n}
        </Button>
      ))}
    </Grid>
  )
}

const choiceOrder: ChoiceQuestion[] = [
  'scentCold',
  'scentHot',
  'burn',
  'wentOut',
  'soot',
  'heat',
  'crack',
  'leak',
  'instructionClear',
  'finished',
]

/** The recipient's questionnaire (spec 6.4): everything optional, answered with taps. */
export function ReviewForm({ value, onChange }: { value: ReviewAnswers; onChange: (v: ReviewAnswers) => void }) {
  const set = <K extends keyof ReviewAnswers>(k: K, v: ReviewAnswers[K]) => onChange({ ...value, [k]: v })
  return (
    <Stack gap="5">
      <Field label="Как свеча в целом?">
        <Scale value={value.overall} onChange={(v) => set('overall', v)} />
      </Field>
      <Field label="Понравился ли дизайн?">
        <Scale value={value.design} onChange={(v) => set('design', v)} />
      </Field>
      {choiceOrder.map((k) => {
        const q = reviewQuestions[k]
        return (
          <Field key={k} label={q.label}>
            <Chips
              value={value[k] as string | undefined}
              onChange={(v) => set(k, v as never)}
              options={Object.entries(q.options).map(([v, label]) => ({ value: v, label: label as string }))}
            />
          </Field>
        )
      })}
      <Field label="Комментарий">
        <TextArea value={value.comment ?? ''} onChange={(v) => set('comment', v)} rows={3} />
      </Field>
      <Field label="Как вас зовут?" helper="необязательно; помогает, если свечу передарили">
        <TextInput value={value.name ?? ''} onChange={(v) => set('name', v)} />
      </Field>
    </Stack>
  )
}

export function ReviewCard({ r, children }: { r: Review; children?: React.ReactNode }) {
  const bad = (k: ChoiceQuestion) => {
    const v = r[k as keyof Review] as string | undefined
    return v && !['no', 'nice', 'normal', 'yes', 'cool', 'warm', 'burning'].includes(v)
  }
  return (
    <Box p="3" borderWidth="1px" borderColor={r.read ? 'border' : 'emerald.700'} borderRadius="l3" bg="bg.subtle">
      <HStack justify="space-between" mb="2" wrap="wrap">
        <HStack gap="2">
          {!r.read && <Badge colorPalette="emerald">новый</Badge>}
          <Text fontSize="sm" fontWeight="medium">
            {r.name || 'Без имени'}
          </Text>
          <Text fontSize="xs" color="fg.muted">
            {fmtDateTime(r.date)} · {r.source === 'qr' ? 'по QR' : 'вручную'}
          </Text>
        </HStack>
        <HStack gap="3" fontSize="sm">
          {r.overall != null && <Text>общая <b>{r.overall}</b>/10</Text>}
          {r.design != null && <Text>дизайн <b>{r.design}</b>/10</Text>}
        </HStack>
      </HStack>
      <Wrap gap="1.5" mb={r.comment ? 2 : 0}>
        {choiceOrder.map((k) => {
          const v = r[k as keyof Review] as string | undefined
          if (!v) return null
          const q = reviewQuestions[k]
          return (
            <Badge key={k} variant="outline" colorPalette={bad(k) ? 'orange' : 'gray'} fontWeight="normal">
              {q.label.replace('?', '')}: {(q.options as Record<string, string>)[v]}
            </Badge>
          )
        })}
        {r.burnHours != null && (
          <Badge variant="outline" colorPalette="emerald" fontWeight="normal">
            горела {fmt(r.burnHours, 1)} ч · сессий {r.sessions ?? 0}
            {r.selfExtinguished ? ` · тухла ${r.selfExtinguished}` : ''}
          </Badge>
        )}
      </Wrap>
      {r.comment && (
        <Text fontSize="sm" whiteSpace="pre-wrap">
          {r.comment}
        </Text>
      )}
      {children}
    </Box>
  )
}
