import { Box, Flex, Stack, Text } from '@chakra-ui/react'
import { useEffect, type ReactNode } from 'react'
import { LuBox, LuEllipsis, LuFlame, LuHouse, LuLayers, LuLayoutGrid, LuMessageSquare, LuScrollText, LuSettings, LuSparkles, LuUsers, LuWarehouse } from 'react-icons/lu'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { GoApp } from '../lib/apps'
import { Eucalyptus, MoonPhases, MoonSlice, Sparkle } from '@shared/components/Magic'
import { HeaderRight } from './UserMenu'
import { useAppDispatch, useAppSelector, useIsMaster, useIsWitch } from '../store'
import { NoAccess } from './NoAccess'
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
  { to: '/materials', label: 'Склад', icon: <LuWarehouse /> },
]

const secondary: NavItem[] = [
  { to: '/molds', label: 'Формы', icon: <LuLayers /> },
  { to: '/decor', label: 'Декор', icon: <LuSparkles /> },
  { to: '/people', label: 'Люди', icon: <LuUsers /> },
  { to: '/reviews', label: 'Отзывы', icon: <LuMessageSquare /> },
  { to: '/instructions', label: 'Инструкции', icon: <LuScrollText /> },
  { to: '/settings', label: 'Настройки', icon: <LuSettings /> },
  { to: '/apps', label: 'Другие проекты', icon: <LuLayoutGrid /> },
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

const hasWorkshopData = (d: { molds: object; materials: object; holders: object; candles: object }) =>
  Object.keys(d.molds).length + Object.keys(d.materials).length + Object.keys(d.holders).length + Object.keys(d.candles).length > 0

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

  // The workshop is for the master role. A device that already holds workshop data stays open
  // while the roles are being refreshed, so nothing jumps away on the first start after an update.
  const master = useIsMaster()
  const witch = useIsWitch()
  const hasWorkshop = useAppSelector((s) => hasWorkshopData(s.data))
  if (!master && !hasWorkshop) return witch ? <GoApp app="grimoire" /> : <NoAccess />

  return (
    <Flex minH="100dvh">
      <Box
        as="nav"
        display={{ base: 'none', md: 'block' }}
        w="240px"
        flexShrink={0}
        borderRightWidth="1px"
        borderColor="border"
        bg="bg.nav"
        position="sticky"
        top="0"
        h="100dvh"
        overflowY="auto"
        className="quiet-scroll"
        p="4"
      >
        <Flex align="center" gap="3" mb="3" px="1">
          <MoonSlice size={38} />
          <Text fontFamily="heading" fontWeight="semibold" fontSize="2xl" lineHeight="1" color="ember.100">
            Гримуар
          </Text>
        </Flex>
        <MoonPhases size={12} gap="2.5" color="ember.200" px="2" mb="5" />
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
        <Box position="relative" zIndex="1" px={{ base: '4', md: '8' }} pt={{ base: 'calc(16px + env(safe-area-inset-top))', md: '8' }} pb={{ base: '24', md: '10' }}>
          <Flex as="header" justify="space-between" align="center" mb={{ base: '3', md: '5' }} gap="3">
            <Flex display={{ base: 'flex', md: 'none' }} align="center" gap="2">
              <MoonSlice size={26} />
              <Text fontFamily="heading" fontWeight="semibold" fontSize="lg" color="ember.100">
                Гримуар
              </Text>
            </Flex>
            <Box display={{ base: 'none', md: 'block' }} />
            <HeaderRight />
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
        bg="bg.nav"
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
