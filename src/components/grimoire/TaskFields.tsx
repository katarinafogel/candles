// The fields of a deed, all shown at once: shared by the card (editing) and the «Новое дело» form,
// so a new field is added in one place.
import { Button, HStack, IconButton, Input, Stack } from '@chakra-ui/react'
import { nanoid } from '@reduxjs/toolkit'
import { useState, type Ref } from 'react'
import { LuPlus, LuX } from 'react-icons/lu'
import { costOptions, ownerKindLabel, slotLabel, wantLabel, whyOptions } from '../../grimoire/labels'
import type { TaskDraft } from '../../grimoire/newTask'
import type { ChecklistItem, Task, TaskOwnerKind, TaskSlot, Want } from '../../grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { actions } from '../../store/dataSlice'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { Check, Chips, Field, NumInput, Select, TextArea, TextInput } from '../ui'
import { MarkPicker } from './Marks'
import { ScarNote } from './ScarNote'
import { TagInput } from './TagInput'

/** `scar` shows the note about people (the card hides it on closed deeds); `onTitleEnter` — Enter in the title. */
export function TaskFields({
  value: t,
  onChange: set,
  titleRef,
  onTitleEnter,
  scar = true,
}: {
  value: TaskDraft
  onChange: (patch: Partial<Task>) => void
  titleRef?: Ref<HTMLInputElement>
  onTitleEnter?: () => void
  scar?: boolean
}) {
  const dispatch = useAppDispatch()
  const g = useAppSelector((s) => s.grimoire)
  const people = useAppSelector((s) => s.data.people)
  // Books to put the deed in: those being read, and the one it is in already, whatever its state.
  const books = Object.values(g.projects).filter((p) => p.status === 'active' || p.status === 'paused' || p.id === t.projectId)

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
      <Field label="Сложность">
        <MarkPicker kind="stars" value={t.stars} onChange={(v) => set({ stars: v as Task['stars'] })} />
      </Field>
      <Field label="Нехотение">
        <MarkPicker kind="dread" value={t.dread} onChange={(v) => set({ dread: v as Task['dread'] })} />
      </Field>
      <HStack gap="3" align="flex-start" wrap="wrap">
        <Field label="Тип" flex="1" minW="160px">
          <Chips value={t.type} onChange={(v) => set({ type: (v as Task['type']) ?? 'deed' })} options={[{ value: 'deed', label: 'дело' }, { value: 'joy', label: 'радость' }]} />
        </Field>
        <Field label="Приоритет" flex="2" minW="220px">
          <Chips value={t.slot} onChange={(v) => set({ slot: v as TaskSlot | undefined })} options={Object.entries(slotLabel).map(([value, label]) => ({ value: value as TaskSlot, label }))} />
        </Field>
      </HStack>
      <HStack gap="3" wrap="wrap">
        <Field label="Когда делать" flex="1" minW="150px">
          <Input type="date" value={t.doOn ?? ''} onChange={(e) => set(e.target.value ? { doOn: e.target.value } : { doOn: undefined, doAt: undefined })} />
        </Field>
        <Field label="Время" w="110px">
          <Input type="time" value={t.doAt ?? ''} disabled={!t.doOn} onChange={(e) => set({ doAt: e.target.value || undefined })} />
        </Field>
      </HStack>
      <HStack gap="3" wrap="wrap">
        <Field label="Сделать до" flex="1" minW="150px">
          <Input type="date" value={t.dueAt?.slice(0, 10) ?? ''} onChange={(e) => set({ dueAt: e.target.value ? e.target.value + (t.dueAt?.slice(10) ?? '') : undefined })} />
        </Field>
        <Field label="Время" w="110px">
          <Input type="time" value={t.dueAt?.slice(11, 16) ?? ''} disabled={!t.dueAt} onChange={(e) => set({ dueAt: t.dueAt!.slice(0, 10) + (e.target.value ? `T${e.target.value}` : '') })} />
        </Field>
      </HStack>
      <Field label="Теги" helper="Enter или запятая добавляет, тап по тегу убирает">
        <TagInput value={t.tags} onChange={(tags) => set({ tags })} />
      </Field>
      {!t.parentId && (
        <Field label="Проект" helper="дело будет жить на страницах этой книги">
          <Stack gap="2" w="full">
            {books.length > 0 && (
              <Select
                value={t.projectId}
                onChange={(v) => set({ projectId: v || undefined })}
                placeholder="без проекта"
                options={books.map((p) => ({ value: p.id, label: `${p.sigil ?? '🌿'} ${p.title}` }))}
              />
            )}
            <AddByName
              placeholder="новый проект"
              onAdd={(title) => {
                const id = nanoid()
                dispatch(A.upsertProject({ project: { id, title, status: 'active' } }))
                set({ projectId: id })
              }}
            />
          </Stack>
        </Field>
      )}
      <Field label="Люди" helper="с кем связано дело">
        <Stack gap="2" w="full">
          {Object.keys(people).length > 0 && (
            <Chips multi value={t.personIds ?? []} onChange={(v) => set({ personIds: (v as string[]) ?? [] })} options={Object.values(people).map((p) => ({ value: p.id, label: p.name }))} />
          )}
          <AddByName
            placeholder="новый человек"
            onAdd={(name) => {
              const known = Object.values(people).find((p) => p.name.toLowerCase() === name.toLowerCase())
              const id = known?.id ?? nanoid(8)
              if (!known) dispatch(actions.upsertPerson({ id, name, contact: '', notes: '' }))
              if (!(t.personIds ?? []).includes(id)) set({ personIds: [...(t.personIds ?? []), id] })
            }}
          />
          {scar && <ScarNote personIds={t.personIds ?? []} />}
        </Stack>
      </Field>
      <Field label="Заметка">
        <TextArea value={t.note ?? ''} onChange={(v) => set({ note: v || undefined })} />
      </Field>
      <Field label="Чеклист" helper="подзадачи: отмечай по ходу дела">
        <Checklist items={t.checklist ?? []} onChange={(checklist) => set({ checklist: checklist.length ? checklist : undefined })} />
      </Field>
      <Field label="Хочу / надо" helper="отдельно от нехотения: можно хотеть и бояться">
        <Chips value={t.want} onChange={(v) => set({ want: v as Want | undefined })} options={Object.entries(wantLabel).map(([value, label]) => ({ value: value as Want, label }))} />
      </Field>
      <Field label="Чья обязанность">
        <Chips value={t.ownerKind} onChange={(v) => set({ ownerKind: v as TaskOwnerKind | undefined })} options={Object.entries(ownerKindLabel).map(([value, label]) => ({ value: value as TaskOwnerKind, label }))} />
      </Field>
      <Field label="Почему важно">
        <Chips multi value={t.why ?? []} onChange={(v) => set({ why: (v as string[]) ?? [] })} options={whyOptions.map((x) => ({ value: x, label: x }))} />
      </Field>
      <TextInput value={t.whyText ?? ''} onChange={(v) => set({ whyText: v || undefined })} placeholder="своими словами" />
      <Field label="Стоимость сил">
        <Chips multi value={t.costs ?? []} onChange={(v) => set({ costs: (v as string[]) ?? [] })} options={costOptions.map((x) => ({ value: x, label: x }))} />
      </Field>
      <HStack gap="3" wrap="wrap">
        <Field label="Оценка времени" helper="всегда примерно" flex="1" minW="150px">
          <NumInput value={t.estimateMin} onChange={(v) => set({ estimateMin: v })} suffix="мин" />
        </Field>
      </HStack>
      <Check checked={!!t.evenInNav} onChange={(v) => set({ evenInNav: v || undefined })}>
        Напоминать даже в нави
      </Check>
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
    </>
  )
}

/** A name typed and added with Enter or «+»: a new person or project right from the form. */
function AddByName({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
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

/** Subtasks of one deed: tick, rename, remove; a new one is typed below and added with Enter. */
function Checklist({ items, onChange }: { items: ChecklistItem[]; onChange: (items: ChecklistItem[]) => void }) {
  const put = (id: string, patch: Partial<ChecklistItem>) => onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  return (
    <Stack gap="1.5" w="full">
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
      <AddByName placeholder="новая подзадача" onAdd={(text) => onChange([...items, { id: nanoid(6), text }])} />
    </Stack>
  )
}
