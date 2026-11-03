// A plain field for a new deed on the book pages: Enter adds it with the defaults (backlog, one star,
// «норм»), the sliders open the full «Новое дело» form with the text as its title. No symbols are
// parsed here: «купить #2» stays as written.
import { HStack, IconButton, Input } from '@chakra-ui/react'
import { useRef, useState } from 'react'
import { LuCornerDownLeft, LuSlidersHorizontal } from 'react-icons/lu'
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
