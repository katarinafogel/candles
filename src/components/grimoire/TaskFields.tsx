// The fields of a deed: shared by the card (editing) and the «Новое дело» form, so a new field is added
// in one place. The main ones are always there; the optional blocks (project, people, note, time,
// deadline, repeat, checklist, tags) are turned on by round buttons and go to the end in the order chosen.
import { Badge, Box, HStack, IconButton, Input, Slider, Stack, Switch, Text } from '@chakra-ui/react'
import { nanoid } from '@reduxjs/toolkit'
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { LuBookOpen, LuCalendarClock, LuClockAlert, LuHash, LuListChecks, LuPen, LuPlus, LuRepeat, LuUser, LuX } from 'react-icons/lu'
import { costOptions, dreadLabel, priorityLabel, whyOptions } from '@grimoire-core/grimoire/labels'
import { priorities, priorityOf } from '@grimoire-core/grimoire/selectors'
import type { TaskDraft } from '@grimoire-core/grimoire/newTask'
import type { ChecklistItem, Task, TaskPriority } from '@grimoire-core/grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '@grimoire-core/store/grimoireSlice'
import { Check, Chips, DateInput, Field, NumInput, RemovableChip, TextArea, TextInput } from '@shared/components/ui'
import { MarkPicker, PriorityIcon } from './Marks'
import { ScarNote } from './ScarNote'
import { SuggestInput } from './SuggestInput'
import { RoundButton } from './RoundBlocks'
import { TagInput } from './TagInput'

/** Optional blocks of the form, each behind its round button above the footer. */
export type Block = 'project' | 'people' | 'tags' | 'note' | 'time' | 'due' | 'repeat' | 'checklist'

const blocks: { key: Block; label: string; icon: ReactNode; clear: Partial<Task> }[] = [
  { key: 'project', label: 'Проект', icon: <LuBookOpen />, clear: { projectId: undefined } },
  { key: 'people', label: 'Люди', icon: <LuUser />, clear: { personIds: undefined } },
  { key: 'tags', label: 'Теги', icon: <LuHash />, clear: { tags: [] } },
  { key: 'note', label: 'Заметка', icon: <LuPen />, clear: { note: undefined } },
  { key: 'time', label: 'Когда делать', icon: <LuCalendarClock />, clear: { doOn: undefined, doAt: undefined } },
  { key: 'due', label: 'Сделать до', icon: <LuClockAlert />, clear: { dueAt: undefined } },
  { key: 'repeat', label: 'Повтор', icon: <LuRepeat />, clear: { repeat: undefined } },
  { key: 'checklist', label: 'Чеклист', icon: <LuListChecks />, clear: { checklist: undefined } },
]

/** The blocks that hold something: shown from the start. */
function filled(t: Partial<Task>): Set<Block> {
  const has: Record<Block, unknown> = {
    project: t.projectId,
    people: t.personIds?.length,
    tags: t.tags?.length,
    note: t.note,
    time: t.doOn,
    due: t.dueAt,
    repeat: t.repeat,
    checklist: t.checklist?.length,
  }
  return new Set(blocks.map((b) => b.key).filter((k) => has[k]))
}

/**
 * The round buttons over the footer: a tap shows its block, a second tap hides it and clears its
 * value, so a hidden block never saves something unseen. `reset` starts over from another draft.
 */
export function useFieldBlocks(t: Partial<Task>, set: (patch: Partial<Task>) => void, hide: Block[] = []) {
  const [shown, setShown] = useState(() => filled(t))
  // The block just turned on: the form scrolls to it once it is drawn.
  const [opened, setOpened] = useState<Block>()
  const toggle = (b: (typeof blocks)[number]) => {
    const next = new Set(shown)
    if (next.has(b.key)) {
      next.delete(b.key)
      set(b.clear)
      setOpened(undefined)
    } else {
      next.add(b.key)
      setOpened(b.key)
    }
    setShown(next)
  }
  const toolbar = (
    <HStack gap="2" wrap="wrap" w="full">
      {blocks
        .filter((b) => !hide.includes(b.key))
        .map((b) => {
          const on = shown.has(b.key)
          return (
            <RoundButton key={b.key} label={b.label} icon={b.icon} on={on} onClick={() => toggle(b)} />
          )
        })}
    </HStack>
  )
  return {
    shown,
    opened,
    toolbar,
    reset: (d: Partial<Task>) => {
      setShown(filled(d))
      setOpened(undefined)
    },
  }
}

