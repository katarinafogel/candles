// The floating «+» on every grimoire screen: a tap rolls out what can be added — a wish, a book,
// a ritual, a person, a mirror entry or a deed — over a dimmed page; a tap on the page, Esc or the «+» again rolls it back.
// On the day scroll a new deed goes into today's plan.
import { Box, Flex, Stack, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToday } from '../../grimoire/act'
import { Icon, type IconName } from '../../icons'
import { NewPerson } from '../../pages/grimoire/Bestiary'
import { ProjectDialog } from '../../pages/grimoire/Projects'
import { blank as blankRitual, HabitDialog } from '../../pages/grimoire/Rituals'
import { WishDialog } from '../../pages/grimoire/Wishes'
import { NewTaskDialog } from './NewTaskDialog'

type Kind = 'wish' | 'project' | 'ritual' | 'person' | 'entry' | 'deed'

const items: { kind: Kind; label: string; icon: IconName }[] = [
  { kind: 'wish', label: 'Желание', icon: 'star-alt-3' },
  { kind: 'project', label: 'Проект', icon: 'book-open' },
  { kind: 'ritual', label: 'Ритуал', icon: 'moon' },
  { kind: 'person', label: 'Человек', icon: 'circle-user' },
  { kind: 'entry', label: 'Запись', icon: 'pen-nib' },
  { kind: 'deed', label: 'Дело', icon: 'leaf-2' },
]

export function AddMenu() {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState<Kind>()
  const today = useToday()
  const onScroll = useLocation().pathname === '/g'
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const pick = (k: Kind) => {
    setOpen(false)
    // A mirror entry is written on its own page.
    if (k === 'entry') navigate('/g/mirror/new')
    else setAdding(k)
  }
  const done = () => setAdding(undefined)

  return (
    <>
      <Box
        position="fixed"
        inset="0"
        zIndex="overlay"
        bg="rgba(0, 0, 0, 0.4)"
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
        align="flex-end"
        gap="3"
      >
        {items.map((i, n) => (
          <Flex
            as="button"
            key={i.kind}
            align="center"
            gap="4"
            mr="1"
            cursor="pointer"
            aria-hidden={!open}
            tabIndex={open ? 0 : -1}
            opacity={open ? 1 : 0}
            transform={open ? 'none' : 'translateY(16px) scale(0.9)'}
            pointerEvents={open ? 'auto' : 'none'}
            transition="opacity 0.18s, transform 0.18s"
            transitionDelay={`${(open ? items.length - 1 - n : 0) * 40}ms`}
            onClick={() => pick(i.kind)}
          >
            <Text minW="32" textAlign="center" px="5" py="1.5" borderRadius="full" bg="white" color="black" fontSize="xl" shadow="sm">
              {i.label}
            </Text>
            <Flex w="14" h="14" align="center" justify="center" borderRadius="full" bg="ember.solid" color="ember.contrast" opacity={0.75} shadow="md">
              <Icon name={i.icon} size={30} />
            </Flex>
          </Flex>
        ))}
        <Box
          as="button"
          aria-label="Добавить"
          aria-expanded={open}
          lineHeight="0"
          borderRadius="full"
          cursor="pointer"
          color="ember.solid"
          // The plus is cut out of the circle: a white disc behind keeps it white on any page.
          bg="radial-gradient(circle, white 55%, transparent 56%)"
          filter="drop-shadow(0 8px 16px var(--g-shade))"
          onClick={() => setOpen(!open)}
        >
          <Icon name="plus-circle-fill" size={76} />
        </Box>
      </Stack>
      {adding === 'wish' && <WishDialog wish={{ title: '' }} onClose={done} />}
      {adding === 'project' && <ProjectDialog project={{ title: '' }} onClose={done} />}
      {adding === 'ritual' && <HabitDialog habit={{ ...blankRitual, activeFrom: today }} onClose={done} />}
      {adding === 'person' && <NewPerson onClose={done} />}
      {adding === 'deed' && <NewTaskDialog planToday={onScroll} onClose={done} />}
    </>
  )
}
