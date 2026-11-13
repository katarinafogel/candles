// Signed in, but neither app is open to this person yet: both come by invite for now.
import { Button, Center, Heading, Spinner, Stack, Text } from '@chakra-ui/react'
import { MoonPhases } from '@shared/components/Magic'
import { useAppSelector } from '../store'
import { signOut } from '../lib/sync'

export function NoAccess() {
  // Roles not fetched yet on this device: wait instead of saying no.
  const known = useAppSelector((s) => s.local.roles !== undefined)
  const syncing = useAppSelector((s) => !!s.local.sync?.syncing)
  if (!known || syncing) {
    return (
      <Center minH="100dvh">
        <Spinner color="ember.300" />
      </Center>
    )
  }
  return (
    <Center minH="100dvh" px="6">
      <Stack gap="5" maxW="420px" textAlign="center" align="center">
        <MoonPhases size={12} gap="2.5" color="ember.200" />
        <Heading size="xl">Сюда пока по приглашению</Heading>
        <Text color="fg.muted">
          Мастерская и гримуар сейчас открываются только по ссылке-приглашению. Если тебе прислали ссылку, открой её ещё раз — после входа она сработает сама.
        </Text>
        <Button variant="outline" onClick={() => void signOut()}>
          Выйти
        </Button>
      </Stack>
    </Center>
  )
}
