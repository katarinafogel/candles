// The header's right side: sync state and the person signed in — a chosen sign, her name,
// and a menu with the profile, settings, the other app and «Выйти».
import { Box, Button, Flex, Menu, Portal, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuArrowLeftRight, LuChevronDown, LuLayoutGrid, LuLogOut, LuSettings, LuUserPen } from 'react-icons/lu'
import { APP, appHref, useGo, type AppId } from '../lib/apps'
import { signOut } from '../lib/sync'
import { supabase } from '@shared/lib/supabase'
import { useAppDispatch, useAppSelector, useIsMaster, useIsWitch } from '../store'
import { actions } from '@workshop-core/store/dataSlice'
import { localActions } from '../store/localSlice'
import { SyncBadge } from './SyncBadge'
import { Field, Modal, notify, TextInput } from '@shared/components/ui'

export const avatarSigns = ['🌙', '🕯️', '🔮', '🐈‍⬛', '🦉', '🐸', '🦇', '🐍', '🍄', '🌿', '🌸', '🍂', '⭐', '🧿', '🪄', '🌕', '🔥', '💀', '🪶', '🫖']

/** The chosen sign in a round frame; until one is chosen, the first letter of the name. */
export function Avatar({ size = 8 }: { size?: number }) {
  const sign = useAppSelector((s) => s.data.settings.avatar)
  const name = useAppSelector((s) => s.local.profile?.name ?? '')
  return (
    <Flex
      w={size}
      h={size}
      flexShrink={0}
      align="center"
      justify="center"
      borderRadius="full"
      bg="ember.subtle"
      borderWidth="1px"
      borderColor="ember.muted"
      color="ember.200"
      fontFamily="heading"
      fontWeight="semibold"
      fontSize={sign ? `${size * 2.2}px` : `${size * 1.8}px`}
      lineHeight="1"
    >
      {sign || name.trim().charAt(0).toUpperCase() || '✦'}
    </Flex>
  )
}

function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const profile = useAppSelector((s) => s.local.profile)
  const sign = useAppSelector((s) => s.data.settings.avatar)
  const [name, setName] = useState(profile?.name ?? '')
  const [busy, setBusy] = useState(false)

  const saveName = async () => {
    const n = name.trim()
    if (!n || !profile || n === profile.name) return onClose()
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ name: n }).eq('slug', profile.slug)
    setBusy(false)
    if (error) return notify('Не удалось сохранить имя', 'error', error.message)
    dispatch(localActions.setProfile({ ...profile, name: n }))
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Профиль"
      size="sm"
      footer={
        <Button onClick={() => void saveName()} loading={busy} disabled={!name.trim()}>
          Готово
        </Button>
      }
    >
      <Stack gap="5">
        <Flex justify="center">
          <Avatar size={16} />
        </Flex>
        <Field label="Имя" helper="его видят и получатели свечей">
          <TextInput value={name} onChange={setName} />
        </Field>
        <Field label="Значок">
          <SimpleGrid columns={5} gap="2">
            {avatarSigns.map((a) => (
              <Box
                as="button"
                key={a}
                aria-pressed={a === sign}
                onClick={() => dispatch(actions.updateSettings({ avatar: a }))}
                fontSize="2xl"
                py="1.5"
                borderRadius="l2"
                borderWidth="2px"
                borderColor={a === sign ? 'ember.400' : 'transparent'}
                bg={a === sign ? 'ember.subtle' : 'bg.muted'}
                _hover={{ bg: 'ember.subtle' }}
                cursor="pointer"
              >
                {a}
              </Box>
            ))}
          </SimpleGrid>
          {sign && (
            <Button variant="ghost" size="xs" mt="2" onClick={() => dispatch(actions.updateSettings({ avatar: '' }))}>
              Без значка, просто буква
            </Button>
          )}
        </Field>
      </Stack>
    </Modal>
  )
}

export function UserMenu() {
  const go = useGo()
  const witch = useIsWitch()
  const master = useIsMaster()
  const name = useAppSelector((s) => s.local.profile?.name ?? '')
  const email = useAppSelector((s) => s.local.email)
  const [profileOpen, setProfileOpen] = useState(false)
  const inGrimoire = APP === 'grimoire'

  const pick = (v: string) => {
    if (v === 'profile') setProfileOpen(true)
    else if (v === 'signout') void signOut()
    else if (v === 'projects') location.assign(appHref('showcase', '/projects'))
    else {
      // 'grimoire:/more', 'workshop:/settings' — a page of either app.
      const [app, path] = v.split(':') as [AppId, string]
      go(app, path)
    }
  }

  return (
    <>
      <Menu.Root onSelect={(e) => pick(e.value)} positioning={{ placement: 'bottom-end' }}>
        <Menu.Trigger asChild>
          <Flex as="button" align="center" gap="2" pl="1" pr={{ base: '1', md: '2' }} py="1" borderRadius="full" cursor="pointer" _hover={{ bg: 'bg.muted' }} aria-label="Меню профиля">
            <Avatar />
            <Text display={{ base: 'none', md: 'block' }} fontWeight="medium" maxW="180px" truncate>
              {name}
            </Text>
            <Box display={{ base: 'none', md: 'block' }} color="fg.subtle" fontSize="sm">
              <LuChevronDown />
            </Box>
          </Flex>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content minW="240px" bg="bg.panel" borderWidth="1px" borderColor="border">
              <Flex align="center" gap="3" px="2" py="2">
                <Avatar size={10} />
                <Box minW="0">
                  <Text fontWeight="semibold" truncate>
                    {name}
                  </Text>
                  {email && (
                    <Text fontSize="xs" color="fg.subtle" truncate>
                      {email}
                    </Text>
                  )}
                </Box>
              </Flex>
              <Menu.Separator />
              <Menu.Item value="profile">
                <LuUserPen /> Имя и значок
              </Menu.Item>
              {inGrimoire ? (
                <Menu.Item value="grimoire:/more">
                  <LuSettings /> Настройки гримуара
                </Menu.Item>
              ) : (
                <Menu.Item value="workshop:/settings">
                  <LuSettings /> Настройки мастерской
                </Menu.Item>
              )}
              {witch && master && (
                <Menu.Item value={inGrimoire ? 'workshop:/' : 'grimoire:/'}>
                  <LuArrowLeftRight /> {inGrimoire ? 'В мастерскую' : 'В гримуар'}
                </Menu.Item>
              )}
              <Menu.Item value="projects">
                <LuLayoutGrid /> Другие проекты
              </Menu.Item>
              <Menu.Separator />
              <Menu.Item value="signout" color="fg.muted">
                <LuLogOut /> Выйти
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
      {profileOpen && <ProfileDialog open onClose={() => setProfileOpen(false)} />}
    </>
  )
}

/** Right side of the header in both apps. */
export function HeaderRight() {
  return (
    <Flex align="center" gap="3">
      <SyncBadge />
      <UserMenu />
    </Flex>
  )
}
