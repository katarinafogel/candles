// The grimoire's own shell in the workshop's style: side menu on a computer, bottom tabs on a phone,
// a «Мастерская / Гримуар» switch, coins in the header and the floating «+».
import { Box, Flex, Stack, Text } from '@chakra-ui/react'
import { useEffect, type ReactNode } from 'react'
import { LuBookOpen, LuEllipsis, LuFlame, LuGem, LuLibrary, LuMoon, LuScrollText, LuSparkles, LuSun } from 'react-icons/lu'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useBalance, useToday } from '../../grimoire/act'
import { words } from '../../grimoire/selectors'
import { builtInPractices } from '../../grimoire/wheel'
import { useAppDispatch, useAppSelector, useIsWitch } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { Eucalyptus, MoonPhases, MoonSlice, Sparkle } from '../Magic'
import { SyncBadge } from '../SyncBadge'
import { FeedbackPrompt } from './Feedback'
import { QuickAddButton } from './QuickAdd'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

/** The switch between the two books, shown only to a witch. */
export function ModeSwitch({ current }: { current: 'workshop' | 'grimoire' }) {
  const item = (to: string, label: string, on: boolean, icon: ReactNode) => (
    <NavLink to={to} style={{ flex: 1 }}>
      <Flex
        align="center"
        justify="center"
        gap="1.5"
        py="1.5"
        px="2.5"
        borderRadius="full"
        fontSize="xs"
        fontWeight={on ? 'semibold' : 'normal'}
        color={on ? 'ember.contrast' : 'fg.muted'}
        bg={on ? 'ember.solid' : 'transparent'}
      >
        {icon}
        {label}
      </Flex>
    </NavLink>
  )
  return (
    <Flex borderWidth="1px" borderColor="border" borderRadius="full" p="0.5" bg="bg.subtle" minW="210px">
      {item('/', 'Мастерская', current === 'workshop', <LuFlame />)}
      {item('/g', 'Гримуар', current === 'grimoire', <LuMoon />)}
    </Flex>
  )
}

function Coins() {
  const coins = useBalance()
  return (
    <NavLink to="/g/more">
      <Flex align="center" gap="1" color="ember.200" fontFamily="heading" fontSize="xl" fontWeight="semibold" title="монеты">
        <Sparkle size={11} />
        {coins}
      </Flex>
    </NavLink>
  )
}

/** Once a day after the account is loaded: habit tasks for today, and the starter practices once. */
function useDailyChores() {
  const dispatch = useAppDispatch()
  const today = useToday()
  const loadedAt = useAppSelector((s) => s.local.sync.loadedAt)
  const generatedFor = useAppSelector((s) => s.grimoire.meta.habitsGeneratedFor)
  const seeded = useAppSelector((s) => s.grimoire.meta.practicesSeeded)
  const navActive = useAppSelector((s) => s.grimoire.meta.nav.active)
  // Before the server copy arrives the device may hold stale tasks; writing on top of them could
  // reopen a task already ticked on another phone. Offline there is nothing newer to wait for.
  const ready = !!loadedAt || !navigator.onLine
  const timeZone = useAppSelector((s) => s.grimoire.meta.timeZone)
  useEffect(() => {
    if (!ready) return
    // The agent's server counts days in this zone.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && tz !== timeZone) dispatch(A.updateMeta({ timeZone: tz }))
    if (generatedFor !== today && !navActive) dispatch(A.generateHabitTasks())
    if (!seeded) dispatch(A.seedPractices(builtInPractices))
  }, [ready, today, generatedFor, seeded, navActive, timeZone, dispatch])
}

