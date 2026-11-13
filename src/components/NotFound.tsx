// An address that leads nowhere: say so instead of quietly showing the start page, so a broken
// link or a mistyped address is noticed.
import { Button, Center, Heading, Stack, Text } from '@chakra-ui/react'
import { Link as RouterLink, Navigate, useLocation } from 'react-router-dom'
import { MoonPhases } from '@shared/components/Magic'

export function NotFound({ home, homeLabel }: { home: string; homeLabel: string }) {
  const { pathname } = useLocation()
  return (
    <Center minH="60dvh" px="6">
      <Stack gap="4" maxW="420px" textAlign="center" align="center">
        <MoonPhases size={12} gap="2.5" color="ember.200" />
        <Heading size="xl">Такой страницы нет</Heading>
        <Text color="fg.muted" wordBreak="break-all">
          По адресу <code>{pathname}</code> ничего не нашлось. Возможно, ссылка устарела или в ней опечатка.
        </Text>
        <Button asChild variant="outline">
          <RouterLink to={home}>{homeLabel}</RouterLink>
        </Button>
      </Stack>
    </Center>
  )
}

/** An old address that moved: goes to the new one, keeping the query (?ids=…); `keepTail` carries the last
 * part of the address over (/stock/42 → /materials/42). */
export function Moved({ to, keepTail }: { to: string; keepTail?: boolean }) {
  const { pathname, search } = useLocation()
  const tail = keepTail ? `/${pathname.split('/').pop()}` : ''
  return <Navigate to={to + tail + search} replace />
}
