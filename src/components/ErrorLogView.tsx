// «Последние ошибки» in both apps' settings: what went wrong on this device, newest first, to read
// at leisure or copy for a fix.
import { Box, Button, HStack, Stack, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { LuCopy } from 'react-icons/lu'
import { notify } from '@shared/components/ui'
import { clearErrorLog, errorLog, onErrorLog } from '@shared/lib/errorLog'

export function ErrorLogView() {
  const [list, setList] = useState(errorLog)
  useEffect(() => onErrorLog(() => setList(errorLog())), [])
  if (!list.length) return <Text fontSize="sm" color="fg.muted">Ошибок не было.</Text>
  const text = list.map((e) => [`${new Date(e.at).toLocaleString('ru-RU')} · ${e.path}`, e.title, e.message, e.stack].filter(Boolean).join('\n')).join('\n\n')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      notify('Скопировано', 'success')
    } catch {
      notify('Не получилось скопировать', 'warning')
    }
  }
  return (
    <Stack gap="3">
      <HStack gap="2">
        <Button size="xs" onClick={() => void copy()}>
          <LuCopy /> Скопировать всё
        </Button>
        <Button size="xs" variant="ghost" onClick={clearErrorLog}>
          Очистить
        </Button>
      </HStack>
      <Stack gap="2">
        {list.slice(0, 10).map((e) => (
          <Box key={e.at + e.title} fontSize="sm" borderBottomWidth="1px" borderColor="border.muted" pb="2">
            <Text fontSize="xs" color="fg.subtle">
              {new Date(e.at).toLocaleString('ru-RU')} · {e.path}
            </Text>
            <Text>{e.title}</Text>
            {e.message && (
              <Text fontSize="xs" color="fg.muted" wordBreak="break-word">
                {e.message}
              </Text>
            )}
          </Box>
        ))}
      </Stack>
    </Stack>
  )
}