export default function GrimoireLayout() {
  const witch = useIsWitch()
  const meta = useAppSelector((s) => s.grimoire.meta)
  const loc = useLocation()
  useDailyChores()
  const w = words(meta)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])

  // Without the role the grimoire doesn't exist: its addresses lead to the workshop.
  if (!witch) return <Navigate to="/" replace />

  const items: NavItem[] = [
    { to: '/g', label: w.scroll, icon: <LuScrollText /> },
    { to: '/g/book', label: w.book, icon: <LuBookOpen /> },
    { to: '/g/rituals', label: w.rituals, icon: <LuMoon /> },
    { to: '/g/wheel', label: 'Колесо', icon: <LuSun /> },
  ]
  const more: NavItem = { to: '/g/more', label: 'Ещё', icon: <LuEllipsis /> }
  // On a phone these live under «Ещё»; the side menu shows them all.
  const extra: NavItem[] = [
    { to: '/g/projects', label: w.projects, icon: <LuLibrary /> },
    { to: '/g/mirror', label: 'Зеркало', icon: <LuGem /> },
    { to: '/g/wishes', label: 'Сундук желаний', icon: <LuSparkles /> },
  ]

  return (
    <Flex minH="100dvh">
      <Box as="nav" display={{ base: 'none', md: 'block' }} w="240px" flexShrink={0} borderRightWidth="1px" borderColor="border" bg="rgba(24, 21, 18, 0.92)" position="sticky" top="0" h="100dvh" overflowY="auto" className="quiet-scroll" p="4">
        <Flex align="center" gap="3" mb="3" px="1">
          <MoonSlice size={38} tone="stone" />
          <Text fontFamily="heading" fontWeight="semibold" fontSize="2xl" lineHeight="1" color="ember.100">
            Гримуар дел
          </Text>
        </Flex>
        <MoonPhases size={12} gap="2.5" color="ember.200" px="2" mb="4" />
        <Box mb="4">
          <ModeSwitch current="grimoire" />
        </Box>
        <Flex mb="4" px="2" justify="space-between" align="center">
          <SyncBadge />
          <Coins />
        </Flex>
        <Stack gap="1">
          {[...items, ...extra, { ...more, label: 'Ещё: монеты, навь, настройки' }].map((i) => (
            <NavLink key={i.to} to={i.to} end={i.to === '/g'}>
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
                  <Box fontSize="lg">{i.icon}</Box>
                  <Text flex="1">{i.label}</Text>
                </Flex>
              )}
            </NavLink>
          ))}
        </Stack>
        <Eucalyptus width={120} mx="auto" mt="10" opacity={0.45} />
      </Box>

      <Box flex="1" minW="0" position="relative" overflowX="clip">
        <Box position="relative" zIndex="1" px={{ base: '4', md: '8' }} pt={{ base: '4', md: '8' }} pb={{ base: '28', md: '24' }} maxW="1000px">
          <Flex display={{ base: 'flex', md: 'none' }} justify="space-between" align="center" mb="3" gap="3">
            <ModeSwitch current="grimoire" />
            <Flex align="center" gap="3">
              <SyncBadge />
              <Coins />
            </Flex>
          </Flex>
          {meta.nav.active && loc.pathname !== '/g' && (
            <Box mb="3" px="3" py="2" borderRadius="l2" bg="bg.muted" fontSize="xs" color="fg.muted">
              Ты в нави: серии заморожены, привычки молчат.
            </Box>
          )}
          <Outlet />
        </Box>
      </Box>

      <QuickAddButton />
      <FeedbackPrompt />

      <Flex as="nav" display={{ base: 'flex', md: 'none' }} position="fixed" bottom="0" left="0" right="0" bg="rgba(24, 21, 18, 0.94)" backdropFilter="blur(8px)" borderTopWidth="1px" borderColor="border" pb="env(safe-area-inset-bottom)" zIndex="sticky">
        {[...items, more].map((i) => (
          <NavLink key={i.to} to={i.to} end={i.to === '/g'} style={{ flex: 1 }}>
            {({ isActive: active }) => {
              const isActive = active || (i === more && extra.some((x) => loc.pathname.startsWith(x.to)))
              return (
              <Stack align="center" gap="0.5" py="2" color={isActive ? 'ember.300' : 'fg.subtle'} fontSize="2xs" fontWeight="medium">
                <Box fontSize="xl">{i.icon}</Box>
                {i.label}
              </Stack>
              )
            }}
          </NavLink>
        ))}
      </Flex>
    </Flex>
  )
}

