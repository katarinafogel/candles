import { Box, Flex, Stack, Text } from '@chakra-ui/react'
import { useEffect, type ReactNode } from 'react'
import { LuBox, LuEllipsis, LuFlame, LuHouse, LuLayers, LuMessageSquare, LuScrollText, LuSettings, LuSparkles, LuUsers, LuWarehouse } from 'react-icons/lu'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Eucalyptus, MoonPhases, MoonSlice, Sparkle } from './Magic'
import { SyncBadge } from './SyncBadge'
import { useAppDispatch, useAppSelector, useIsWitch } from '../store'
import { ModeSwitch } from './grimoire/GrimoireLayout'
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
          color={isActive ? 'ember.200' : 'fg.muted'}
          bg={isActive ? 'ember.subtle' : 'transparent'}
          boxShadow={isActive ? 'inset 2px 0 0 {colors.ember.400}' : undefined}
          _hover={{ bg: 'bg.muted', color: 'fg' }}
          fontWeight={isActive ? 'semibold' : 'normal'}
        >
          <Box fontSize="lg">{item.icon}</Box>
          <Text flex="1">{item.label}</Text>
          {!!badge && (
            <Box bg="ember.solid" color="ember.contrast" borderRadius="full" px="2" fontSize="xs" fontWeight="bold">
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
          color={isActive || isMore ? 'ember.300' : 'fg.subtle'}
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
  const witch = useIsWitch()
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
        bg="rgba(24, 21, 18, 0.92)"
        position="sticky"
        top="0"
        h="100dvh"
        overflowY="auto"
        p="4"
      >
        <Flex align="center" gap="3" mb="3" px="1">
          <MoonSlice size={38} />
          <Text fontFamily="heading" fontWeight="semibold" fontSize="2xl" lineHeight="1" color="ember.100">
            Мастерская свечей
          </Text>
        </Flex>
        <MoonPhases size={12} gap="2.5" color="ember.200" px="2" mb="5" />
        {/* Only a witch sees that the grimoire exists. */}
        {witch && (
          <Box mb="4">
            <ModeSwitch current="workshop" />
          </Box>
        )}
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
        <Flex justify="center" gap="3" mt="4" color="ember.300" opacity=".5">
          <Sparkle size={8} />
          <Sparkle size={12} />
          <Sparkle size={8} />
        </Flex>
      </Box>

      <Box flex="1" minW="0" position="relative" overflowX="clip">
        {/* Dried eucalyptus rising from the bottom corner, behind the content. */}
        <Box position="fixed" right="-30px" bottom="-20px" display={{ base: 'none', md: 'flex' }} alignItems="flex-end" opacity={0.35} pointerEvents="none">
          <Eucalyptus width={110} transform="scaleY(-1) rotate(-14deg)" mr="-40px" />
          <Eucalyptus width={170} transform="scaleY(-1) rotate(8deg)" />
        </Box>
        <Box position="relative" zIndex="1" px={{ base: '4', md: '8' }} pt={{ base: '4', md: '8' }} pb={{ base: '24', md: '10' }} maxW="1200px">
          <Flex display={{ base: 'flex', md: 'none' }} justify="space-between" align="center" mb="3" gap="3">
            {witch ? (
              <ModeSwitch current="workshop" />
            ) : (
              <Flex align="center" gap="2">
                <MoonSlice size={26} />
                <Text fontFamily="heading" fontWeight="semibold" fontSize="lg" color="ember.100">
                  Мастерская свечей
                </Text>
              </Flex>
            )}
            <SyncBadge />
          </Flex>
          <Outlet />
        </Box>
      </Box>

      <Flex
        as="nav"
        display={{ base: 'flex', md: 'none' }}
        position="fixed"
        bottom="0"
        left="0"
        right="0"
        bg="rgba(24, 21, 18, 0.94)"
        backdropFilter="blur(8px)"
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
