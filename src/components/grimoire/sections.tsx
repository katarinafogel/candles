// Every section of the grimoire in one place: where it lives, what it is called and its icon. The side
// menu, the phone's tabs and sheet and the «+» menu are all built from this list, so a section looks
// the same everywhere.
import { Box, Flex, Stack, Text } from '@chakra-ui/react'
import { NavLink, useLocation } from 'react-router-dom'
import { Icon, type IconName } from '@shared/icons'
import { words } from '@grimoire-core/grimoire/selectors'
import { useAppSelector } from '../../store'

export interface GrimoireSection {
  to: string
  label: string
  icon: IconName
  /** One of the phone's bottom tabs. */
  main?: boolean
  /** Where the menu starts a new group. */
  group: 'day' | 'life' | 'craft' | 'end'
}

export function useSections(): GrimoireSection[] {
  const meta = useAppSelector((s) => s.grimoire.meta)
  const w = words(meta)
  return [
    { to: '/', label: w.scroll, icon: 'scroll', main: true, group: 'day' },
    { to: '/book', label: w.book, icon: 'book-open', main: true, group: 'day' },
    { to: '/rituals', label: w.rituals, icon: 'moon', main: true, group: 'day' },
    { to: '/wheel', label: 'Колесо', icon: 'cloud-sun-alt', main: true, group: 'day' },
    { to: '/calendar', label: 'Календарь', icon: 'calendar-alt', group: 'life' },
    { to: '/projects', label: w.projects, icon: 'crown', group: 'life' },
    { to: '/mirror', label: 'Зеркало', icon: 'gem-alt', group: 'life' },
    { to: '/people', label: 'Бестиарий', icon: 'circle-user', group: 'life' },
    { to: '/wishes', label: 'Сундук желаний', icon: 'star-alt-3', group: 'life' },
    { to: '/jars', label: 'Копилки', icon: 'coins-alt', group: 'life' },
    { to: '/books', label: 'Книжная полка', icon: 'books', group: 'life' },
    { to: '/goals', label: 'Цели на год', icon: 'trophy', group: 'craft' },
    { to: '/events', label: 'События', icon: 'ticket-simple', group: 'craft' },
    { to: '/tarot', label: 'Таро', icon: 'card-cardician-magic-trick', group: 'craft' },
    { to: '/notes', label: 'Заметки', icon: 'thumbtack', group: 'craft' },
    { to: '/spells', label: w.spells, icon: 'equipment-magic-wand', group: 'craft' },
    { to: '/settings', label: 'Настройки', icon: 'gear', group: 'end' },
    { to: '/apps', label: 'Другие проекты', icon: 'circle-dots-horizontal', group: 'end' },
  ]
}

/** The section a path belongs to: «/projects/abc» is in «/projects», «/» only on itself. */
export function sectionOf(sections: GrimoireSection[], path: string) {
  return sections.find((s) => (s.to === '/' ? path === '/' : path === s.to || path.startsWith(`${s.to}/`)))
}

/** The menu as one even column of links (the groups only keep the order); the current section is lit. `onPick` — after a tap (closes the sheet). */
export function SectionList({ sections, onPick }: { sections: GrimoireSection[]; onPick?: () => void }) {
  const path = useLocation().pathname
  const current = sectionOf(sections, path)
  return (
    <Stack gap="1">
      {sections.map((s) => (
        <Box key={s.to}>
          <NavLink to={s.to} onClick={onPick}>
            <Flex
              align="center"
              gap="3"
              px="3"
              py="2"
              borderRadius="l2"
              color={s === current ? 'ember.200' : 'fg.muted'}
              bg={s === current ? 'ember.subtle' : 'transparent'}
              _hover={{ bg: 'bg.muted', color: 'fg' }}
              fontWeight={s === current ? 'semibold' : 'normal'}
              aria-current={s === current ? 'page' : undefined}
            >
              <Icon name={s.icon} size={20} />
              <Text flex="1">{s.label}</Text>
            </Flex>
          </NavLink>
        </Box>
      ))}
    </Stack>
  )
}
