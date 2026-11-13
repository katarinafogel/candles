// The grimoire's own shell in the workshop's style: side menu on a computer; on a phone the main tabs at the
// bottom and «Меню», a sheet with the rest (sections.tsx); the floating «+» with its menu.
import { Box, Flex, Stack } from '@chakra-ui/react'
import { useEffect, useState, Suspense } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Icon, type IconName } from '@shared/icons'
import { Sheet } from '@shared/components/ui'
import { sectionOf, SectionList, useSections } from './sections'
import { GoApp } from '../../lib/apps'
import { useToday } from '../../grimoire/act'
import { daysBetween } from '@grimoire-core/grimoire/days'
import { builtInPractices } from '@grimoire-core/grimoire/wheel'
import { useAppDispatch, useAppSelector, useIsMaster, useIsWitch } from '../../store'
import { PageLoading } from '../PageLoading'
import { NoAccess } from '../NoAccess'
import { AppMark } from '../AppMark'
import { grimoireActions as A } from '@grimoire-core/store/grimoireSlice'
import { Eucalyptus, MoonPhases } from '@shared/components/Magic'
import { HeaderRight } from '../UserMenu'
import { FeedbackPrompt } from './Feedback'
import { AddMenu } from './AddMenu'


/** Once a day after the account is loaded: habit tasks for today, and the starter practices once. */
function useDailyChores() {
  const dispatch = useAppDispatch()
  const today = useToday()
  const loadedAt = useAppSelector((s) => s.local.sync.loadedAt)
  const generatedFor = useAppSelector((s) => s.grimoire.meta.habitsGeneratedFor)
  const seeded = useAppSelector((s) => s.grimoire.meta.practicesSeeded && s.grimoire.meta.esbatsSeeded)
  const navActive = useAppSelector((s) => s.grimoire.meta.nav.active)
  // Before the server copy arrives the device may hold stale tasks; writing on top of them could
  // reopen a task already ticked on another phone. Offline there is nothing newer to wait for.
  const ready = !!loadedAt || !navigator.onLine
  const timeZone = useAppSelector((s) => s.grimoire.meta.timeZone)
  const lastSeen = useAppSelector((s) => s.grimoire.meta.lastSeenDay)
  useEffect(() => {
    if (!ready) return
    // A new day opened: how long she was away, for the welcome back in the scroll.
    if (lastSeen !== today) dispatch(A.updateMeta({ lastSeenDay: today, awayDays: lastSeen ? Math.max(0, daysBetween(lastSeen, today)) : 0 }))
    // The agent's server counts days in this zone.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && tz !== timeZone) dispatch(A.updateMeta({ timeZone: tz }))
    if (generatedFor !== today && !navActive) dispatch(A.generateHabitTasks())
    if (!seeded) dispatch(A.seedPractices(builtInPractices))
  }, [ready, today, generatedFor, seeded, navActive, timeZone, lastSeen, dispatch])
}

export default function GrimoireLayout() {
  const witch = useIsWitch()
  const master = useIsMaster()
  const meta = useAppSelector((s) => s.grimoire.meta)
  const loc = useLocation()
  useDailyChores()
  const sections = useSections()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])

  // Without the role the grimoire doesn't exist: its addresses lead to the workshop, if that is open.
  if (!witch) return master ? <GoApp app="workshop" /> : <NoAccess />

  const mainTabs = sections.filter((x) => x.main)
  const current = sectionOf(sections, loc.pathname)
  // The «Меню» tab is lit when the open page is not one of the main tabs.
  const menuLit = !current?.main

  return (
    <Flex minH="100dvh">
      <Box as="nav" display={{ base: 'none', md: 'block' }} w="240px" flexShrink={0} borderRightWidth="1px" borderColor="border" bg="bg.nav" position="sticky" top="0" h="100dvh" overflowY="auto" className="quiet-scroll" p="4">
        <Flex mb="3" px="1">
          <AppMark size={38} />
        </Flex>
        <MoonPhases size={12} gap="2.5" color="ember.200" px="2" mb="4" />
        <SectionList sections={sections} />
        <Eucalyptus width={120} mx="auto" mt="10" opacity={0.45} />
      </Box>

      <Box flex="1" minW="0" position="relative" overflowX="clip">
        <Box position="relative" zIndex="1" px={{ base: '4', md: '8' }} pt={{ base: 'calc(16px + env(safe-area-inset-top))', md: '8' }} pb={{ base: '28', md: '24' }}>
          <Flex as="header" justify="space-between" align="center" mb={{ base: '3', md: '5' }} gap="3">
            <Flex display={{ base: 'flex', md: 'none' }}>
              <AppMark size={26} compact />
            </Flex>
            <Box display={{ base: 'none', md: 'block' }} />
            <HeaderRight />
          </Flex>
          {meta.nav.active && loc.pathname !== '/' && (
            <Box mb="3" px="3" py="2" borderRadius="l2" bg="bg.muted" fontSize="xs" color="fg.muted">
              Ты в нави: серии заморожены, привычки молчат.
            </Box>
          )}
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>

      <AddMenu />
      <FeedbackPrompt />

      <Flex as="nav" display={{ base: 'flex', md: 'none' }} position="fixed" bottom="0" left="0" right="0" bg="bg.nav" backdropFilter="blur(8px)" borderTopWidth="1px" borderColor="border" pb="env(safe-area-inset-bottom)" zIndex="sticky">
        {mainTabs.map((i) => (
          <NavLink key={i.to} to={i.to} style={{ flex: 1 }}>
            <Tab icon={i.icon} label={i.label} lit={i === current} />
          </NavLink>
        ))}
        <Box as="button" flex="1" cursor="pointer" aria-label="Меню" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
          <Tab icon="circle-dots-horizontal" label="Меню" lit={menuLit} />
        </Box>
      </Flex>
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)}>
        <SectionList sections={sections.filter((x) => !x.main)} onPick={() => setMenuOpen(false)} />
      </Sheet>
    </Flex>
  )
}

/** A bottom tab: the lit one sits on a soft pill, like the side menu's current line. */
function Tab({ icon, label, lit }: { icon: IconName; label: string; lit: boolean }) {
  return (
    <Stack align="center" gap="0.5" py="1.5" color={lit ? 'ember.200' : 'fg.subtle'} fontSize="2xs" fontWeight={lit ? 'semibold' : 'medium'}>
      <Flex px="4" py="1" borderRadius="full" bg={lit ? 'ember.subtle' : 'transparent'} transition="background .15s">
        <Icon name={icon} size={22} />
      </Flex>
      {label}
    </Stack>
  )
}