/** `scar` shows the note about people (the card hides it on closed deeds); `onTitleEnter` — Enter in the title. */
export function TaskFields({
  value: t,
  onChange: set,
  titleRef,
  onTitleEnter,
  scar = true,
  shown,
  opened,
  titleMissing,
}: {
  /** A save was tried with no title: the field asks for one. */
  titleMissing?: boolean
  value: TaskDraft
  onChange: (patch: Partial<Task>) => void
  titleRef?: Ref<HTMLInputElement>
  onTitleEnter?: () => void
  scar?: boolean
  /** The optional blocks turned on by the round buttons (`useFieldBlocks`). */
  shown: Set<Block>
  /** The block just turned on, to scroll to. */
  opened?: Block
}) {
  const dispatch = useAppDispatch()
  const g = useAppSelector((s) => s.grimoire)
  // Books to put the deed in: those being read, and the one it is in already, whatever its state.
  const books = Object.values(g.projects).filter((p) => p.status === 'active' || p.status === 'paused' || p.id === t.projectId)
  const project = t.projectId ? g.projects[t.projectId] : undefined
  // «Своими словами» opens with the «+» after the reasons, or by itself when there is a text already.
  const [ownWhy, setOwnWhy] = useState(!!t.whyText)
  // «Ресурс»: the «+» opens a field for her own; Enter adds it as one more chosen chip.
  const [ownCost, setOwnCost] = useState(false)
  const [cost, setCost] = useState('')
  const end = useRef<Record<string, HTMLDivElement | null>>({})
  useEffect(() => {
    if (opened) end.current[opened]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [opened])

  const view: Record<Block, ReactNode> = {
    time: (
      <HStack gap="3" wrap="wrap">
        <Field label="Когда делать" flex="1" minW="150px">
          <DateInput value={t.doOn ?? ''} onChange={(v) => set(v ? { doOn: v } : { doOn: undefined, doAt: undefined })} />
        </Field>
        <Field label="Время" w="110px">
          <DateInput kind="time" value={t.doAt ?? ''} disabled={!t.doOn} onChange={(v) => set({ doAt: v || undefined })} />
        </Field>
      </HStack>
    ),
    due: (
      <HStack gap="3" wrap="wrap">
        <Field label="Сделать до" flex="1" minW="150px">
          <DateInput value={t.dueAt?.slice(0, 10) ?? ''} onChange={(v) => set({ dueAt: v ? v + (t.dueAt?.slice(10) ?? '') : undefined })} />
        </Field>
        <Field label="Время" w="110px">
          <DateInput kind="time" value={t.dueAt?.slice(11, 16) ?? ''} disabled={!t.dueAt} onChange={(v) => set({ dueAt: t.dueAt!.slice(0, 10) + (v ? `T${v}` : '') })} />
        </Field>
      </HStack>
    ),
    project: t.parentId ? null : (
      <Field label="Проект">
        {project ? (
          <RemovableChip onRemove={() => set({ projectId: undefined })}>
            {project.sigil ?? '🌿'} {project.title}
          </RemovableChip>
        ) : (
          <SuggestInput
            placeholder="проект"
            options={books.map((p) => ({ value: p.id, label: p.title, view: <Text fontSize="sm">{p.sigil ?? '🌿'} {p.title}</Text> }))}
            onPick={(id) => set({ projectId: id })}
            onCreate={(title) => {
              const id = nanoid()
              dispatch(A.upsertProject({ project: { id, title, status: 'active' } }))
              set({ projectId: id })
            }}
          />
        )}
      </Field>
    ),
    people: (
      <Field label="Люди">
        <PeoplePicker value={t.personIds ?? []} onChange={(ids) => set({ personIds: ids.length ? ids : undefined })} scar={scar} />
      </Field>
    ),
    tags: (
      <Field label="Теги" helper="Enter или запятая добавляет, тап по тегу убирает">
        <TagInput value={t.tags} onChange={(tags) => set({ tags })} />
      </Field>
    ),
    note: (
      <Field label="Заметка">
        <TextArea value={t.note ?? ''} onChange={(v) => set({ note: v || undefined })} />
      </Field>
    ),
    checklist: (
      <Field label="Чеклист">
        <Checklist items={t.checklist ?? []} onChange={(checklist) => set({ checklist: checklist.length ? checklist : undefined })} />
      </Field>
    ),
    repeat: (
      <Stack gap="2">
        <Field label="Повтор">
          <Chips
            value={t.repeat?.kind}
            onChange={(v) =>
              set({
                repeat:
                  v === 'daily' ? { kind: 'daily' } : v === 'weekdays' ? { kind: 'weekdays', days: [1] } : v === 'everyN' ? { kind: 'everyN', n: 7 } : v === 'monthly' ? { kind: 'monthly' } : undefined,
              })
            }
            options={[
              { value: 'daily', label: 'каждый день' },
              { value: 'weekdays', label: 'дни недели' },
              { value: 'everyN', label: 'раз в N дней' },
              { value: 'monthly', label: 'каждый месяц' },
            ]}
          />
        </Field>
        {t.repeat?.kind === 'weekdays' && (
          <Chips
            multi
            value={t.repeat.days.map(String)}
            onChange={(v) => set({ repeat: { kind: 'weekdays', days: ((v as string[]) ?? []).map(Number).sort() } })}
            options={['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((n, i) => ({ value: String(i + 1), label: n }))}
          />
        )}
        {t.repeat?.kind === 'everyN' && (
          <NumInput value={t.repeat.n} onChange={(v) => set({ repeat: { kind: 'everyN', n: Math.max(1, Math.round(v ?? 1)) } })} suffix="дней" width="160px" />
        )}
      </Stack>
    ),
  }

  return (
    <>
      <Field label="Название" invalid={titleMissing && !t.title.trim()} error="Назови дело">
        <Input
          ref={titleRef}
          value={t.title}
          onChange={(e) => set({ title: e.target.value.slice(0, 200) })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.nativeEvent.isComposing && onTitleEnter) {
              e.preventDefault()
              onTitleEnter()
            }
          }}
          enterKeyHint={onTitleEnter ? 'done' : undefined}
        />
      </Field>
      <Check checked={!!t.evenInNav} onChange={(v) => set({ evenInNav: v || undefined })}>
        Напоминать даже в нави
      </Check>
      <HStack gap="6" wrap="wrap" align="center">
        <MarkPicker kind="stars" value={t.stars} onChange={(v) => set({ stars: v as Task['stars'] })} />
        <TwoWay left="дело" right="радость" value={t.type === 'joy' ? 'right' : 'left'} onChange={(v) => set(v === 'right' ? { type: 'joy', want: undefined, dread: 0 } : { type: 'deed' })} />
        {t.type !== 'joy' && (
          <TwoWay left="хочу" right="надо" value={t.want === 'need' ? 'right' : 'left'} onChange={(v) => set(v === 'right' ? { want: 'need' } : { want: 'want', dread: 0 })} />
        )}
      </HStack>
      {t.type !== 'joy' && t.want === 'need' && (
        <Field label="Нехотение">
          <DreadSlider value={t.dread} onChange={(dread) => set({ dread })} />
        </Field>
      )}
      <Field label="Приоритет">
        <PriorityPicker value={priorityOf(t)} onChange={(priority) => set({ priority, slot: undefined })} />
      </Field>
      <Field label="Ресурс">
        <Stack gap="2" w="full">
          <Chips
            multi
            value={t.costs ?? []}
            onChange={(v) => set({ costs: (v as string[]) ?? [] })}
            options={[...costOptions, ...(t.costs ?? []).filter((x) => !costOptions.includes(x))].map((x) => ({ value: x, label: x }))}
          >
            <PlusToggle label="Свой ресурс" on={ownCost} onClick={() => setOwnCost(!ownCost)} />
          </Chips>
          {ownCost && (
            <Input
              value={cost}
              placeholder="свой ресурс"
              onChange={(e) => setCost(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || !cost.trim() || e.nativeEvent.isComposing) return
                e.preventDefault()
                const x = cost.trim().toLowerCase()
                if (!(t.costs ?? []).includes(x)) set({ costs: [...(t.costs ?? []), x] })
                setCost('')
              }}
            />
          )}
        </Stack>
      </Field>
      <Field label="Почему важно">
        <Stack gap="2" w="full">
          <Chips multi value={t.why ?? []} onChange={(v) => set({ why: (v as string[]) ?? [] })} options={whyOptions.map((x) => ({ value: x, label: x }))}>
            <PlusToggle
              label="Своими словами"
              on={ownWhy}
              onClick={() => {
                if (ownWhy) set({ whyText: undefined })
                setOwnWhy(!ownWhy)
              }}
            />
          </Chips>
          {ownWhy && <TextInput value={t.whyText ?? ''} onChange={(v) => set({ whyText: v || undefined })} placeholder="своими словами" />}
        </Stack>
      </Field>
      {[...shown].map((k) =>
        view[k] ? (
          <Box key={k} ref={(el: HTMLDivElement | null) => (end.current[k] = el)} scrollMarginBlock="4">
            {view[k]}
          </Box>
        ) : null,
      )}
    </>
  )
}

