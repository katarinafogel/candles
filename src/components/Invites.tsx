// Invites: an admin makes a one-time link (alive 7 days) that gives the grimoire to whoever opens it
// and signs in. The token is caught from /invite/<token> before the sign-in (it may go through Google
// and come back to the start page), kept on the device, and taken once the session is known.
import { Box, Button, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { LuCopy } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { publicBase } from '../lib/config'
import { supabase } from '@shared/lib/supabase'
import { load } from '../lib/sync'
import { useAppSelector } from '../store'
import { notify } from '@shared/components/ui'

const KEY = 'pendingInvite'

/** Called once at start: remembers a token from the address and takes the page back to the start. */
export function catchInvite() {
  const m = window.location.pathname.match(/\/invite\/([a-f0-9]{16,64})\/?$/i) ?? window.location.hash.match(/#\/invite\/([a-f0-9]{16,64})/i)
  if (!m) return
  try {
    localStorage.setItem(KEY, m[1])
  } catch {
    // private mode: the token can't wait for the sign-in; the page below still tries right away
  }
}

const why: Record<string, string> = {
  unknown: 'Такого приглашения нет — проверь ссылку.',
  used: 'Это приглашение уже использовано. Попроси новое.',
  expired: 'Ссылка устарела — попроси новую.',
  revoked: 'Приглашение отозвано.',
}

/** Inside the sign-in: takes a waiting invite for the signed-in person, then opens the grimoire. */
export function InviteTaker() {
  const owner = useAppSelector((s) => s.local.ownerId)
  const navigate = useNavigate()
  useEffect(() => {
    if (!owner) return
    let token: string | null = null
    try {
      token = localStorage.getItem(KEY)
    } catch {
      return
    }
    if (!token) return
    void (async () => {
      const { data, error } = await supabase.rpc('redeem_invite', { p_token: token })
      try {
        localStorage.removeItem(KEY)
      } catch {
        // nothing to clean
      }
      if (error) return notify('Не получилось принять приглашение', 'error', error.message)
      if (data !== 'ok') return notify('Приглашение не сработало', 'warning', why[data as string] ?? String(data))
      await load()
      notify('Добро пожаловать в гримуар', 'success')
      navigate('/g', { replace: true })
    })()
  }, [owner, navigate])
  return null
}

interface Invite {
  token: string
  created_at: string
  expires_at: string
  used_at: string | null
  revoked_at: string | null
}

export const inviteLink = (token: string) => `${publicBase()}#/invite/${token}`

/** For an admin, under the roles: make a link, see the ones made, revoke the waiting ones. */
export function InvitesAdmin() {
  const [list, setList] = useState<Invite[]>()
  const [fresh, setFresh] = useState<string>()
  async function refresh() {
    const { data, error } = await supabase.from('invites').select('token, created_at, expires_at, used_at, revoked_at').order('created_at', { ascending: false }).limit(20)
    if (!error) setList(data as Invite[])
  }
  useEffect(() => {
    void refresh()
  }, [])
  async function create() {
    const { data, error } = await supabase.rpc('create_invite', { p_role: 'witch' })
    if (error) return notify('Не получилось', 'error', error.message)
    setFresh(data as string)
    void refresh()
  }
  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(token))
      notify('Ссылка скопирована', 'success')
    } catch {
      notify('Скопируй ссылку вручную', 'info', inviteLink(token))
    }
  }
  async function revoke(token: string) {
    const { error } = await supabase.from('invites').update({ revoked_at: new Date().toISOString() }).eq('token', token)
    if (error) return notify('Не получилось', 'error', error.message)
    void refresh()
  }
  const state = (i: Invite) => (i.revoked_at ? 'отозвано' : i.used_at ? 'использовано' : new Date(i.expires_at) < new Date() ? 'истекло' : 'ждёт')
  return (
    <Stack gap="3" mt="4">
      <Text fontSize="sm" color="fg.muted">
        Ссылка-приглашение даёт гримуар тому, кто по ней зарегистрируется или войдёт. Одноразовая, живёт 7 дней.
      </Text>
      <Button size="sm" alignSelf="flex-start" onClick={() => void create()}>
        Пригласить
      </Button>
      {fresh && (
        <HStack gap="2" p="2" borderRadius="l2" borderWidth="1px" borderColor="ember.600" wrap="wrap">
          <Text fontSize="xs" flex="1" minW="200px" wordBreak="break-all">
            {inviteLink(fresh)}
          </Text>
          <Button size="xs" onClick={() => void copy(fresh)}>
            <LuCopy /> Скопировать
          </Button>
        </HStack>
      )}
      {list && list.length > 0 && (
        <Stack gap="0">
          {list.map((i) => (
            <Flex key={i.token} align="center" gap="3" py="1.5" borderBottomWidth="1px" borderColor="border.muted" fontSize="sm" wrap="wrap">
              <Box flex="1" minW="160px">
                <Text>{new Date(i.created_at).toLocaleDateString('ru')}</Text>
                <Text fontSize="xs" color="fg.subtle">
                  {state(i)}
                </Text>
              </Box>
              {state(i) === 'ждёт' && (
                <>
                  <Button size="2xs" variant="ghost" onClick={() => void copy(i.token)}>
                    Ссылка
                  </Button>
                  <Button size="2xs" variant="ghost" colorPalette="red" onClick={() => void revoke(i.token)}>
                    Отозвать
                  </Button>
                </>
              )}
            </Flex>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
