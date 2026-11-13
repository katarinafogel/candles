// The card of a deed: every attribute (the rarely used ones under «подробнее») and every action:
// done, part done, start a little, postpone with a reason, waiting, «потянуло за собой», split, let go.
import { Box, Button, Flex, HStack, Input, Separator, Stack, Text, Wrap } from '@chakra-ui/react'
import { useState } from 'react'
import { LuGripVertical, LuLink, LuX } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { cancel, complete, reopen, start, toBacklog, useToday, withUndo } from '../../grimoire/act'
import { isFrog } from '@grimoire-core/grimoire/frog'
import { addDays, daysBetween, humanDay } from '@grimoire-core/grimoire/days'
import { dreadLabel, ownerKindLabel, postponeReasonLabel, sourceLabel, statusLabel, stepKinds, wantLabel } from '@grimoire-core/grimoire/labels'
import { chainOf, isOpenTask, isStuck, stepsOf, words } from '@grimoire-core/grimoire/selectors'
import type { PostponeReason, Task } from '@grimoire-core/grimoire/types'
import { store, useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '@grimoire-core/store/grimoireSlice'
import { Chips, DateInput, DeleteButton, Field, Modal, TextArea, TextInput } from '@shared/components/ui'
import { WordChip } from './EmotionWheel'
import { FrogIcon } from './Marks'
import { usePlanGuard } from './PlanGuard'
import { TaskFields, useFieldBlocks } from './TaskFields'
import { WorkshopItems } from './WorkshopItems'
import { NextStepOffer } from './FromWorkshop'
import { useReorder } from './useReorder'

type Mode = 'edit' | 'postpone' | 'spawn' | 'split' | 'partial' | 'wait' | 'block'

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)

