// «Заклинания» (шаблоны): one deed («вынести мусор»), a quest — all its steps at once, or a chain —
// one step at a time, the next appearing when the one before is done (постирать → развесить → снять).
// Kept from a deed's card or made here; casting one makes fresh deeds in the backlog or in the book
// it was cast from. When a deed is named, the templates are suggested (NewTaskDialog, QuickAdd).
import { Box, Button, Flex, HStack, IconButton, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuPencil, LuTrash2 } from 'react-icons/lu'
import { withUndo } from '../../grimoire/act'
import { words } from '../../grimoire/selectors'
import type { Spell } from '../../grimoire/types'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { Check, confirmAction, Empty, Field, Modal, Panel, TextArea, TextInput } from '../ui'
import { MarkPicker, Stars } from './Marks'
import { useAttempt } from './RoundBlocks'
import { TagInput } from './TagInput'

export const spellKind = (sp: Pick<Spell, 'steps' | 'chain'>) => (!sp.steps.length ? 'дело' : sp.chain ? 'цепочка' : 'квест')

function SpellRow({ sp, projectId, onCast, onEdit }: { sp: Spell; projectId?: string; onCast: () => void; onEdit: () => void }) {
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)
  return (
    <Panel>
      <Flex gap="2" align="center" wrap="wrap">
        <Text flex="1" fontWeight="semibold" cursor={sp.steps.length ? 'pointer' : undefined} onClick={() => setOpen(!open)}>
          {sp.title}
        </Text>
        <Stars n={sp.stars} />
        <Text fontSize="xs" color="fg.muted">
          {spellKind(sp)}
          {sp.steps.length ? ` · ${sp.steps.length} шаг.` : ''}
        </Text>
        <IconButton size="xs" variant="ghost" aria-label="Изменить" onClick={onEdit}>
          <LuPencil />
        </IconButton>
        <IconButton size="xs" variant="ghost" aria-label="Удалить" onClick={async () => (await confirmAction(`Удалить «${sp.title}»? Дела, уже созданные из него, останутся.`)) && dispatch(A.deleteSpell(sp.id))}>
          <LuTrash2 />
        </IconButton>
      </Flex>
      {open && sp.steps.length > 0 && (
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
      </HStack>
    </Panel>
  )
}

type Draft = Omit<Spell, 'createdAt' | 'id'> & { id?: string }
const blankSpell: Draft = { title: '', stars: 1, dread: 0, tags: [], steps: [] }

/** A template made or changed by hand: steps one per line; with «по одному» they become a chain. */
export function SpellEditor({ spell, onClose }: { spell: Draft; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [sp, setSp] = useState<Draft>(spell)
  const [lines, setLines] = useState(spell.steps.map((x) => x.title).join('\n'))
  const check = useAttempt()
  const save = () =>
    check.attempt(!!sp.title.trim(), () => {
      const titles = lines.split('\n').map((x) => x.trim()).filter(Boolean)
      // Steps keep their own marks when only the order or a word changed.
      const steps = titles.map((title) => spell.steps.find((x) => x.title === title) ?? { title, stars: sp.stars, dread: sp.dread })
      dispatch(A.upsertSpell({ spell: { ...sp, steps, chain: steps.length ? sp.chain : undefined } }))
      onClose()
    })
  return (
    <Modal open onClose={onClose} title={sp.id ? sp.title : 'Новый шаблон'} footer={<Button onClick={save}>Сохранить</Button>}>
      <Stack gap="4">
        <Field label="Название" invalid={check.missing(!sp.title.trim())} error="Назови шаблон">
          <TextInput value={sp.title} onChange={(title) => setSp({ ...sp, title })} />
        </Field>
        <HStack gap="6" wrap="wrap">
          <MarkPicker kind="stars" value={sp.stars} onChange={(v) => setSp({ ...sp, stars: v as Spell['stars'] })} />
          <MarkPicker kind="dread" value={sp.dread} onChange={(v) => setSp({ ...sp, dread: v as Spell['dread'] })} />
        </HStack>
        <Field label="Шаги" helper="по одному на строку; пусто — шаблон одного дела">
          <TextArea value={lines} onChange={setLines} rows={4} />
        </Field>
        {lines.trim() && (
          <Check checked={!!sp.chain} onChange={(chain) => setSp({ ...sp, chain: chain || undefined })}>
            Цепочкой: следующий шаг появится, когда сделан предыдущий
          </Check>
        )}
        <Field label="Теги">
          <TagInput value={sp.tags} onChange={(tags) => setSp({ ...sp, tags })} />
        </Field>
      </Stack>
    </Modal>
  )
}

/** The list of templates with casting; used by the dialog (from a book) and by the «Шаблоны» page. */
export function SpellList({ projectId, onCast }: { projectId?: string; onCast?: () => void }) {
  const dispatch = useAppDispatch()
  const meta = useAppSelector((s) => s.grimoire.meta)
  const w = words(meta)
  const [casting, setCasting] = useState<Spell>()
  const [editing, setEditing] = useState<Draft>()
  const [title, setTitle] = useState('')
  const spells = [...(meta.spells ?? [])].sort((a, b) => a.title.localeCompare(b.title, 'ru'))
  const cast = (sp: Spell, name?: string) => {
    withUndo(`${w.spell[0].toUpperCase() + w.spell.slice(1)} сотворено: «${name?.trim() || sp.title}»`, () => dispatch(A.castSpell({ spellId: sp.id, title: name, projectId })))
    setCasting(undefined)
    onCast?.()
  }
  return (
    <Stack gap="2">
      <HStack gap="2" wrap="wrap">
        <Button size="sm" variant="outline" onClick={() => setEditing(blankSpell)}>
          Новый шаблон
        </Button>
        <Button size="sm" variant="ghost" onClick={() => withUndo('Добавлены стартовые шаблоны', () => dispatch(A.addStarterSpells()))}>
          Добавить стартовые
        </Button>
      </HStack>
      {spells.length ? (
        spells.map((sp) => (
          <SpellRow
            key={sp.id}
            sp={sp}
            projectId={projectId}
            onEdit={() => setEditing(sp)}
            onCast={() => {
              // A quest is named on casting; a single deed or a chain goes right away.
              if (sp.steps.length && !sp.chain) {
                setTitle('')
                setCasting(sp)
              } else cast(sp)
            }}
          />
        ))
      ) : (
        <Empty>Пока пусто. Шаблон — это дело, {w.quest} или цепочка дел, которые повторяются: «вынести мусор», «стирка». Сохрани дело из его карточки или заведи шаблон здесь.</Empty>
      )}
      {editing && <SpellEditor spell={editing} onClose={() => setEditing(undefined)} />}
      {casting && (
        <Modal
          open
          onClose={() => setCasting(undefined)}
          title={`Сотворить: ${casting.title}`}
          footer={<Button onClick={() => cast(casting, title)}>Сотворить</Button>}
        >
          <Stack gap="3">
            <Field label="Название квеста" helper="можно оставить как в шаблоне">
              <TextInput value={title} onChange={setTitle} placeholder={casting.title} />
            </Field>
            <Text fontSize="sm" color="fg.muted">
              {casting.steps.length} шаг. в том же порядке · {projectId ? 'в эту книгу' : 'в бэклог'}
            </Text>
          </Stack>
        </Modal>
      )}
    </Stack>
  )
}

export function SpellsDialog({ projectId, onClose }: { projectId?: string; onClose: () => void }) {
  const meta = useAppSelector((s) => s.grimoire.meta)
  return (
    <Modal open onClose={onClose} title={words(meta).spells}>
      <SpellList projectId={projectId} onCast={onClose} />
    </Modal>
  )
}