/** A line typed and added with Enter or «+» (a subtask). */
function AddByName({ placeholder, onAdd, disabled }: { placeholder: string; onAdd: (name: string) => void; disabled?: boolean }) {
  const [name, setName] = useState('')
  const add = () => {
    if (!name.trim()) return
    onAdd(name.trim())
    setName('')
  }
  return (
    <HStack gap="2" w="full">
      <Input
        size="sm"
        value={name}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && name.trim()) {
            e.preventDefault()
            add()
          }
        }}
      />
      <IconButton size="sm" variant="outline" aria-label={placeholder} disabled={!name.trim()} onClick={add}>
        <LuPlus />
      </IconButton>
    </HStack>
  )
}

const maxChecklist = 20

/** Two choices on one switch: the side the knob is on is the chosen one, the other is dimmed. */
function TwoWay({ left, right, value, onChange }: { left: string; right: string; value: 'left' | 'right'; onChange: (v: 'left' | 'right') => void }) {
  const side = (v: 'left' | 'right', label: string) => (
    <Text as="button" fontSize="sm" cursor="pointer" color={value === v ? 'fg' : 'fg.subtle'} fontWeight={value === v ? 'medium' : 'normal'} onClick={() => onChange(v)}>
      {label}
    </Text>
  )
  return (
    <HStack gap="2">
      {side('left', left)}
      <Switch.Root colorPalette="ember" checked={value === 'right'} onCheckedChange={(e) => onChange(e.checked ? 'right' : 'left')} cursor="pointer" aria-label={`${left} или ${right}`}>
        <Switch.HiddenInput />
        <Switch.Control bg="bg.emphasized" _checked={{ bg: 'bg.emphasized' }}>
          <Switch.Thumb bg="ember.300" />
        </Switch.Control>
      </Switch.Root>
      {side('right', right)}
    </HStack>
  )
}

