// One field for a new deed: «помыть окна **☠☠ #дом !пт», «кино с @аня +радость».
// What the line will become is shown under it while typing.
import { Box, Button, HStack, IconButton, Input, Stack, Text } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { LuCornerDownLeft, LuPlus } from 'react-icons/lu'
import { useToday } from '../../grimoire/act'
import { humanDay } from '../../grimoire/days'
import { slotLabel } from '../../grimoire/labels'
import { parseQuickAdd } from '../../grimoire/parse'
import { overLimit, slotCounts } from '../../grimoire/selectors'
import type { TaskSlot } from '../../grimoire/types'
import { store, useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { Modal, notify } from '../ui'
import { Dread, Stars, Tag } from './Marks'

/** Finds workshop people by the name typed after @ (the bestiary shares them). */
export function matchPeople(names: string[]) {
  const people = Object.values(store.getState().data.people)
  return names.map((n) => {
    const q = n.toLowerCase()
    return people.find((p) => p.name.toLowerCase() === q) ?? people.find((p) => p.name.toLowerCase().startsWith(q))
  })
}

export function QuickAdd({ planToday, autoFocus, onAdded }: { planToday?: boolean; autoFocus?: boolean; onAdded?: () => void }) {
  const dispatch = useAppDispatch()
  const today = useToday()
  const meta = useAppSelector((s) => s.grimoire.meta)
  const [line, setLine] = useState('')
  const p = useMemo(() => parseQuickAdd(line, today), [line, today])
  const people = useMemo(() => matchPeople(p.people), [p.people])

  function add() {
    if (!p.title) return
    let title = p.title
    p.people.forEach((n, i) => {
      if (people[i]) title = title.replace(n, people[i]!.name)
    })
    const doOn = p.doOn ?? (planToday ? today : undefined)
    const slot: TaskSlot | undefined = doOn ? (p.slot ?? (planToday ? 'extra' : undefined)) : undefined
    if (doOn === today && slot && overLimit(meta, slotCounts(store.getState().grimoire, today), slot))
      notify(`На сегодня уже есть ${slotLabel[slot]}`, 'warning', 'План не запрещён, просто больше задуманного. Можно что-то убрать или сдвинуть.')
    dispatch(
      A.addTask({
        fields: {
          title,
          stars: p.stars,
          dread: p.dread,
          tags: p.tags,
          type: p.type,
          dueAt: p.dueAt,
          doOn,
          slot,
          personIds: people.filter(Boolean).map((x) => x!.id),
        },
      }),
    )
    setLine('')
    onAdded?.()
  }

  const shown = line.trim().length > 0
  return (
    <Stack gap="2">
      <HStack gap="2">
        <Input
          value={line}
          autoFocus={autoFocus}
          onChange={(e) => setLine(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="помыть окна **☠☠ #дом !пт"
          enterKeyHint="done"
        />
        <IconButton aria-label="Добавить" onClick={add} disabled={!p.title}>
          <LuCornerDownLeft />
        </IconButton>
      </HStack>
      {shown && (
        <HStack gap="2" wrap="wrap" fontSize="xs" color="fg.muted" px="1">
          <Text color="fg">{p.title || '…'}</Text>
          <Stars n={p.stars} size={11} />
          <Dread n={p.dread} size={11} />
          {p.type === 'joy' && <Text color="ember.300">радость</Text>}
          {p.tags.map((t) => (
            <Tag key={t} name={t} />
          ))}
          {p.dueAt && <Text>срок: {humanDay(p.dueAt, today)}</Text>}
          {(p.doOn ?? (planToday ? today : undefined)) && <Text>в план: {humanDay(p.doOn ?? today, today)}</Text>}
          {p.slot && <Text>{slotLabel[p.slot]}</Text>}
          {p.people.map((n, i) => (
            <Text key={n} color={people[i] ? 'emerald.300' : 'fg.subtle'}>
              @{people[i]?.name ?? `${n}?`}
            </Text>
          ))}
        </HStack>
      )}
      {!shown && (
        <Text fontSize="2xs" color="fg.subtle" px="1">
          * сложность · ☠ нехотение · #тег · !пт срок · @имя · +радость · +главное / +доп / +необяз
        </Text>
      )}
    </Stack>
  )
}

/** The floating «+» on every grimoire screen: a deed in two taps. */
export function QuickAddButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Box position="fixed" right={{ base: '4', md: '8' }} bottom={{ base: 'calc(76px + env(safe-area-inset-bottom))', md: '8' }} zIndex="sticky">
        <Button
          aria-label="Новое дело"
          borderRadius="full"
          size="lg"
          w="14"
          h="14"
          colorPalette="ember"
          boxShadow="0 8px 24px -8px rgba(0,0,0,.8), 0 0 24px -6px rgba(224,164,85,.5)"
          onClick={() => setOpen(true)}
        >
          <LuPlus />
        </Button>
      </Box>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="Новое дело">
          <QuickAdd autoFocus onAdded={() => setOpen(false)} />
        </Modal>
      )}
    </>
  )
}
