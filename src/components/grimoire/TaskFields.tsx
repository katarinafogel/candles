// The fields of a deed: shared by the card (editing) and the «Новое дело» form, so a new field is added
// in one place. The main ones are always there; the optional blocks (project, people, note, time,
// deadline, repeat, checklist, tags) are turned on by round buttons and go to the end in the order chosen.
import { Badge, Box, HStack, IconButton, Input, Slider, Stack, Switch, Text } from '@chakra-ui/react'
import { nanoid } from '@reduxjs/toolkit'
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { LuBookOpen, LuCalendarClock, LuChevronUp, LuClockAlert, LuHash, LuListChecks, LuPen, LuPlus, LuRepeat, LuUser, LuX } from 'react-icons/lu'
import { costOptions, dreadLabel, slotLabel, whyOptions } from '../../grimoire/labels'
import type { TaskDraft } from '../../grimoire/newTask'
import type { ChecklistItem, Task, TaskSlot } from '../../grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { actions } from '../../store/dataSlice'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { Check, Chips, Field, NumInput, TextArea, TextInput } from '../ui'
import { MarkPicker } from './Marks'
import { ScarNote } from './ScarNote'
import { SuggestInput } from './SuggestInput'
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
            <Box key={b.key} position="relative" className="group">
              <IconButton
                aria-label={b.label}
                aria-pressed={on}
                borderRadius="full"
                size="sm"
                variant="outline"
                borderColor={on ? 'ember.500' : 'border'}
                bg={on ? 'ember.subtle' : 'transparent'}
                color={on ? 'ember.200' : 'fg.muted'}
                onClick={() => toggle(b)}
              >
                {b.icon}
              </IconButton>
              {/* What the button means, over it while the pointer is there. */}
              <Text
                role="tooltip"
                position="absolute"
                bottom="calc(100% + 6px)"
                left="50%"
                transform="translateX(-50%)"
                whiteSpace="nowrap"
                fontSize="xs"
                px="2"
                py="1"
                borderRadius="l2"
                bg="bg.emphasized"
                color="fg"
                shadow="md"
                pointerEvents="none"
                opacity="0"
                transition="opacity .12s"
                zIndex="1"
                css={{ '.group:hover > &': { opacity: 1 } }}
              >
                {b.label}
              </Text>
            </Box>
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
}: {
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
  const people = useAppSelector((s) => s.data.people)
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
          <Input type="date" value={t.doOn ?? ''} onChange={(e) => set(e.target.value ? { doOn: e.target.value } : { doOn: undefined, doAt: undefined })} />
        </Field>
        <Field label="Время" w="110px">
          <Input type="time" value={t.doAt ?? ''} disabled={!t.doOn} onChange={(e) => set({ doAt: e.target.value || undefined })} />
        </Field>
      </HStack>
    ),
    due: (
      <HStack gap="3" wrap="wrap">
        <Field label="Сделать до" flex="1" minW="150px">
          <Input type="date" value={t.dueAt?.slice(0, 10) ?? ''} onChange={(e) => set({ dueAt: e.target.value ? e.target.value + (t.dueAt?.slice(10) ?? '') : undefined })} />
        </Field>
        <Field label="Время" w="110px">
          <Input type="time" value={t.dueAt?.slice(11, 16) ?? ''} disabled={!t.dueAt} onChange={(e) => set({ dueAt: t.dueAt!.slice(0, 10) + (e.target.value ? `T${e.target.value}` : '') })} />
        </Field>
      </HStack>
    ),
    project: t.parentId ? null : (
      <Field label="Проект">
        {project ? (
          <Chip onRemove={() => set({ projectId: undefined })}>
            {project.sigil ?? '🌿'} {project.title}
          </Chip>
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
        <Stack gap="2" w="full">
          {(t.personIds ?? []).length > 0 && (
            <HStack gap="1.5" wrap="wrap">
              {(t.personIds ?? []).map((id) => (
                <Chip key={id} onRemove={() => set({ personIds: (t.personIds ?? []).filter((x) => x !== id) })}>
                  {people[id]?.name ?? '?'}
                </Chip>
              ))}
            </HStack>
          )}
          <SuggestInput
            placeholder="имя"
            options={Object.values(people)
              .filter((p) => !(t.personIds ?? []).includes(p.id))
              .map((p) => ({ value: p.id, label: p.name }))}
            onPick={(id) => set({ personIds: [...(t.personIds ?? []), id] })}
            onCreate={(name) => {
              const id = nanoid(8)
              dispatch(actions.upsertPerson({ id, name, contact: '', notes: '' }))
              set({ personIds: [...(t.personIds ?? []), id] })
            }}
          />
          {scar && <ScarNote personIds={t.personIds ?? []} />}
        </Stack>
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
      <Field label="Название">
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
        <PriorityScale value={t.slot} onChange={(slot) => set({ slot })} />
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

/** Priority as a scale of three arrows: one — необязательное, two — дополнительное, three — главное. Tapping the chosen one clears it. */
const priority: TaskSlot[] = ['optional', 'extra', 'main']
function PriorityScale({ value, onChange }: { value?: TaskSlot; onChange: (slot: TaskSlot | undefined) => void }) {
  const at = value ? priority.indexOf(value) + 1 : 0
  return (
    <HStack gap="0.5" role="radiogroup" aria-label="Приоритет">
      {priority.map((slot, i) => {
        const on = at > i
        return (
          <Box
            as="button"
            key={slot}
            role="radio"
            aria-checked={value === slot}
            aria-label={slotLabel[slot]}
            title={slotLabel[slot]}
            p="1"
            lineHeight="0"
            cursor="pointer"
            color={on ? 'ember.300' : 'fg.subtle'}
            filter={on ? 'drop-shadow(0 0 4px var(--g-glow))' : undefined}
            _hover={{ color: 'ember.200' }}
            onClick={() => onChange(value === slot ? undefined : slot)}
          >
            <LuChevronUp size={26} strokeWidth={on ? 2.6 : 2} />
          </Box>
        )
      })}
    </HStack>
  )
}

/** How much she does not want a «надо» deed: 0–3 on a slider that turns bluer the heavier it is. */
const dreadBlue = ['#a59fb5', '#8f9bd0', '#6f8fe6', '#4b7bff']
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

/** A chosen person or project: tap to take it off. */
function Chip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <Box as="button" onClick={onRemove} cursor="pointer" display="inline-flex" aria-label="Убрать">
      <Badge variant="subtle" colorPalette="ember" borderRadius="full" px="2.5" py="1" fontSize="sm" fontWeight="normal">
        {children}
      </Badge>
    </Box>
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
