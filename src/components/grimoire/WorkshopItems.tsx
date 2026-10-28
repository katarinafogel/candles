// The items of a workshop deed, in its card: which are done, which wait, which went to defects.
// «Сделать шаг» opens the workshop's own dialog for the ticked ones (parameters once for all); a done
// item can be taken back while it is its last step; a defect is marked without leaving the grimoire.
import { Box, Button, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { canUndo, itemState, stepTitles } from '../../grimoire/workshop'
import { workshopRun } from '../../grimoire/workshopRun'
import type { Task } from '../../grimoire/types'
import { store, useAppSelector } from '../../store'
import { actions } from '../../store/dataSlice'
import { Check, confirmAction } from '../ui'

const stateLabel = { open: '', done: 'сделано', defect: 'брак', gone: 'удалено' } as const

export function WorkshopItems({ quest, onLeave }: { quest: Task; onLeave: () => void }) {
  const data = useAppSelector((s) => s.data)
  const tasks = useAppSelector((s) => s.grimoire.tasks)
  const steps = Object.values(tasks)
    .filter((t) => t.parentId === quest.id && t.workshop)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const rows = steps.map((t) => ({ t, link: t.workshop!, st: itemState(data, t.workshop!) }))
  const open = rows.filter((r) => r.st === 'open')
  const [picked, setPicked] = useState<string[]>(() => open.map((r) => r.link.id))
  const chosen = open.filter((r) => picked.includes(r.link.id)).map((r) => r.link.id)
  const { kind, step } = quest.workshopStep!
  const title = stepTitles[kind][step]?.todo ?? step
  const run = (ids: string[], defect?: boolean) => {
    onLeave()
    workshopRun.ask({ kind, step, ids, defect })
  }
  const undo = (id: string) => {
    if (!confirmAction(`Откатить «${title.toLowerCase()}» у ${id}? Материалы вернутся на склад, монеты за пункт спишутся.`)) return
    const date = new Date().toISOString()
    store.dispatch(kind === 'holder' ? actions.undoHolder({ id, date }) : actions.undoCandle({ id, date }))
  }
  return (
    <Box>
      <Flex align="center" justify="space-between" gap="2" mb="1.5" wrap="wrap">
        <Text fontSize="sm" color="fg.muted">
          Изделия · {rows.filter((r) => r.st === 'done').length} из {rows.filter((r) => r.st !== 'defect' && r.st !== 'gone').length}
        </Text>
        {open.length > 0 && (
          <Button size="xs" disabled={!chosen.length} onClick={() => run(chosen)}>
            {title} · {chosen.length}
          </Button>
        )}
      </Flex>
      <Stack gap="1">
        {rows.map(({ t, link, st }) => (
          <HStack key={t.id} gap="2" fontSize="sm" opacity={st === 'defect' || st === 'gone' ? 0.55 : 1}>
            {st === 'open' ? (
              <Check checked={picked.includes(link.id)} onChange={(v) => setPicked(v ? [...picked, link.id] : picked.filter((x) => x !== link.id))}>
                <Text fontSize="sm">{t.title}</Text>
              </Check>
            ) : (
              <Text flex="1" textDecoration={st === 'done' || st === 'defect' ? 'line-through' : undefined} color={st === 'done' ? 'fg.subtle' : undefined}>
                {t.title}
              </Text>
            )}
            <Box flex="1" />
            {st !== 'open' && (
              <Text fontSize="xs" color={st === 'defect' ? 'red.300' : 'fg.subtle'}>
                {stateLabel[st]}
              </Text>
            )}
            {st === 'done' && canUndo(data, link) && (
              <Button size="2xs" variant="ghost" onClick={() => undo(link.id)}>
                откатить
              </Button>
            )}
            {st === 'open' && (
              <Button size="2xs" variant="ghost" colorPalette="red" onClick={() => run([link.id], true)}>
                брак
              </Button>
            )}
            {st !== 'gone' && (
              <Button asChild size="2xs" variant="ghost">
                <RouterLink to={link.kind === 'holder' ? `/holders/${link.id}` : `/candles/${link.id}`} onClick={onLeave}>
                  →
                </RouterLink>
              </Button>
            )}
          </HStack>
        ))}
      </Stack>
    </Box>
  )
}