/** Priority as in Jira: five arrows in a row, «нормальный» by default; the chosen one is named beside. */
export function PriorityPicker({ value, onChange }: { value: TaskPriority; onChange: (p: TaskPriority) => void }) {
  return (
    <HStack gap="1" role="radiogroup" aria-label="Приоритет" wrap="wrap">
      {priorities.map((p) => {
        const on = value === p
        return (
          <Box
            as="button"
            key={p}
            role="radio"
            aria-checked={on}
            aria-label={priorityLabel[p]}
            title={priorityLabel[p]}
            p="1.5"
            lineHeight="0"
            cursor="pointer"
            borderRadius="l2"
            borderWidth="1px"
            borderColor={on ? 'border.emphasized' : 'transparent'}
            bg={on ? 'bg.muted' : 'transparent'}
            opacity={on ? 1 : 0.55}
            _hover={{ opacity: 1, bg: 'bg.muted' }}
            onClick={() => onChange(p)}
          >
            <PriorityIcon p={p} size={20} />
          </Box>
        )
      })}
      <Text fontSize="sm" color="fg.muted" ml="1">
        {priorityLabel[value]}
      </Text>
    </HStack>
  )
}

/** How much she does not want a «надо» deed: 0–3 on a slider that warms up the heavier it is. */
const dreadBlue = ['fg.subtle', 'ember.500', 'ember.400', 'ember.300']
function DreadSlider({ value, onChange }: { value: number; onChange: (v: Task['dread']) => void }) {
  return (
    <Stack gap="1" w="full" maxW="sm">
      <Text fontSize="sm" color={dreadBlue[value]}>
        {dreadLabel[value]}
      </Text>
      <Slider.Root min={0} max={3} step={1} value={[value]} onValueChange={(e) => onChange(e.value[0] as Task['dread'])} aria-label={['Нехотение']}>
        <Slider.Control>
          <Slider.Track>
            <Slider.Range bg={dreadBlue[value]} />
          </Slider.Track>
          <Slider.Thumb index={0} cursor="grab" borderColor={dreadBlue[value]} bg="bg.panel">
            <Slider.HiddenInput />
          </Slider.Thumb>
        </Slider.Control>
      </Slider.Root>
    </Stack>
  )
}

