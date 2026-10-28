// «Из мастерской» / «В гримуар»: a workshop step becomes a deed, one step per item. From the grimoire
// one picks the step and the items ready for it; from the workshop's lists the picked items come in
// already. Only items with the same next step go into one deed, and none already in an open one.
import { Box, Button, Flex, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToday } from '../../grimoire/act'
import { addDays, humanDay } from '../../grimoire/days'
import { doneTitle, inOpenDeed, itemLabel, nextOffer, nextStep, plannedDay, questTitle, readySteps, stepTitles } from '../../grimoire/workshop'
import type { Task, WorkshopKind } from '../../grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { Check, Chips, Empty, Field, Modal, notify, TextInput } from '../ui'

export function FromWorkshopDialog({ preset, onClose }: { preset?: { kind: WorkshopKind; ids: string[] }; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const data = useAppSelector((s) => s.data)
  const tasks = useAppSelector((s) => s.grimoire.tasks)
  const today = useToday()
  const busy = inOpenDeed(tasks)
  const free = (kind: WorkshopKind, step: string) => (id: string) => !busy.has(`${kind}:${id}:${step}`)
  const groups = readySteps(data)
    .map((g) => ({ ...g, ids: g.ids.filter(free(g.kind, g.step)) }))
    .filter((g) => g.ids.length)
  const presetSteps = preset ? [...new Set(preset.ids.map((id) => nextStep(data, preset.kind, id)))] : []
  const mixed = presetSteps.length !== 1 || !presetSteps[0]
  const [key, setKey] = useState<string | undefined>(() => (preset && !mixed ? `${preset.kind}:${presetSteps[0]}` : groups[0] ? `${groups[0].kind}:${groups[0].step}` : undefined))
  const [kind, step] = (key?.split(':') ?? []) as [WorkshopKind | undefined, string | undefined]
  const byId = (a: string, b: string) => a.localeCompare(b, 'ru', { numeric: true })
  const pool = preset ? (mixed ? [] : preset.ids.filter(free(preset.kind, step!)).sort(byId)) : (groups.find((g) => `${g.kind}:${g.step}` === key)?.ids ?? [])
  const [picked, setPicked] = useState<string[] | null>(null)
  const ids = picked ?? pool
  const [title, setTitle] = useState('')
  const day = kind && step ? plannedDay(data, kind, step, ids, today) : undefined
  const already = preset ? preset.ids.length - pool.length : 0

  const create = () => {
    const t = title.trim() || questTitle(kind!, step!, ids.length)
    dispatch(A.addWorkshopQuest({ title: t, kind: kind!, step: step!, items: ids.map((id) => ({ id, label: itemLabel(data, kind!, id) })), doOn: day }))
    notify(`В гримуаре: «${t}»`, 'success', day ? `на ${humanDay(day, today)}` : 'в бэклоге', { label: 'Открыть', onClick: () => navigate('/g/book') })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={preset ? 'В гримуар' : 'Дело из мастерской'}
      footer={
        <Button disabled={!ids.length || !kind} onClick={create}>
          Завести дело · {ids.length}
        </Button>
      }
    >
      <Stack gap="4">
        {preset && mixed && (
          <Text color="orange.300" fontSize="sm">
            У выбранных изделий разные следующие шаги — в одно дело попадают только изделия с одинаковым шагом.
          </Text>
        )}
        {!preset &&
          (groups.length ? (
            <Field label="Шаг">
              <Chips
                value={key}
                onChange={(v) => {
                  setKey((v as string) ?? key)
                  setPicked(null)
                }}
                options={groups.map((g) => ({ value: `${g.kind}:${g.step}`, label: `${stepTitles[g.kind][g.step].todo} (${g.ids.length})` }))}
              />
            </Field>
          ) : (
            <Empty>Сейчас ни одно изделие не ждёт шага — или все уже в делах.</Empty>
          ))}
        {kind && step && pool.length > 0 && (
          <>
            <Field label={`Изделия, готовые к шагу «${stepTitles[kind][step].todo.toLowerCase()}»`}>
              <Stack gap="1">
                <Check checked={ids.length === pool.length} onChange={(v) => setPicked(v ? pool : [])}>
                  <Text fontSize="sm">все</Text>
                </Check>
                {pool.map((id) => (
                  <Check key={id} checked={ids.includes(id)} onChange={(v) => setPicked(v ? [...ids, id] : ids.filter((x) => x !== id))}>
                    <Text fontSize="sm">{itemLabel(data, kind, id)}</Text>
                  </Check>
                ))}
              </Stack>
            </Field>
            <Field label="Название" helper={day ? `когда делать: ${humanDay(day, today)} — по срокам из настроек мастерской` : 'в бэклог, без даты'}>
              <TextInput value={title} onChange={setTitle} placeholder={questTitle(kind, step, ids.length)} />
            </Field>
          </>
        )}
        {already > 0 && (
          <Box fontSize="sm" color="fg.muted">
            {already} уже в открытом деле — их не добавляю второй раз.
          </Box>
        )}
        {preset && !mixed && !pool.length && <Text fontSize="sm">Все выбранные изделия уже в открытом деле.</Text>}
      </Stack>
    </Modal>
  )
}

/**
 * After a workshop deed is closed: «Расписала 5 — завести «Покрыть лаком снаружи»?». One tap makes
 * the next deed for the same items (planned by the drying and curing days), or lets the offer go.
 */
export function NextStepOffer({ quest }: { quest: Task }) {
  const dispatch = useAppDispatch()
  const data = useAppSelector((s) => s.data)
  const tasks = useAppSelector((s) => s.grimoire.tasks)
  const today = useToday()
  const o = nextOffer(data, tasks, quest)
  if (!o || quest.workshopStep?.offered) return null
  const busy = inOpenDeed(tasks)
  const ids = o.ids.filter((id) => !busy.has(`${o.kind}:${id}:${o.step}`))
  if (!ids.length) return null
  const seen = () => dispatch(A.updateTask({ id: quest.id, workshopStep: { ...quest.workshopStep!, offered: true } }))
  const create = () => {
    const day = plannedDay(data, o.kind, o.step, ids, today)
    const t = questTitle(o.kind, o.step, ids.length)
    dispatch(A.addWorkshopQuest({ title: t, kind: o.kind, step: o.step, items: ids.map((id) => ({ id, label: itemLabel(data, o.kind, id) })), doOn: day }))
    seen()
    notify(`Заведено: «${t}»`, 'success', day ? `на ${humanDay(day, today)}` : 'в бэклоге')
  }
  return (
    <Flex gap="2" align="center" wrap="wrap" fontSize="sm">
      <Text flex="1" minW="200px">
        {doneTitle(quest.workshopStep!.kind, quest.workshopStep!.step, o.done)} — завести «{stepTitles[o.kind][o.step].todo}» для {ids.length}?
      </Text>
      <Button size="xs" onClick={create}>
        Завести
      </Button>
      <Button size="xs" variant="ghost" onClick={seen}>
        Не надо
      </Button>
    </Flex>
  )
}

/** Every closed workshop deed of the last two weeks still waiting for its «what next». */
export function WorkshopOffers() {
  const tasks = useAppSelector((s) => s.grimoire.tasks)
  const today = useToday()
  const quests = Object.values(tasks).filter((t) => t.workshopStep && !t.workshopStep.offered && t.status === 'done' && (t.doneDay ?? '') >= addDays(today, -14))
  if (!quests.length) return null
  return (
    <Box p="3" mb="4" borderRadius="l3" borderWidth="1px" borderColor="border" bg="bg.subtle">
      <Text fontFamily="heading" fontSize="lg" color="ember.100" mb="2">
        Мастерская: что дальше
      </Text>
      <Stack gap="2">
        {quests.map((q) => (
          <NextStepOffer key={q.id} quest={q} />
        ))}
      </Stack>
    </Box>
  )
}
