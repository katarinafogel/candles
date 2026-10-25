import { HStack, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { LuCloud, LuCloudOff, LuRefreshCw, LuTriangleAlert } from 'react-icons/lu'
import { flush } from '../lib/sync'
import { useAppSelector } from '../store'

/** Shows whether the device copy has reached the server. */
export function SyncBadge() {
  const sync = useAppSelector((s) => s.local.sync)
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const pending = sync?.pending ?? 0
  const [icon, text, color] = !online
    ? [<LuCloudOff key="i" />, pending ? `офлайн · не отправлено: ${pending}` : 'офлайн', 'orange.300']
    : sync?.syncing
      ? [<LuRefreshCw key="i" />, 'сохраняю…', 'fg.muted']
      : sync?.error
        ? [<LuTriangleAlert key="i" />, `ошибка сохранения${pending ? ` · ${pending}` : ''}`, 'red.400']
        : pending
          ? [<LuRefreshCw key="i" />, `не отправлено: ${pending}`, 'orange.300']
          : [<LuCloud key="i" />, 'сохранено', 'fg.subtle']

  return (
    <HStack
      gap="1.5"
      color={color}
      fontSize="xs"
      cursor={pending ? 'pointer' : undefined}
      title={sync?.error}
      onClick={() => pending && void flush()}
    >
      {icon}
      <Text>{text}</Text>
    </HStack>
  )
}
