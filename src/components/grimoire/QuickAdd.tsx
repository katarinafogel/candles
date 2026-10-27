// One field for a new deed: «помыть окна **☠☠ #дом !пт», «кино с @аня +радость».
// What the line will become is shown under it while typing.
import { Box, Button, HStack, IconButton, Input, Stack, Text } from '@chakra-ui/react'
import { useMemo, useRef, useState } from 'react'
import { LuCornerDownLeft, LuPlus } from 'react-icons/lu'
import { useLocation } from 'react-router-dom'
import { useToday } from '../../grimoire/act'
import { humanDay } from '../../grimoire/days'
import { slotLabel } from '../../grimoire/labels'
import { parseQuickAdd } from '../../grimoire/parse'
import { completeTag, suggestTags, tagsByUse, typingTag } from '../../grimoire/tags'
import type { Task, TaskSlot } from '../../grimoire/types'
import { store, useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { Modal } from '../ui'
import { Dread, Stars, Tag } from './Marks'
import { usePlanGuard } from './PlanGuard'
import { ScarNote } from './ScarNote'

/** Finds workshop people by the name typed after @ (the bestiary shares them). */
export function matchPeople(names: string[]) {
  const people = Object.values(store.getState().data.people)
  return names.map((n) => {
    const q = n.toLowerCase()
    return people.find((p) => p.name.toLowerCase() === q) ?? people.find((p) => p.name.toLowerCase().startsWith(q))
  })
}

/** `fields` go into every deed added here (a book's deeds carry its projectId). */
export function QuickAdd({ planToday, autoFocus, onAdded, fields: extra }: { planToday?: boolean; autoFocus?: boolean; onAdded?: () => void; fields?: Partial<Task> }) {
  const dispatch = useAppDispatch()
  const today = useToday()
  const tasks = useAppSelector((s) => s.grimoire.tasks)
  const [line, setLine] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const p = useMemo(() => parseQuickAdd(line, today), [line, today])
  const people = useMemo(() => matchPeople(p.people), [p.people])
  const known = useMemo(() => tagsByUse({ tasks }), [tasks])
  const typing = typingTag(line)
  const hints = typing == null ? [] : suggestTags(typing, known, p.tags)
  const [guard, guardDialog] = usePlanGuard()

  function pickTag(tag: string) {
    setLine(completeTag(line, tag))
    input.current?.focus()
  }

  function add() {
    if (!p.title) return
    let title = p.title
    p.people.forEach((n, i) => {
      if (people[i]) title = title.replace(n, people[i]!.name)
    })
    const doOn = p.doOn ?? (planToday ? today : undefined)
    const slot: TaskSlot | undefined = doOn ? (p.slot ?? (planToday ? 'extra' : undefined)) : undefined
    const fields = {
      title,
      stars: p.stars,
      dread: p.dread,
      tags: p.tags,
      type: p.type,
      dueAt: p.dueAt,
      doOn,
      slot,
      personIds: people.filter(Boolean).map((x) => x!.id),
      ...extra,
    }
    // A full plan asks what to move first; the line stays until the deed is really added.
    guard(
      doOn === today ? slot : undefined,
      () => {
        dispatch(A.addTask({ fields }))
        setLine('')
        onAdded?.()
      },
      { stars: p.stars },
    )
  }

  const shown = line.trim().length > 0
  return (
    <Stack gap="2">
      <HStack gap="2">
        <Input
          ref={input}
          value={line}
          autoFocus={autoFocus}
          onChange={(e) => setLine(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
            // Tab takes the first suggested tag, the way a phone keyboard would.
            if (e.key === 'Tab' && hints.length) {
              e.preventDefault()
              pickTag(hints[0])
            }
          }}
          placeholder="помыть окна **☠☠ #дом !пт"
          enterKeyHint="done"
        />
        <IconButton aria-label="Добавить" onClick={add} disabled={!p.title}>
          <LuCornerDownLeft />
        </IconButton>
      </HStack>
      {hints.length > 0 && (
        <HStack gap="1.5" wrap="wrap" px="1">
          {hints.map((t) => (
            <Box as="button" key={t} onClick={() => pickTag(t)} onMouseDown={(e) => e.preventDefault()} cursor="pointer">
              <Tag name={t} />
            </Box>
          ))}
        </HStack>
      )}
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
      {shown && <ScarNote personIds={people.map((x) => x?.id)} />}
      {!shown && (
        <Text fontSize="2xs" color="fg.subtle" px="1">
          * сложность · ☠ нехотение · #тег · !пт срок · @имя · +радость · +главное / +доп / +необяз
        </Text>
      )}
      {guardDialog}
    </Stack>
  )
}

/** The floating «+» on every grimoire screen: a deed in two taps. On the day scroll it goes into today's plan. */
export function QuickAddButton() {
  const [open, setOpen] = useState(false)
  const onScroll = useLocation().pathname === '/g'
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
          <QuickAdd autoFocus planToday={onScroll} onAdded={() => setOpen(false)} />
        </Modal>
      )}
    </>
  )
}
