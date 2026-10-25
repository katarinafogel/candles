import { Badge, Box, Button, Flex, HStack, Slider, Stack, Text, Wrap } from '@chakra-ui/react'
import { fmt, fmtDateTime } from '../lib/calc'
import { reviewQuestions, type ChoiceQuestion } from '../lib/labels'
import type { Review, ReviewAnswers } from '../types'
import { Chips, Field, TextArea, TextInput } from './ui'

/** A slider that stays "не отвечено" until the person touches it. */
function SliderQuestion({
  label,
  steps,
  index,
  onChange,
}: {
  label: string
  steps: string[]
  index: number | undefined
  onChange: (i: number | undefined) => void
}) {
  const answered = index != null
  const mid = Math.floor((steps.length - 1) / 2)
  const pick = (v: number[]) => onChange(v[0])
  return (
    <Box>
      <Flex justify="space-between" align="baseline" gap="3" mb="2">
        <Text fontSize="sm" color="fg.muted">
          {label}
        </Text>
        {answered ? (
          <HStack gap="2">
            <Text fontSize="sm" fontWeight="semibold" color="emerald.300" textAlign="end">
              {steps[index]}
            </Text>
            <Button size="2xs" variant="ghost" color="fg.subtle" onClick={() => onChange(undefined)} aria-label="сбросить">
              ✕
            </Button>
          </HStack>
        ) : (
          <Text fontSize="xs" color="fg.subtle">
            не отвечено
          </Text>
        )}
      </Flex>
      <Slider.Root
        min={0}
        max={steps.length - 1}
        step={1}
        value={[index ?? mid]}
        onValueChange={(e) => pick(e.value)}
        onValueChangeEnd={(e) => pick(e.value)}
        opacity={answered ? 1 : 0.45}
        px="2"
      >
        <Slider.Control>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumbs />
        </Slider.Control>
      </Slider.Root>
      <Flex justify="space-between" mt="1" gap="3">
        <Text fontSize="2xs" color="fg.subtle">
          {steps[0]}
        </Text>
        <Text fontSize="2xs" color="fg.subtle" textAlign="end">
          {steps[steps.length - 1]}
        </Text>
      </Flex>
    </Box>
  )
}

const tens = Array.from({ length: 10 }, (_, i) => String(i + 1))
const sliderQuestions: ChoiceQuestion[] = ['scentCold', 'scentHot', 'burn', 'wentOut', 'soot', 'heat']
const chipQuestions: ChoiceQuestion[] = ['crack', 'leak', 'finished']

/** The recipient's questionnaire (spec 6.4): everything optional. */
export function ReviewForm({ value, onChange }: { value: ReviewAnswers; onChange: (v: ReviewAnswers) => void }) {
  const set = <K extends keyof ReviewAnswers>(k: K, v: ReviewAnswers[K]) => onChange({ ...value, [k]: v })
  const chips = (k: ChoiceQuestion) => {
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
  }
  return (
    <Stack gap="6">
      <Field label="Как вас зовут?">
        <TextInput value={value.name ?? ''} onChange={(v) => set('name', v)} />
      </Field>
      {chips('instructionClear')}
      <SliderQuestion
        label="Как свеча в целом?"
        steps={tens}
        index={value.overall != null ? value.overall - 1 : undefined}
        onChange={(i) => set('overall', i != null ? i + 1 : undefined)}
      />
      <SliderQuestion
        label="Понравился ли дизайн?"
        steps={tens}
        index={value.design != null ? value.design - 1 : undefined}
        onChange={(i) => set('design', i != null ? i + 1 : undefined)}
      />
      {sliderQuestions.map((k) => {
        const q = reviewQuestions[k]
        const keys = Object.keys(q.options)
        const labels = Object.values(q.options) as string[]
        const cur = value[k] as string | undefined
        return (
          <SliderQuestion
            key={k}
            label={q.label}
            steps={labels}
            index={cur ? keys.indexOf(cur) : undefined}
            onChange={(i) => set(k, (i != null ? keys[i] : undefined) as never)}
          />
        )
      })}
      {chipQuestions.map(chips)}
      <Field label="Комментарий">
        <TextArea value={value.comment ?? ''} onChange={(v) => set('comment', v)} rows={3} />
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
        {[...sliderQuestions, ...chipQuestions, 'instructionClear' as const].map((k) => {
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
