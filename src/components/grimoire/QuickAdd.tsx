// A plain field for a new deed on the book pages: Enter adds it with the defaults (backlog, one star,
// «норм»), the sliders open the full «Новое дело» form with the text as its title. No symbols are
// parsed here: «купить #2» stays as written.
import { HStack, IconButton, Input, Stack } from '@chakra-ui/react'
import { useRef, useState } from 'react'
import { LuCornerDownLeft, LuSlidersHorizontal } from 'react-icons/lu'
import type { Spell, Task } from '@grimoire-core/grimoire/types'
import { store, useAppDispatch } from '../../store'
import { grimoireActions as A } from '@grimoire-core/store/grimoireSlice'
import { NewTaskDialog } from './NewTaskDialog'
import { SpellHints } from './SpellHints'

/** Finds workshop people by the name typed after @ (the bestiary shares them). */
export function matchPeople(names: string[]) {
  const people = Object.values(store.getState().grimoire.beings)
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

  function fromSpell(sp: Spell) {
    if (sp.steps.length) dispatch(A.castSpell({ spellId: sp.id, projectId: extra?.projectId, fields: extra }))
    else {
      dispatch(A.upsertSpell({ spell: { ...sp, uses: (sp.uses ?? 0) + 1 } }))
      dispatch(A.addTask({ fields: { title: sp.title, stars: sp.stars, dread: sp.dread, tags: [...sp.tags], ...extra } }))
    }
    setLine('')
    input.current?.focus()
  }

  return (
    <Stack gap="2">
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
      <IconButton aria-label="Добавить" onClick={add}>
        <LuCornerDownLeft />
      </IconButton>
      <IconButton aria-label="Подробнее" title="Подробнее" variant="outline" onClick={() => setFull(true)}>
        <LuSlidersHorizontal />
      </IconButton>
      {full && <NewTaskDialog initialTitle={line} fields={extra} onClose={() => setFull(false)} onAdded={() => setLine('')} />}
    </HStack>
    <SpellHints typed={line} onPick={fromSpell} />
    </Stack>
  )
}
