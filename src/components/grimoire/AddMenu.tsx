// The floating «+» on every grimoire screen: a tap rolls out a column of icons for what can be added —
// a wish, a jar, a book to read, a project, a ritual, a person, a mirror entry or a deed — over a dimmed page; a tap on the
// page, Esc or the «+» again rolls it back.
// A new deed goes where its form says (its «На сегодня» switch), from any page.
import { Box, Flex, Stack, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToday } from '../../grimoire/act'
import { Icon, type IconName } from '@shared/icons'
import { NewPerson } from '../../pages/grimoire/Bestiary'
import { blankEvent, EventDialog } from '../../pages/grimoire/Events'
import { blankNote, NoteDialog } from '../../pages/grimoire/Notes'
import { blankJar, JarDialog } from '../../pages/grimoire/Jars'
import { ProjectDialog } from '../../pages/grimoire/Projects'
import { blank as blankRitual, HabitDialog } from '../../pages/grimoire/Rituals'
import { WishDialog } from '../../pages/grimoire/Wishes'
import { NewTaskDialog } from './NewTaskDialog'
import { useSections } from './sections'
import { BookDialog, blankBook } from '../../pages/grimoire/Books'

type Kind = 'wish' | 'jar' | 'book' | 'project' | 'ritual' | 'person' | 'event' | 'note' | 'entry' | 'deed'

/** What can be added; a kind that has its own section wears that section's icon (sections.tsx). */
const items: { kind: Kind; label: string; section?: string; icon?: IconName }[] = [
  { kind: 'wish', label: 'Желание', section: '/wishes' },
  { kind: 'jar', label: 'Копилка', section: '/jars' },
  { kind: 'book', label: 'Книга', section: '/books' },
  { kind: 'project', label: 'Проект', section: '/projects' },
  { kind: 'ritual', label: 'Ритуал', section: '/rituals' },
  { kind: 'person', label: 'Человек', section: '/people' },
  { kind: 'event', label: 'Событие', section: '/events' },
  { kind: 'note', label: 'Заметка', section: '/notes' },
  { kind: 'entry', label: 'Запись', section: '/mirror' },
  { kind: 'deed', label: 'Дело', icon: 'leaf-2' },
]

export function AddMenu() {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState<Kind>()
  const today = useToday()
  const navigate = useNavigate()
  const sections = useSections()
  const iconOf = (i: (typeof items)[number]): IconName => i.icon ?? sections.find((x) => x.to === i.section)?.icon ?? 'plus'

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const pick = (k: Kind) => {
    setOpen(false)
    // A mirror entry is written on its own page.
    if (k === 'entry') navigate('/mirror/new')
    else setAdding(k)
  }
  const done = () => setAdding(undefined)

  return (
    <>
      <Box
        position="fixed"
        inset="0"
        zIndex="overlay"
        bg="var(--g-scrim)"
        opacity={open ? 1 : 0}
        pointerEvents={open ? 'auto' : 'none'}
        transition="opacity 0.2s"
        onClick={() => setOpen(false)}
      />
      <Stack
        position="fixed"
        right={{ base: '4', md: '8' }}
        bottom={{ base: 'calc(76px + env(safe-area-inset-bottom))', md: '8' }}
        zIndex="calc(var(--chakra-z-index-overlay) + 1)"
        align="center"
        gap="1"
        // The closed menu is invisible but still takes up a column: let clicks through to the page under it.
        pointerEvents="none"
      >
        <Stack
          gap="1"
          aria-hidden={!open}
          opacity={open ? 1 : 0}
          transform={open ? 'none' : 'translateY(16px) scale(0.95)'}
          transformOrigin="bottom center"
          pointerEvents={open ? 'auto' : 'none'}
          transition="opacity 0.18s, transform 0.18s"
        >
          {items.map((i) => (
            <Flex
              as="button"
              key={i.kind}
              aria-label={i.label}
              position="relative"
              className="group"
              w="12"
              h="12"
              align="center"
              justify="center"
              borderRadius="full"
              cursor="pointer"
              tabIndex={open ? 0 : -1}
              // A light tint of the accent, opaque so the dimmed page doesn't show through.
              bg="color-mix(in srgb, var(--chakra-colors-ember-400) 18%, var(--chakra-colors-bg-panel))"
              color="ember.fg"
              _hover={{ bg: 'color-mix(in srgb, var(--chakra-colors-ember-400) 30%, var(--chakra-colors-bg-panel))' }}
              onClick={() => pick(i.kind)}
            >
              <Icon name={iconOf(i)} size={26} />
              {/* What the button adds: beside it while the pointer is over it; on a phone, always. */}
              <Text
                as="span"
                position="absolute"
                right="calc(100% + 8px)"
                top="50%"
                transform="translateY(-50%)"
                whiteSpace="nowrap"
                fontSize="sm"
                px="2.5"
                py="1"
                borderRadius="l2"
                bg="bg.panel"
                color="fg"
                boxShadow="sm"
                pointerEvents="none"
                opacity="0"
                transition="opacity .12s"
                css={{ '.group:hover > &, .group:focus-visible > &': { opacity: 1 }, '@media (hover: none)': { opacity: 1 } }}
              >
                {i.label}
              </Text>
            </Flex>
          ))}
        </Stack>
        <Box
          as="button"
          aria-label="Добавить"
          aria-expanded={open}
          pointerEvents="auto"
          lineHeight="0"
          borderRadius="full"
          cursor="pointer"
          color="ember.solid"
          // The plus is cut out of the circle: a white disc behind keeps it white on any page.
          bg="radial-gradient(circle, white 55%, transparent 56%)"
          onClick={() => setOpen(!open)}
        >
          <Icon name="plus-circle-fill" size={76} />
        </Box>
      </Stack>
      {adding === 'wish' && <WishDialog wish={{ title: '' }} onClose={done} />}
      {adding === 'jar' && <JarDialog jar={blankJar} onClose={done} />}
      {adding === 'project' && <ProjectDialog project={{ title: '' }} onClose={done} />}
      {adding === 'ritual' && <HabitDialog habit={{ ...blankRitual, activeFrom: today }} onClose={done} />}
      {adding === 'person' && <NewPerson onClose={done} />}
      {adding === 'event' && <EventDialog event={blankEvent(today)} onClose={done} />}
      {adding === 'note' && <NoteDialog note={blankNote} onClose={done} />}
      {adding === 'book' && <BookDialog book={blankBook} onClose={done} />}
      {adding === 'deed' && <NewTaskDialog onClose={done} />}
    </>
  )
}
