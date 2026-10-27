// «Заклинания»: quests kept as templates. A quest is saved as a spell from its card; casting one makes
// a fresh quest with the same steps in order — in the backlog, or in the book it was cast from.
import { Box, Button, Flex, HStack, IconButton, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuPencil, LuTrash2 } from 'react-icons/lu'
import { withUndo } from '../../grimoire/act'
import { words } from '../../grimoire/selectors'
import type { Spell } from '../../grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { confirmAction, Empty, Field, Modal, TextInput } from '../ui'
import { Stars } from './Marks'

function SpellRow({ sp, projectId, onCast }: { sp: Spell; projectId?: string; onCast: () => void }) {
  const dispatch = useAppDispatch()
  const [title, setTitle] = useState(sp.title)
  const [rename, setRename] = useState(false)
  const [open, setOpen] = useState(false)
  return (
    <Box p="3" borderRadius="l2" borderWidth="1px" borderColor="border" bg="bg.subtle">
      <Flex gap="2" align="center" wrap="wrap">
        {rename ? (
          <Box flex="1" minW="180px">
            <TextInput value={title} onChange={setTitle} />
          </Box>
        ) : (
          <Text flex="1" fontWeight="semibold" cursor="pointer" onClick={() => setOpen(!open)}>
            {sp.title}
          </Text>
        )}
        <Stars n={sp.stars} />
        <Text fontSize="xs" color="fg.muted">
          {sp.steps.length} шаг.
        </Text>
        {rename ? (
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              dispatch(A.renameSpell({ id: sp.id, title }))
              setRename(false)
            }}
          >
            Готово
          </Button>
        ) : (
          <IconButton size="xs" variant="ghost" aria-label="Переименовать" onClick={() => setRename(true)}>
            <LuPencil />
          </IconButton>
        )}
        <IconButton size="xs" variant="ghost" aria-label="Удалить" onClick={() => confirmAction(`Удалить «${sp.title}»? Квесты, уже созданные из него, останутся.`) && dispatch(A.deleteSpell(sp.id))}>
          <LuTrash2 />
        </IconButton>
      </Flex>
      {open && (
        <Stack gap="0.5" mt="2" fontSize="sm" color="fg.muted">
          {sp.steps.map((x, i) => (
            <Text key={i}>
              {i + 1}. {x.title}
            </Text>
          ))}
        </Stack>
      )}
      <HStack gap="2" mt="2">
        <Button size="xs" onClick={onCast}>
          Сотворить{projectId ? ' в книгу' : ''}
        </Button>
        {!open && (
          <Button size="xs" variant="ghost" onClick={() => setOpen(true)}>
            шаги
          </Button>
        )}
      </HStack>
    </Box>
  )
}

export function SpellsDialog({ projectId, onClose }: { projectId?: string; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const meta = useAppSelector((s) => s.grimoire.meta)
  const w = words(meta)
  const [casting, setCasting] = useState<Spell>()
  const [title, setTitle] = useState('')
  const spells = [...(meta.spells ?? [])].sort((a, b) => a.title.localeCompare(b.title, 'ru'))
  const cast = () => {
    const sp = casting!
    withUndo(`${w.spell[0].toUpperCase() + w.spell.slice(1)} сотворено: «${title.trim() || sp.title}»`, () => dispatch(A.castSpell({ spellId: sp.id, title, projectId })))
    onClose()
  }
  if (casting)
    return (
      <Modal
        open
        onClose={() => setCasting(undefined)}
        title={`Сотворить: ${casting.title}`}
        footer={
          <>
            <Button variant="ghost" mr="auto" onClick={() => setCasting(undefined)}>
              Назад
            </Button>
            <Button onClick={cast}>Сотворить</Button>
          </>
        }
      >
        <Stack gap="3">
          <Field label="Название квеста" helper="например, «Покрасить потолок в спальне»">
            <TextInput value={title} onChange={setTitle} placeholder={casting.title} />
          </Field>
          <Text fontSize="sm" color="fg.muted">
            {casting.steps.length} шаг. в том же порядке · {projectId ? 'в эту книгу' : 'в бэклог'}
          </Text>
        </Stack>
      </Modal>
    )
  return (
    <Modal open onClose={onClose} title={w.spells}>
      <Stack gap="2">
        {spells.length ? (
          spells.map((sp) => (
            <SpellRow
              key={sp.id}
              sp={sp}
              projectId={projectId}
              onCast={() => {
                setTitle('')
                setCasting(sp)
              }}
            />
          ))
        ) : (
          <Empty>Пока пусто. Открой {w.quest} с шагами и нажми «Сохранить как {w.spell}» — потом его можно будет сотворить снова.</Empty>
        )}
      </Stack>
    </Modal>
  )
}
