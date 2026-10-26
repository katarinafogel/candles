// «Доступ для агента»: personal keys for the assistant's MCP connector. The key is made on this
// device and shown once; the database keeps only its sha-256 hash.
import { Box, Button, Code, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { confirmAction, notify, TextInput } from '../ui'

interface KeyRow {
  id: string
  label: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const newKey = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return 'gk_' + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const connectorUrl = (key: string) => `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/grimoire-mcp/${key}`
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'ещё не было')

export function AgentKeys() {
  const [keys, setKeys] = useState<KeyRow[]>()
  const [missing, setMissing] = useState(false)
  const [label, setLabel] = useState('')
  const [fresh, setFresh] = useState<string>()
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const { data, error } = await supabase.from('agent_keys').select('id,label,created_at,last_used_at,revoked_at').order('created_at', { ascending: false })
    if (error) {
      // The database has no migration 0003 yet.
      if (error.code === '42P01' || error.code === 'PGRST205') setMissing(true)
      else notify('Не получилось загрузить ключи', 'error', error.message)
      return
    }
    setKeys(data as KeyRow[])
  }
  useEffect(() => {
    void refresh()
  }, [])

  async function issue() {
    setBusy(true)
    const key = newKey()
    const hash = toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))
    const { error } = await supabase.rpc('create_agent_key', { p_label: label.trim() || 'агент', p_hash: hash })
    setBusy(false)
    if (error) return notify('Ключ не выпущен', 'error', error.message === 'too many keys' ? 'Активных ключей уже 10: отзови ненужные' : error.message)
    setFresh(key)
    setLabel('')
    void refresh()
  }

  async function revoke(k: KeyRow) {
    if (!confirmAction(`Отозвать ключ «${k.label}»? Агент с ним сразу потеряет доступ.`)) return
    const { error } = await supabase.rpc('revoke_agent_key', { p_id: k.id })
    if (error) return notify('Не получилось', 'error', error.message)
    void refresh()
  }

  if (missing)
    return (
      <Text fontSize="sm" color="fg.muted">
        Сначала нужно применить миграцию <Code>0003_agent.sql</Code> в базе.
      </Text>
    )

  return (
    <Stack gap="4">
      <Text fontSize="sm" color="fg.muted">
        Ассистент подключается к гримуару как коннектор и работает по тем же правилам, что и приложение: монеты, серии, переносы. Мастерская ему не видна. Ключ показывается один раз; отозванный перестаёт работать сразу.
      </Text>
      {fresh && (
        <Box p="3" borderRadius="l2" borderWidth="1px" borderColor="ember.600" bg="ember.subtle">
          <Text fontSize="sm" mb="2">
            Адрес коннектора — добавь его в claude.ai как свой коннектор. Больше он не покажется:
          </Text>
          <Code display="block" whiteSpace="pre-wrap" wordBreak="break-all" p="2" fontSize="xs">
            {connectorUrl(fresh)}
          </Code>
          <HStack mt="2" gap="2">
            <Button
              size="xs"
              onClick={async () => {
                await navigator.clipboard?.writeText(connectorUrl(fresh))
                notify('Скопировано')
              }}
            >
              Скопировать
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setFresh(undefined)}>
              Готово, сохранила
            </Button>
          </HStack>
        </Box>
      )}
      <HStack gap="2" align="flex-end">
        <Box flex="1">
          <TextInput value={label} onChange={setLabel} placeholder="для чего ключ: утренние сводки" />
        </Box>
        <Button onClick={issue} loading={busy}>
          Выпустить ключ
        </Button>
      </HStack>
      {keys && keys.length > 0 && (
        <Stack gap="0">
          {keys.map((k) => (
            <Flex key={k.id} align="center" gap="3" py="2" borderBottomWidth="1px" borderColor="border.muted" opacity={k.revoked_at ? 0.5 : 1} wrap="wrap">
              <Box flex="1" minW="160px">
                <Text fontSize="sm">{k.label || 'агент'}</Text>
                <Text fontSize="xs" color="fg.subtle">
                  {k.revoked_at ? `отозван ${when(k.revoked_at)}` : `последний раз: ${when(k.last_used_at)}`}
                </Text>
              </Box>
              {!k.revoked_at && (
                <Button size="xs" variant="ghost" colorPalette="red" onClick={() => void revoke(k)}>
                  Отозвать
                </Button>
              )}
            </Flex>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
