import { HStack, IconButton, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { LuCloud, LuCloudOff, LuRefreshCw, LuTriangleAlert } from 'react-icons/lu'
import { flush, load } from '../lib/sync'
import { useAppSelector } from '../store'
import { notify } from '@shared/components/ui'

/**
 * Shows whether the device copy has reached the server, with a button that syncs right now: sends
 * what is waiting, then takes the server's copy (edits made on another device). load() never lets
 * the server copy overwrite changes that could not be sent.
 */
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
          : [<LuCloud key="i" />, sync?.loadedAt ? `синхронизировано в ${new Date(sync.loadedAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}` : 'сохранено', 'fg.subtle']

  const [busy, setBusy] = useState(false)
  const syncNow = async () => {
    if (busy || !online) return
    setBusy(true)
    try {
      await load()
    } finally {
      setBusy(false)
    }
  }
  // load() reports its trouble into the sync state: a press that ends with an error says it aloud.
  const [pressed, setPressed] = useState(false)
  useEffect(() => {
    if (pressed && !busy) {
      setPressed(false)
      if (sync?.error) notify('Не получилось синхронизировать', 'error', sync.error)
    }
  }, [pressed, busy, sync?.error])

  return (
    <HStack gap="1">
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
      <IconButton
        aria-label="Синхронизировать"
        title={online ? 'Синхронизировать' : 'нет сети'}
        size="xs"
        variant="ghost"
        color="fg.muted"
        disabled={!online || busy || !!sync?.syncing}
        onClick={() => {
          setPressed(true)
          void syncNow()
        }}
      >
        <LuRefreshCw style={busy || sync?.syncing ? { animation: 'spin 1s linear infinite' } : undefined} />
      </IconButton>
    </HStack>
  )
}