/** The round «+» at the end of a row of chips that opens a field for her own words. */
function PlusToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <IconButton size="sm" borderRadius="full" variant={on ? 'solid' : 'outline'} aria-label={label} title={label} aria-pressed={on} onClick={onClick}>
      <LuPlus />
    </IconButton>
  )
}

/** Subtasks of one deed: the field for a new one stays on top, new ones go to the end of the list. */
function Checklist({ items, onChange }: { items: ChecklistItem[]; onChange: (items: ChecklistItem[]) => void }) {
  const put = (id: string, patch: Partial<ChecklistItem>) => onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const full = items.length >= maxChecklist
  return (
    <Stack gap="1.5" w="full">
      <AddByName placeholder={full ? `уже ${maxChecklist} подзадач` : 'новая подзадача'} disabled={full} onAdd={(text) => !full && onChange([...items, { id: nanoid(6), text }])} />
      {items.map((x) => (
        <HStack key={x.id} gap="2">
          <Check checked={!!x.done} onChange={(done) => put(x.id, { done: done || undefined })} />
          <Input
            size="sm"
            variant="flushed"
            value={x.text}
            onChange={(e) => put(x.id, { text: e.target.value })}
            textDecoration={x.done ? 'line-through' : undefined}
            color={x.done ? 'fg.subtle' : 'fg'}
          />
          <IconButton size="xs" variant="ghost" aria-label="Убрать подзадачу" onClick={() => onChange(items.filter((y) => y.id !== x.id))}>
            <LuX />
          </IconButton>
        </HStack>
      ))}
    </Stack>
  )
}

/** People from the bestiary as chips, with a field that finds one or adds a new one by name. */
export function PeoplePicker({ value, onChange, scar }: { value: string[]; onChange: (ids: string[]) => void; scar?: boolean }) {
  const dispatch = useAppDispatch()
  const people = useAppSelector((s) => s.grimoire.beings)
  return (
    <Stack gap="2" w="full">
      {value.length > 0 && (
        <HStack gap="1.5" wrap="wrap">
          {value.map((id) => (
            <RemovableChip key={id} onRemove={() => onChange(value.filter((x) => x !== id))}>
              {people[id]?.name ?? '?'}
            </RemovableChip>
          ))}
        </HStack>
      )}
      <SuggestInput
        placeholder="имя"
        options={Object.values(people)
          .filter((p) => !value.includes(p.id))
          .map((p) => ({ value: p.id, label: p.name }))}
        onPick={(id) => onChange([...value, id])}
        onCreate={(name) => {
          const id = nanoid(8)
          dispatch(A.upsertBeing({ id, name }))
          onChange([...value, id])
        }}
      />
      {scar && <ScarNote personIds={value} />}
    </Stack>
  )
}
