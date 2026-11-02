// The fields of a deed, from the title to the end of «подробнее»: shared by the card (editing) and
// the «Новое дело» form, so a new field is added in one place.
import { Button, HStack, Input, Stack } from '@chakra-ui/react'
import type { Ref } from 'react'
import { LuChevronDown, LuChevronUp } from 'react-icons/lu'
import { useToday } from '../../grimoire/act'
import { humanDay } from '../../grimoire/days'
import { costOptions, ownerKindLabel, slotLabel, wantLabel, whyOptions } from '../../grimoire/labels'
import type { TaskDraft } from '../../grimoire/newTask'
import type { Task, TaskOwnerKind, TaskSlot, Want } from '../../grimoire/types'
import { useAppSelector } from '../../store'
import { Check, Chips, Field, NumInput, Select, TextArea, TextInput } from '../ui'
import { MarkPicker } from './Marks'
import { ScarNote } from './ScarNote'
import { TagInput } from './TagInput'

/**
 * `more` is kept outside: the card's «Уменьшить» opens it. `scar` shows the note about people
 * (the card hides it on closed deeds); `onTitleEnter` — Enter in the title.
 */
export function TaskFields({
  value: t,
  onChange: set,
  more,
  onMore,
  titleRef,
  onTitleEnter,
  scar = true,
}: {
  value: TaskDraft
  onChange: (patch: Partial<Task>) => void
  more: boolean
  onMore: (more: boolean) => void
  titleRef?: Ref<HTMLInputElement>
  onTitleEnter?: () => void
  scar?: boolean
}) {
  const today = useToday()
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
      <Field label="Нехотение" helper={t.dread === 3 ? 'чудовище: в план само не полезет' : undefined}>
        <MarkPicker kind="dread" value={t.dread} onChange={(v) => set({ dread: v as Task['dread'] })} />
      </Field>
      <HStack gap="3" align="flex-start" wrap="wrap">
        <Field label="Тип" flex="1" minW="160px">
          <Chips value={t.type} onChange={(v) => set({ type: (v as Task['type']) ?? 'deed' })} options={[{ value: 'deed', label: 'дело' }, { value: 'joy', label: 'радость' }]} />
        </Field>
        <Field label="Очерёдность" flex="2" minW="220px">
          <Chips value={t.slot} onChange={(v) => set({ slot: v as TaskSlot | undefined })} options={Object.entries(slotLabel).map(([value, label]) => ({ value: value as TaskSlot, label }))} />
        </Field>
      </HStack>
      <HStack gap="3" wrap="wrap">
        <Field label="Когда делать" flex="1" minW="150px" helper={t.doOn ? humanDay(t.doOn, today) : 'пусто — в бэклоге'}>
          <Input type="date" value={t.doOn ?? ''} onChange={(e) => set({ doOn: e.target.value || undefined })} />
        </Field>
        <Field label="Дедлайн" flex="1" minW="150px" helper="только реальный срок">
          <Input type="date" value={t.dueAt?.slice(0, 10) ?? ''} onChange={(e) => set({ dueAt: e.target.value ? e.target.value + (t.dueAt?.slice(10) ?? '') : undefined })} />
        </Field>
        <Field label="Время" w="110px">
          <Input type="time" value={t.dueAt?.slice(11, 16) ?? ''} disabled={!t.dueAt} onChange={(e) => set({ dueAt: t.dueAt!.slice(0, 10) + (e.target.value ? `T${e.target.value}` : '') })} />
        </Field>
      </HStack>
      <Field label="Теги" helper="Enter или запятая добавляет, тап по тегу убирает">
        <TagInput value={t.tags} onChange={(tags) => set({ tags })} />
      </Field>
      {!t.parentId && (books.length > 0 || t.projectId) && (
        <Field label="Книга" helper="дело будет жить на её страницах">
          <Select
            value={t.projectId}
            onChange={(v) => set({ projectId: v || undefined })}
            placeholder="без книги"
            options={books.map((p) => ({ value: p.id, label: `${p.sigil ?? '🌿'} ${p.title}` }))}
          />
        </Field>
      )}
      {Object.keys(people).length > 0 && (
        <Field label="Люди">
          <Stack gap="2">
            <Chips multi value={t.personIds ?? []} onChange={(v) => set({ personIds: (v as string[]) ?? [] })} options={Object.values(people).map((p) => ({ value: p.id, label: p.name }))} />
            {scar && <ScarNote personIds={t.personIds ?? []} />}
          </Stack>
        </Field>
      )}
      <Field label="Награда" helper="своя настоящая, покажется в момент выполнения">
        <TextInput value={t.rewardText ?? ''} onChange={(v) => set({ rewardText: v || undefined })} placeholder="кофе на вынос" />
      </Field>
      <Field label="Заметка">
        <TextArea value={t.note ?? ''} onChange={(v) => set({ note: v || undefined })} />
      </Field>

      <Button variant="ghost" size="sm" alignSelf="flex-start" onClick={() => onMore(!more)}>
        {more ? <LuChevronUp /> : <LuChevronDown />} Подробнее
      </Button>
      {more && (
        <Stack gap="4">
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
          <Field label="Достаточный результат">
            <TextInput value={t.enough ?? ''} onChange={(v) => set({ enough: v || undefined })} placeholder="одна полка разобрана" />
          </Field>
          <Field label="Где остановиться">
            <TextInput value={t.stopAt ?? ''} onChange={(v) => set({ stopAt: v || undefined })} placeholder="остальные не трогать" />
          </Field>
          <Field label="Если упрусь">
            <TextInput value={t.ifStuck ?? ''} onChange={(v) => set({ ifStuck: v || undefined })} />
          </Field>
          <HStack gap="3" align="flex-start" wrap="wrap">
            <Field label="Подготовка" helper="по пункту на строку" flex="1" minW="200px">
              <TextArea value={(t.prep ?? []).join('\n')} onChange={(v) => set({ prep: v ? v.split('\n') : undefined })} placeholder="достать принадлежности" />
            </Field>
            <Field label="Завершение" helper="по пункту на строку" flex="1" minW="200px">
              <TextArea value={(t.wrapUp ?? []).join('\n')} onChange={(v) => set({ wrapUp: v ? v.split('\n') : undefined })} placeholder="вынести мусор" />
            </Field>
          </HStack>
          <HStack gap="3" wrap="wrap">
            <Field label="Оценка времени" helper="всегда примерно" flex="1" minW="150px">
              <NumInput value={t.estimateMin} onChange={(v) => set({ estimateMin: v })} suffix="мин" />
            </Field>
          </HStack>
          <Check checked={!!t.evenInNav} onChange={(v) => set({ evenInNav: v || undefined })}>
            Напоминать даже в нави
          </Check>
          <Field label="Повтор" helper="для бытовых дел без трекера: сделала — дело вернётся само">
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
          <Field label="Зона дома">
            <Chips value={t.zone} onChange={(v) => set({ zone: v as string | undefined })} options={g.meta.zones.map((z) => ({ value: z, label: z }))} />
          </Field>
        </Stack>
      )}
    </>
  )
}
