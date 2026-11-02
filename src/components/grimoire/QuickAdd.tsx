// A plain field for a new deed on the book pages: Enter adds it with the defaults (backlog, one star,
// «норм»), the sliders open the full «Новое дело» form with the text as its title. The floating «+»
// opens the form at once. No symbols are parsed here: «купить #2» stays as written.
import { Box, Button, HStack, IconButton, Input } from '@chakra-ui/react'
import { useRef, useState } from 'react'
import { LuCornerDownLeft, LuPlus, LuSlidersHorizontal } from 'react-icons/lu'
import { useLocation } from 'react-router-dom'
import type { Task } from '../../grimoire/types'
import { store, useAppDispatch } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { NewTaskDialog } from './NewTaskDialog'

/** Finds workshop people by the name typed after @ (the bestiary shares them). */
export function matchPeople(names: string[]) {
  const people = Object.values(store.getState().data.people)
  return names.map((n) => {
    const q = n.toLowerCase()
    return people.find((p) => p.name.toLowerCase() === q) ?? people.find((p) => p.name.toLowerCase().startsWith(q))
  })
}

/** `fields` go into every deed added here (a book's deeds carry its projectId). */
export function QuickAdd({ fields: extra }: { fields?: Partial<Task> }) {
  const dispatch = useAppDispatch()
  const [line, setLine] = useState('')
  const [full, setFull] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const title = line.trim()

  function add() {
    if (!title) return
    dispatch(A.addTask({ fields: { title, ...extra } }))
    setLine('')
    input.current?.focus()
  }

  return (
    <HStack gap="2">
      <Input
        ref={input}
        value={line}
        onChange={(e) => setLine(e.target.value.slice(0, 200))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) add()
        }}
        placeholder="Новое дело…"
        enterKeyHint="done"
      />
      <IconButton aria-label="Добавить" onClick={add} disabled={!title}>
        <LuCornerDownLeft />
      </IconButton>
      <IconButton aria-label="Подробнее" title="Подробнее" variant="outline" onClick={() => setFull(true)}>
        <LuSlidersHorizontal />
      </IconButton>
      {full && <NewTaskDialog initialTitle={line} fields={extra} onClose={() => setFull(false)} onAdded={() => setLine('')} />}
    </HStack>
  )
}

/** The floating «+» on every grimoire screen opens «Новое дело». On the day scroll the deed goes into today's plan. */
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
      {open && <NewTaskDialog planToday={onScroll} onClose={() => setOpen(false)} />}
    </>
  )
}
