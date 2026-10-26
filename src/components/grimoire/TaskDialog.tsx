// The card of a deed: every attribute (the rarely used ones under «подробнее») and every action:
// done, part done, start a little, postpone with a reason, waiting, «потянуло за собой», split, let go.
import { Box, Button, Flex, HStack, Input, Separator, Stack, Text, Wrap } from '@chakra-ui/react'
import { useState } from 'react'
import { LuChevronDown, LuChevronUp } from 'react-icons/lu'
import { cancel, complete, reopen, toBacklog, useToday, withUndo } from '../../grimoire/act'
import { baseCoins, taskCoins } from '../../grimoire/coins'
import { addDays, daysBetween, humanDay } from '../../grimoire/days'
import {
  costOptions,
  dreadLabel,
  ownerKindLabel,
  postponeReasonLabel,
  slotLabel,
  sourceLabel,
  statusLabel,
  stepKinds,
  wantLabel,
  whyOptions,
} from '../../grimoire/labels'
import { chainOf, isOpenTask, isStuck, stepsOf, words } from '../../grimoire/selectors'
import type { PostponeReason, Task, TaskOwnerKind, TaskSlot, Want } from '../../grimoire/types'
import { store, useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { Chips, confirmAction, Field, Modal, NumInput, TextArea, TextInput } from '../ui'
import { MarkPicker, Tag } from './Marks'
import { usePlanGuard } from './PlanGuard'
import { TagInput } from './TagInput'

type Mode = 'edit' | 'postpone' | 'spawn' | 'split' | 'partial' | 'wait'

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

export function TaskDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const today = useToday()
  const g = useAppSelector((s) => s.grimoire)
  const people = useAppSelector((s) => s.data.people)
  const live = g.tasks[task.id] ?? task
  const [t, setT] = useState<Task>(live)
  const [more, setMore] = useState(false)
  const [mode, setMode] = useState<Mode>('edit')
  const [reason, setReason] = useState<PostponeReason | undefined>()
  const [to, setTo] = useState<string>(addDays(today, 1))
  const [text, setText] = useState('')
  const set = (p: Partial<Task>) => setT({ ...t, ...p })
  const open = isOpenTask(live)
  const w = words(g.meta)
  const steps = stepsOf(g, live.id)
  const chain = chainOf(g, live.id)
  const parent = live.parentId ? g.tasks[live.parentId] : undefined
  const origin = live.spawnedFrom ? g.tasks[live.spawnedFrom] : undefined
  const coins = taskCoins(t, today, g.meta.coins)

  function save() {
    dispatch(A.updateTask({ ...t, title: t.title.trim() || live.title }))
    onClose()
  }
  const [guard, guardDialog] = usePlanGuard()
  const act = (f: () => void) => {
    // Unsaved edits go in first, so «Сделано» pays by the stars just set.
    if (JSON.stringify(t) !== JSON.stringify(live)) dispatch(A.updateTask(t))
    f()
    onClose()
  }

  const footer =
    mode !== 'edit' ? (
      <Button variant="ghost" onClick={() => setMode('edit')}>
        Назад
      </Button>
    ) : (
      <>
        <Button
          variant="ghost"
          colorPalette="red"
          mr="auto"
          onClick={() => {
            if (confirmAction('Удалить дело насовсем? Монеты за него останутся в журнале.')) {
              dispatch(A.deleteTask(live.id))
              onClose()
            }
          }}
        >
          Удалить
        </Button>
        <Button onClick={save} disabled={!t.title.trim()}>
          Сохранить
        </Button>
      </>
    )

  return (
    <Modal open onClose={onClose} title={live.type === 'joy' ? 'Радость' : steps.length ? w.quest[0].toUpperCase() + w.quest.slice(1) : 'Дело'} footer={footer} size="lg">
      {guardDialog}
      {mode === 'postpone' && (
        <Stack gap="4">
          <Text fontSize="sm" color="fg.muted">
            Перенос без осуждения. Причину можно не выбирать.
          </Text>
          <Chips value={reason} onChange={(v) => setReason(v as PostponeReason | undefined)} options={Object.entries(postponeReasonLabel).map(([value, label]) => ({ value: value as PostponeReason, label }))} />
          <Field label="На какой день">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Wrap gap="2">
            <Button onClick={() => act(() => withUndo(`Перенесено на ${humanDay(to, today)}`, () => dispatch(A.postponeTask({ id: live.id, to, reason }))))}>Перенести</Button>
            <Button variant="outline" onClick={() => act(() => withUndo('В бэклоге', () => dispatch(A.postponeTask({ id: live.id, reason }))))}>
              В бэклог
            </Button>
          </Wrap>
        </Stack>
      )}

      {mode === 'partial' && (
        <Stack gap="4">
          <Field label="Что именно сделано" helper="даёт половину монет">
            <TextInput value={text} onChange={setText} placeholder="посылка упакована, не отправлена" />
          </Field>
          <Button onClick={() => act(() => { dispatch(A.updateTask({ id: live.id, partialNote: text || undefined })); complete({ ...t, partialNote: text }, true) })}>
            Сделана часть
          </Button>
        </Stack>
      )}

      {mode === 'wait' && (
        <Stack gap="4">
          <Field label="Проверить" helper="до этого дня дело не попадает в план">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Чего ждём">
            <TextInput value={text} onChange={setText} placeholder="ответ от мастера по ремонту" />
          </Field>
          <Button onClick={() => act(() => withUndo('Ждёт ответа', () => dispatch(A.setWaiting({ id: live.id, until: to || undefined, note: text || undefined }))))}>Ждать</Button>
        </Stack>
      )}

      {mode === 'spawn' && (
        <Stack gap="4">
          <Text fontSize="sm" color="fg.muted">
            В процессе выросло другое дело. «{live.title}» подождёт, пока хвост не закроется, а за каждое звено монеты начисляются отдельно.
          </Text>
          <Field label="Что потянуло">
            <TextInput value={text} onChange={setText} placeholder="Узнать, какая нужна лампочка" />
          </Field>
          <Button disabled={!text.trim()} onClick={() => act(() => withUndo('Потянуло за собой', () => dispatch(A.spawnTask({ fromId: live.id, fields: { title: text } }))))}>
            Создать звено
          </Button>
        </Stack>
      )}

      {mode === 'split' && (
        <Stack gap="4">
          <Text fontSize="sm" color="fg.muted">
            По шагу на строку. В план пойдёт только первый шаг.
          </Text>
          <Wrap gap="2">
            {stepKinds.map((k) => (
              <Button key={k} size="xs" variant="outline" borderRadius="full" onClick={() => setText((x) => (x && !x.endsWith('\n') ? `${x}\n` : x) + `${k[0].toUpperCase()}${k.slice(1)} `)}>
                {k}
              </Button>
            ))}
          </Wrap>
          <TextArea value={text} onChange={setText} rows={6} placeholder={'Решить, какой цвет\nКупить краску\nПокрасить'} />
          <Button disabled={!lines(text).length} onClick={() => act(() => withUndo('Расколото на шаги', () => dispatch(A.splitTask({ id: live.id, steps: lines(text) }))))}>
            Расколоть
          </Button>
        </Stack>
      )}

      {mode === 'edit' && (
        <Stack gap="4">
          {open && (
            <Wrap gap="2">
              <Button size="sm" onClick={() => act(() => complete(t))}>
                Сделано · +{coins.total}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMode('partial')}>
                Сделана часть
              </Button>
              {live.status !== 'inProgress' && !live.startedPaid && (
                <Button size="sm" variant="outline" onClick={() => act(() => withUndo(`Начато · +${g.meta.coins.startedCoins} 🪙`, () => dispatch(A.startTask({ id: live.id }))))}>
                  Начать понемногу
                </Button>
              )}
              {live.doOn !== today && (
                <Button size="sm" variant="outline" onClick={() => guard(t.slot ?? 'extra', () => act(() => withUndo('В плане на сегодня', () => dispatch(A.planTask({ id: live.id, day: today, slot: t.slot })))))}>
                  На сегодня
                </Button>
              )}
              {live.doOn && (
                <Button size="sm" variant="outline" onClick={() => setMode('postpone')}>
                  Перенести
                </Button>
              )}
              {live.doOn && (
                <Button size="sm" variant="ghost" onClick={() => act(() => toBacklog([live.id]))}>
                  В бэклог
                </Button>
              )}
            </Wrap>
          )}
          {!open && (
            <Flex align="center" gap="3" wrap="wrap">
              <Text fontSize="sm" color="fg.muted">
                {statusLabel[live.status]}
                {live.doneDay ? ` · ${humanDay(live.doneDay, today)}` : ''}
              </Text>
              <Button size="sm" variant="outline" onClick={() => act(() => reopen(live))}>
                Вернуть в работу
              </Button>
            </Flex>
          )}

          {isStuck(live) && (
            <Box p="3" borderRadius="l2" borderWidth="1px" borderColor="orange.800" bg="rgba(234,88,12,.06)">
              <Text fontSize="sm" mb="2">
                Буксует: перенесено {live.postponements.length} раз. Может, оно {live.want ? `«${wantLabel[live.want]}»` : 'не очень нужно'}
                {live.ownerKind && live.ownerKind !== 'mine' ? ` и вообще не твоя обязанность (${ownerKindLabel[live.ownerKind]})` : ''}?
              </Text>
              <Wrap gap="2">
                <Button size="xs" onClick={() => setMode('split')}>
                  Расколоть
                </Button>
                <Button size="xs" variant="outline" onClick={() => setMore(true)}>
                  Уменьшить
                </Button>
                <Button size="xs" variant="outline" onClick={() => setMode('spawn')}>
                  Изменить способ
                </Button>
                <Button size="xs" variant="ghost" onClick={() => act(() => cancel(live))}>
                  Отпустить
                </Button>
              </Wrap>
            </Box>
          )}

          <Field label="Название">
            <TextInput value={t.title} onChange={(v) => set({ title: v.slice(0, 200) })} />
          </Field>
          <Field label="Сложность">
            <MarkPicker kind="stars" value={t.stars} onChange={(v) => set({ stars: v as Task['stars'] })} />
          </Field>
          <Field label="Нехотение" helper={t.dread === 3 ? 'чудовище: награда больше, но в план само не полезет' : undefined}>
            <MarkPicker kind="dread" value={t.dread} onChange={(v) => set({ dread: v as Task['dread'] })} />
          </Field>
          <Text fontSize="xs" color="fg.muted" mt="-2">
            {baseCoins(t, g.meta.coins)} 🪙 за выполнение{coins.onTime ? ` + ${coins.onTime} в срок` : ''}
          </Text>
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
          {Object.keys(people).length > 0 && (
            <Field label="Люди">
              <Chips multi value={t.personIds ?? []} onChange={(v) => set({ personIds: (v as string[]) ?? [] })} options={Object.values(people).map((p) => ({ value: p.id, label: p.name }))} />
            </Field>
          )}
          <Field label="Награда" helper="своя настоящая, покажется в момент выполнения">
            <TextInput value={t.rewardText ?? ''} onChange={(v) => set({ rewardText: v || undefined })} placeholder="кофе на вынос" />
          </Field>
          <Field label="Заметка">
            <TextArea value={t.note ?? ''} onChange={(v) => set({ note: v || undefined })} />
          </Field>

          <Button variant="ghost" size="sm" alignSelf="flex-start" onClick={() => setMore(!more)}>
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
                <Field label="Монеты сверху" flex="1" minW="150px">
                  <NumInput value={t.extraCoins} onChange={(v) => set({ extraCoins: v })} />
                </Field>
              </HStack>
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

          {open && (
            <>
              <Separator />
              <Wrap gap="2">
                <Button size="xs" variant="outline" onClick={() => { setText(''); setMode('spawn') }}>
                  Потянуло за собой…
                </Button>
                {!steps.length && (
                  <Button size="xs" variant="outline" onClick={() => { setText(''); setMode('split') }}>
                    Расколоть
                  </Button>
                )}
                <Button size="xs" variant="outline" onClick={() => { setText(''); setTo(addDays(today, 3)); setMode('wait') }}>
                  Ждёт ответа
                </Button>
                <Button size="xs" variant="ghost" onClick={() => act(() => cancel(live))}>
                  Отпустить как ненужное
                </Button>
              </Wrap>
            </>
          )}

          {steps.length > 0 && (
            <Box>
              <Text fontSize="sm" color="fg.muted" mb="1">
                Шаги · {steps.filter((x) => x.status === 'done').length} из {steps.length}
              </Text>
              {steps.map((s) => (
                <Text key={s.id} fontSize="sm" textDecoration={s.status === 'done' ? 'line-through' : undefined} color={s.status === 'done' ? 'fg.subtle' : 'fg'}>
                  {s.title}
                  {s.doOn ? ` · ${humanDay(s.doOn, today)}` : ''}
                </Text>
              ))}
            </Box>
          )}
          {(chain.length > 0 || origin || parent) && (
            <Box fontSize="sm" color="fg.muted">
              {parent && <Text>Шаг квеста «{parent.title}»</Text>}
              {origin && <Text>Выросло из «{origin.title}»</Text>}
              {chain.length > 0 && (
                <Text>
                  Цепочка: {chain.length + 1} звена, {Math.max(1, daysBetween(live.createdAt.slice(0, 10), today))} дн. — {chain.map((c) => c.title).join(' → ')}
                </Text>
              )}
            </Box>
          )}
          <Box fontSize="xs" color="fg.subtle">
            <Text>
              {sourceLabel[live.source]} · создано {humanDay(live.createdAt.slice(0, 10), today)} · {dreadLabel[live.dread]}
            </Text>
            {live.postponements.length > 0 && (
              <Text>
                Переносы: {live.postponements.map((p) => `${p.day.slice(8, 10)}.${p.day.slice(5, 7)}${p.reason ? ` (${postponeReasonLabel[p.reason]})` : ''}`).join(', ')}
              </Text>
            )}
            {live.tags.length > 0 && (
              <HStack gap="1" mt="1" wrap="wrap">
                {live.tags.map((x) => (
                  <Tag key={x} name={x} />
                ))}
              </HStack>
            )}
          </Box>
        </Stack>
      )}
    </Modal>
  )
}

/** Keeps the open task card in one place for a page. */
export function useTaskDialog() {
  const [id, setId] = useState<string>()
  const task = useAppSelector((s) => (id ? s.grimoire.tasks[id] : undefined))
  return {
    open: (t: Task) => setId(t.id),
    dialog: task ? <TaskDialog key={task.id} task={store.getState().grimoire.tasks[task.id] ?? task} onClose={() => setId(undefined)} /> : null,
  }
}
