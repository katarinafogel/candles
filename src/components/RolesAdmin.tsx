// For an admin: the masters (name and address) with role switches. Roles are handed out by the
// database functions grant_role / revoke_role, which check the admin role themselves.
import { Box, Button, Flex, Stack, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { load } from '../lib/sync'
import { useAppSelector } from '../store'
import { Check, notify } from './ui'

interface Master {
  user_id: string
  slug: string
  name: string
  roles: string[]
}

const roleLabel: Record<string, string> = { witch: 'гримуар', admin: 'раздаёт роли' }

export function RolesAdmin() {
  const me = useAppSelector((s) => s.local.ownerId)
  const [masters, setMasters] = useState<Master[]>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState<string>()

  async function refresh() {
    const { data, error } = await supabase.rpc('admin_masters')
    if (error) setError(error.message)
    else setMasters(data as Master[])
  }
  useEffect(() => {
    void refresh()
  }, [])

  async function toggle(m: Master, role: string, on: boolean) {
    setBusy(`${m.user_id}:${role}`)
    const { error } = await supabase.rpc(on ? 'grant_role' : 'revoke_role', { p_user: m.user_id, p_role: role })
    setBusy(undefined)
    if (error) return notify('Не получилось', 'error', error.message === 'last admin' ? 'Нельзя снять с себя роль последнего админа' : error.message)
    await refresh()
    // My own roles changed: reload so the grimoire appears or disappears right away.
    if (m.user_id === me) void load()
  }

  if (error)
    return (
      <Text fontSize="sm" color="fg.muted">
        Список мастеров недоступен: {error}
      </Text>
    )
  if (!masters) return null
  return (
    <Stack gap="0">
      {masters.map((m) => (
        <Flex key={m.user_id} align="center" gap="4" py="2" borderBottomWidth="1px" borderColor="border.muted" wrap="wrap">
          <Box flex="1" minW="160px">
            <Text fontSize="sm">{m.name || 'без имени'}</Text>
            <Text fontSize="xs" color="fg.subtle">
              {m.slug}
              {m.user_id === me ? ' · это ты' : ''}
            </Text>
          </Box>
          {(['witch', 'admin'] as const).map((role) => (
            <Box key={role} opacity={busy === `${m.user_id}:${role}` ? 0.5 : 1}>
              <Check checked={m.roles.includes(role)} onChange={(v) => void toggle(m, role, v)}>
                {roleLabel[role]}
              </Check>
            </Box>
          ))}
        </Flex>
      ))}
      <Button size="xs" variant="ghost" alignSelf="flex-start" mt="2" onClick={() => void refresh()}>
        Обновить
      </Button>
    </Stack>
  )
}
