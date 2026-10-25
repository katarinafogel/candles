import { Box, Flex, Stack, Text } from '@chakra-ui/react'
import { useEffect, type ReactNode } from 'react'
import { LuBox, LuEllipsis, LuFlame, LuHouse, LuLayers, LuMessageSquare, LuScrollText, LuSettings, LuSparkles, LuUsers, LuWarehouse } from 'react-icons/lu'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { SyncBadge } from './SyncBadge'
import { useAppDispatch, useAppSelector } from '../store'
import { localActions } from '../store/localSlice'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

const primary: NavItem[] = [
  { to: '/', label: 'Главная', icon: <LuHouse /> },
  { to: '/holders', label: 'Подсвечники', icon: <LuBox /> },
  { to: '/candles', label: 'Свечи', icon: <LuFlame /> },
  { to: '/stock', label: 'Склад', icon: <LuWarehouse /> },
]

const secondary: NavItem[] = [
  { to: '/molds', label: 'Формы', icon: <LuLayers /> },
  { to: '/decor', label: 'Декор', icon: <LuSparkles /> },
  { to: '/people', label: 'Люди', icon: <LuUsers /> },
  { to: '/reviews', label: 'Отзывы', icon: <LuMessageSquare /> },
  { to: '/instructions', label: 'Инструкции', icon: <LuScrollText /> },
  { to: '/settings', label: 'Настройки', icon: <LuSettings /> },
]

export const moreItems = secondary

function SideLink({ item, badge }: { item: NavItem; badge?: number }) {
  return (
    <NavLink to={item.to} end={item.to === '/'}>
      {({ isActive }) => (
        <Flex
          align="center"
          gap="3"
          px="3"
          py="2"
          borderRadius="l2"
          color={isActive ? 'emerald.300' : 'fg.muted'}
          bg={isActive ? 'emerald.subtle' : 'transparent'}
          _hover={{ bg: 'bg.muted', color: 'fg' }}
          fontWeight={isActive ? 'semibold' : 'normal'}
        >
          <Box fontSize="lg">{item.icon}</Box>
          <Text flex="1">{item.label}</Text>
          {!!badge && (
            <Box bg="emerald.solid" color="emerald.contrast" borderRadius="full" px="2" fontSize="xs" fontWeight="bold">
              {badge}
            </Box>
          )}
        </Flex>
      )}
    </NavLink>
  )
}

const moreRoutes = ['/more', ...secondary.map((s) => s.to)]

function BottomLink({ item }: { item: NavItem }) {
  const loc = useLocation()
  const isMore = item.to === '/more' && moreRoutes.some((r) => loc.pathname.startsWith(r))
  return (
    <NavLink to={item.to} end={item.to === '/'} style={{ flex: 1 }}>
      {({ isActive }) => (
        <Stack
          align="center"
          gap="0.5"
          py="2"
          color={isActive || isMore ? 'emerald.300' : 'fg.subtle'}
          fontSize="2xs"
          fontWeight="medium"
        >
          <Box fontSize="xl">{item.icon}</Box>
          {item.label}
        </Stack>
      )}
    </NavLink>
  )
}

export default function Layout() {
  const dispatch = useAppDispatch()
  const unread = useAppSelector((s) => Object.values(s.data.reviews).filter((r) => !r.read).length)
  const loc = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])

  useEffect(() => {
    // Ask the browser not to evict our IndexedDB when space runs low.
    navigator.storage?.persist?.().then((ok) => dispatch(localActions.setPersistGranted(ok)))
  }, [dispatch])

  return (
    <Flex minH="100dvh">
      <Box
        as="nav"
        display={{ base: 'none', md: 'block' }}
        w="240px"
        flexShrink={0}
        borderRightWidth="1px"
        borderColor="border"
        bg="bg.subtle"
        position="sticky"
        top="0"
        h="100dvh"
        overflowY="auto"
        p="4"
      >
        <Flex align="center" gap="2" mb="6" px="2">
          <Box color="emerald.400" fontSize="2xl">
            <LuFlame />
          </Box>
          <Text fontWeight="bold" fontSize="lg" letterSpacing="-0.01em">
            Мастерская свечей
          </Text>
        </Flex>
        <Box mb="4" px="2">
          <SyncBadge />
        </Box>
        <Stack gap="1">
          {primary.map((i) => (
            <SideLink key={i.to} item={i} />
          ))}
          <Box h="1px" bg="border" my="3" />
          {secondary.map((i) => (
            <SideLink key={i.to} item={i} badge={i.to === '/reviews' ? unread : undefined} />
          ))}
        </Stack>
      </Box>

      <Box flex="1" minW="0" px={{ base: '4', md: '8' }} pt={{ base: '4', md: '8' }} pb={{ base: '24', md: '10' }} maxW="1200px">
        <Box display={{ base: 'flex', md: 'none' }} justifyContent="flex-end" mb="2">
          <SyncBadge />
        </Box>
        <Outlet />
      </Box>

      <Flex
        as="nav"
        display={{ base: 'flex', md: 'none' }}
        position="fixed"
        bottom="0"
        left="0"
        right="0"
        bg="bg.panel"
        borderTopWidth="1px"
        borderColor="border"
        pb="env(safe-area-inset-bottom)"
        zIndex="sticky"
      >
        {[...primary, { to: '/more', label: 'Ещё', icon: <LuEllipsis /> }].map((i) => (
          <BottomLink key={i.to} item={i} />
        ))}
      </Flex>
    </Flex>
  )
}