export function TaskDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const today = useToday()
  const g = useAppSelector((s) => s.grimoire)
  const people = useAppSelector((s) => s.grimoire.beings)
  const live = g.tasks[task.id] ?? task
  const navigate = useNavigate()
  const [t, setT] = useState<Task>(live)
  const [mode, setMode] = useState<Mode>('edit')
  const [reason, setReason] = useState<PostponeReason | undefined>()
  const [to, setTo] = useState<string>(addDays(today, 1))
  const [text, setText] = useState('')
  const set = (p: Partial<Task>) => setT((x) => ({ ...x, ...p }))
  const blocks = useFieldBlocks(t, set, live.parentId ? ['project'] : [])
  const open = isOpenTask(live)
  const w = words(g.meta)
  const steps = stepsOf(g, live.id)
  const chain = chainOf(g, live.id)
  const parent = live.parentId ? g.tasks[live.parentId] : undefined
  // «Ждёт другое дело»: what this deed waits for, what waits for it, and what it could wait for
  // (open deeds, not rituals, not already linked, not those that wait for it — that would be a circle).
  const waitsOn = (live.blockedBy ?? []).map((id) => g.tasks[id]).filter(Boolean)
  const holds = Object.values(g.tasks).filter((x) => x.blockedBy?.includes(live.id))
  const blockCandidates = Object.values(g.tasks)
    .filter((x) => x.id !== live.id && !x.habitId && isOpenTask(x) && !live.blockedBy?.includes(x.id) && !holds.some((h) => h.id === x.id))
    .sort((a, b) => (a.doOn ?? '9999').localeCompare(b.doOn ?? '9999') || a.title.localeCompare(b.title, 'ru'))
  const origin = live.spawnedFrom ? g.tasks[live.spawnedFrom] : undefined

  // The frog fields and the «ждёт» links change through their own buttons while the card is open;
  // the form never writes them back.
  const edits = () => {
    const { frog: _f, postponeCount: _c, eatOn: _e, blockedBy: _b, ...rest } = t
    return rest
  }
  function save() {
    const write = () => {
      dispatch(A.updateTask({ ...edits(), title: t.title.trim() || live.title }))
      onClose()
    }
    // Moved onto today, or made harder while on today: the plan may be full.
    const wasToday = live.doOn === today && isOpenTask(live)
    const extraStars = wasToday ? Math.max(0, t.stars - live.stars) : t.stars
    if (t.doOn === today && !live.habitId && (!wasToday || extraStars > 0))
      guard(true, write, { stars: extraStars, self: live.id, starsOnly: wasToday })
    else write()
  }
  const [guard, guardDialog] = usePlanGuard()
  const act = (f: () => void) => {
    // Unsaved edits go in first, so «Сделано» pays by the stars just set.
    if (JSON.stringify(t) !== JSON.stringify(live)) dispatch(A.updateTask(edits()))
    f()
    onClose()
  }

  const footer =
    mode !== 'edit' ? (
      <Button variant="ghost" onClick={() => setMode('edit')}>
        Назад
      </Button>
    ) : (
      <Stack gap="3" w="full">
        {blocks.toolbar}
        <HStack gap="2">
          <DeleteButton confirm="Удалить дело насовсем?" onDelete={() => {
            dispatch(A.deleteTask(live.id))
            onClose()
          }}
          />
          <Button onClick={save}>
            Сохранить
          </Button>
        </HStack>
      </Stack>
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
            <DateInput value={to} onChange={setTo} />
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
          <Field label="Что именно сделано">
            <TextInput value={text} onChange={setText} />
          </Field>
          <Button onClick={() => act(() => { dispatch(A.updateTask({ id: live.id, partialNote: text || undefined })); complete({ ...t, partialNote: text }, true) })}>
            Сделана часть
          </Button>
        </Stack>
      )}

      {mode === 'wait' && (
        <Stack gap="4">
          <Field label="Проверить" helper="до этого дня дело не попадает в план">
            <DateInput value={to} onChange={setTo} />
          </Field>
          <Field label="Чего ждём">
            <TextInput value={text} onChange={setText} />
          </Field>
          <Button onClick={() => act(() => withUndo('Ждёт ответа', () => dispatch(A.setWaiting({ id: live.id, until: to || undefined, note: text || undefined }))))}>Ждать</Button>
        </Stack>
      )}

      {mode === 'spawn' && (
        <Stack gap="4">
          <Text fontSize="sm" color="fg.muted">
            В процессе выросло другое дело. «{live.title}» подождёт, пока хвост не закроется.
          </Text>
          <Field label="Что потянуло">
            <TextInput value={text} onChange={setText} />
          </Field>
          <Button disabled={!text.trim()} onClick={() => act(() => withUndo('Потянуло за собой', () => dispatch(A.spawnTask({ fromId: live.id, fields: { title: text } }))))}>
            Создать звено
          </Button>
        </Stack>
      )}

      {mode === 'block' && (
        <Stack gap="3">
          <Text fontSize="sm" color="fg.muted">
            «{live.title}» подождёт выбранное дело: до его закрытия в план не встанет, а на карточке будет видно, чего ждёт.
          </Text>
          <TextInput value={text} onChange={setText} placeholder="найти дело" />
          <Stack gap="1" maxH="50vh" overflowY="auto">
            {blockCandidates
              .filter((x) => !text.trim() || x.title.toLowerCase().includes(text.trim().toLowerCase()))
              .slice(0, 30)
              .map((x) => (
                <Flex key={x.id} as="button" textAlign="left" align="center" gap="2" px="2" py="2" borderRadius="l2" _hover={{ bg: 'bg.muted' }} onClick={() => {
                  dispatch(A.linkBlock({ id: live.id, blockerId: x.id, on: true }))
                  setMode('edit')
                }}>
                  <Text fontSize="sm" flex="1">{x.title}</Text>
                  {x.doOn && <Text fontSize="xs" color="fg.subtle">{humanDay(x.doOn, today)}</Text>}
                </Flex>
              ))}
            {!blockCandidates.length && <Text fontSize="sm" color="fg.subtle">Нет открытых дел, которые можно ждать.</Text>}
          </Stack>
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
          <TextArea value={text} onChange={setText} rows={6} />
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
                Сделано
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMode('partial')}>
                Сделана часть
              </Button>
              {live.status !== 'inProgress' && (
                <Button size="sm" variant="outline" onClick={() => act(() => start(live))}>
                  Начать понемногу
                </Button>
              )}
              {live.doOn !== today && (
                <Button size="sm" variant="outline" onClick={() => guard(true, () => act(() => withUndo('В плане на сегодня', () => dispatch(A.planTask({ id: live.id, day: today })))), { stars: t.stars, self: live.id })}>
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
            <Box p="3" borderRadius="l2" borderWidth="1px" borderColor="ember.700" bg="ember.subtle">
              <Text fontSize="sm" mb="2">
                Буксует: перенесено {live.postponements.length} раз. Может, оно {live.want ? `«${wantLabel[live.want]}»` : 'не очень нужно'}
                {live.ownerKind && live.ownerKind !== 'mine' ? ` и вообще не твоя обязанность (${ownerKindLabel[live.ownerKind]})` : ''}?
              </Text>
              <Wrap gap="2">
                <Button size="xs" onClick={() => setMode('split')}>
                  Расколоть
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

          {isFrog(live) && open && (
            <Box p="3" borderRadius="l2" borderWidth="1px" borderColor="emerald.800" bg="emerald.subtle">
              <HStack gap="2" mb="2" color="green.300">
                <FrogIcon size={18} />
                <Text fontSize="sm" color="fg">
                  Это жаба.
                  {(live.postponeCount ?? 0) > 0 ? ` Откладывалась ${live.postponeCount} раз.` : ''}
                </Text>
              </HStack>
              <Wrap gap="2">
                {live.eatOn === today ? (
                  <Button size="xs" variant="outline" onClick={() => dispatch(A.eatFrog({ id: live.id }))}>
                    Не сегодня
                  </Button>
                ) : (
                  <Button size="xs" colorPalette="green" onClick={() => guard(live.doOn !== today, () => act(() => dispatch(A.eatFrog({ id: live.id, day: today }))), { stars: t.stars, self: live.id })}>
                    Съесть сегодня
                  </Button>
                )}
                <Button size="xs" variant="ghost" onClick={() => dispatch(A.setFrog({ id: live.id, frog: false }))}>
                  Перестала пугать — снять жабу
                </Button>
              </Wrap>
            </Box>
          )}

          {live.workshopStep && <WorkshopItems quest={live} onLeave={onClose} />}
          {live.workshopStep && live.status === 'done' && <NextStepOffer quest={live} />}
          <DeedMirror taskId={live.id} onGo={(to) => {
            onClose()
            navigate(to)
          }} />

          <TaskFields value={t} onChange={set} scar={open} shown={blocks.shown} opened={blocks.opened} />

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
                <Button size="xs" variant="outline" onClick={() => { setText(''); setMode('block') }}>
                  Ждёт другое дело…
                </Button>
                <Button size="xs" variant="ghost" onClick={() => act(() => cancel(live))}>
                  Отпустить как ненужное
                </Button>
              </Wrap>
            </>
          )}

          {(waitsOn.length > 0 || holds.length > 0) && (
            <Stack gap="1.5" fontSize="sm">
              {waitsOn.map((x) => (
                <HStack key={x.id} gap="2">
                  <Box color="fg.subtle" display="inline-flex">
                    <LuLink />
                  </Box>
                  <Text flex="1" color={isOpenTask(x) ? 'fg' : 'fg.subtle'}>
                    Ждёт: {x.title}
                    {isOpenTask(x) ? '' : ' (уже закрыто)'}
                  </Text>
                  <Button size="2xs" variant="ghost" aria-label="Больше не ждать" onClick={() => dispatch(A.linkBlock({ id: live.id, blockerId: x.id, on: false }))}>
                    <LuX />
                  </Button>
                </HStack>
              ))}
              {holds.length > 0 && <Text color="fg.muted">Держит: {holds.map((x) => x.title).join(', ')}</Text>}
            </Stack>
          )}

          {!live.workshopStep && steps.length > 0 && <QuestSteps questId={live.id} today={today} />}
          {!live.workshopStep && !live.habitId && !live.parentId && steps.length === 0 && <SaveAsSpell taskId={live.id} title={live.title} />}
          {live.workshop && (
            <Text fontSize="sm" color="fg.muted">
              Пункт дела мастерской: отметится сам, когда {live.workshop.id} пройдёт этот шаг в мастерской.
            </Text>
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
            {open && !isFrog(live) && (
              <Button size="2xs" variant="ghost" px="1" ml="-1" color="fg.subtle" onClick={() => dispatch(A.setFrog({ id: live.id, frog: true }))}>
                <FrogIcon size={12} /> сделать жабой
              </Button>
            )}
            {live.postponements.length > 0 && (
              <Text>
                Переносы: {live.postponements.map((p) => `${p.day.slice(8, 10)}.${p.day.slice(5, 7)}${p.reason ? ` (${postponeReasonLabel[p.reason]})` : ''}`).join(', ')}
              </Text>
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

/** The deed's side of the link with the mirror: its entries, and a way to add one tied to it. */
function DeedMirror({ taskId, onGo }: { taskId: string; onGo: (to: string) => void }) {
  const journal = useAppSelector((s) => s.grimoire.journal)
  const mine = Object.values(journal)
    .filter((e) => e.taskId === taskId)
    .sort((a, b) => a.at.localeCompare(b.at))
  return (
    <Flex gap="2" align="center" wrap="wrap" fontSize="sm">
      <Text color="fg.muted">В зеркале:</Text>
      {mine.map((e) =>
        e.words?.length ? (
          <HStack key={e.id} gap="1" as="button" onClick={() => onGo(`/g/mirror/${e.id}`)}>
            <Text fontSize="xs" color="fg.subtle">
              {e.source === 'task_start' ? 'до' : e.type === 'taskFeedback' ? 'после' : ''}
            </Text>
            {e.words.map((k) => (
              <WordChip key={k} wordKey={k} size="xs" />
            ))}
          </HStack>
        ) : (
          <Button key={e.id} size="2xs" variant="ghost" onClick={() => onGo(`/g/mirror/${e.id}`)}>
            запись
          </Button>
        ),
      )}
      <Button size="2xs" variant="outline" onClick={() => onGo(`/g/mirror/new?task=${taskId}`)}>
        + чувство
      </Button>
    </Flex>
  )
}

/** A simple deed kept as a one-deed template («вынести мусор»): it is then suggested when a deed is named. */
function SaveAsSpell({ taskId, title }: { taskId: string; title: string }) {
  const dispatch = useAppDispatch()
  const meta = useAppSelector((s) => s.grimoire.meta)
  const w = words(meta)
  const saved = (meta.spells ?? []).some((sp) => sp.title.toLowerCase() === title.trim().toLowerCase())
  return (
    <Box>
      <Button size="2xs" variant="ghost" disabled={saved} onClick={() => withUndo(`Сохранено как ${w.spell}`, () => dispatch(A.saveSpell({ taskId })))}>
        {saved ? `уже есть ${w.spell}` : `Сохранить как ${w.spell}`}
      </Button>
    </Box>
  )
}

/** A quest's steps: open ones dragged by the grip to change the order; the quest kept as a spell. */
function QuestSteps({ questId, today }: { questId: string; today: string }) {
  const dispatch = useAppDispatch()
  const g = useAppSelector((s) => s.grimoire)
  const w = words(g.meta)
  const all = stepsOf(g, questId).filter((s) => s.status !== 'cancelled')
  const openIds = all.filter((s) => s.status !== 'done').map((s) => s.id)
  const reorder = useReorder(openIds, (ids) => dispatch(A.reorderTasks(ids)))
  const shown = [...reorder.shown.map((id) => g.tasks[id]).filter(Boolean), ...all.filter((s) => s.status === 'done')]
  const saved = (g.meta.spells ?? []).some((sp) => sp.title === g.tasks[questId]?.title)
  return (
    <Box>
      <Flex align="center" justify="space-between" gap="2" mb="1" wrap="wrap">
        <Text fontSize="sm" color="fg.muted">
          Шаги · {all.filter((x) => x.status === 'done').length} из {all.length}
        </Text>
        <Button
          size="2xs"
          variant="ghost"
          disabled={saved}
          onClick={() => withUndo(`Сохранено как ${w.spell}`, () => dispatch(A.saveSpell({ taskId: questId })))}
        >
          {saved ? `уже есть ${w.spell}` : `Сохранить как ${w.spell}`}
        </Button>
      </Flex>
      <Stack gap="0.5">
        {shown.map((s) => {
          const movable = s.status !== 'done'
          return (
            <HStack key={s.id} data-reorder={movable ? s.id : undefined} gap="1" opacity={reorder.dragging === s.id ? 0.5 : 1} py="0.5">
              <Box
                as="button"
                aria-label="Перетащить шаг"
                display="inline-flex"
                color="fg.subtle"
                cursor="grab"
                touchAction="none"
                visibility={movable ? 'visible' : 'hidden'}
                onPointerDown={(e: React.PointerEvent) => movable && reorder.onPointerDown(s.id, e)}
              >
                <LuGripVertical />
              </Box>
              <Text fontSize="sm" textDecoration={s.status === 'done' ? 'line-through' : undefined} color={s.status === 'done' ? 'fg.subtle' : 'fg'}>
                {s.title}
                {s.doOn ? ` · ${humanDay(s.doOn, today)}` : ''}
              </Text>
            </HStack>
          )
        })}
      </Stack>
    </Box>
  )
}
