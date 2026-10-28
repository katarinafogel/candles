// «Уведомления»: turned on per device (each phone or computer subscribes itself), what to send is one
// setting for all of them. The server looks every quarter of an hour; in the навь it stays silent.
import { Button, Flex, HStack, Input, Stack, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { currentSubscription, disablePush, enablePush, pushSupported, testPush } from '../../lib/push'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { Check, Field, notify } from '../ui'

function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Input size="sm" type="time" w="120px" value={value} onChange={(e) => onChange(e.target.value)} style={{ colorScheme: 'dark' }} />
}

export function PushSettings() {
  const dispatch = useAppDispatch()
  const meta = useAppSelector((s) => s.grimoire.meta)
  const n = meta.notify
  const set = (p: Partial<typeof n>) => dispatch(A.updateMeta({ notify: { ...n, ...p } }))
  const [on, setOn] = useState<boolean>()
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    currentSubscription().then((s) => setOn(!!s), () => setOn(false))
  }, [])
  const toggle = async () => {
    setBusy(true)
    if (on) {
      await disablePush()
      setOn(false)
    } else {
      const r = await enablePush()
      if (r.ok) {
        setOn(true)
        notify('Уведомления на этом устройстве включены', 'success')
      } else notify(r.reason, 'warning')
    }
    setBusy(false)
  }
  return (
    <Stack gap="4">
      <Flex gap="2" align="center" wrap="wrap">
        <Text fontSize="sm" flex="1" minW="200px" color="fg.muted">
          {!pushSupported()
            ? 'Здесь уведомления недоступны. На iPhone — только в гримуаре, добавленном на экран «Домой».'
            : on
              ? 'На этом устройстве уведомления включены.'
              : 'На этом устройстве уведомления выключены.'}
        </Text>
        {pushSupported() && (
          <Button size="sm" variant={on ? 'outline' : 'solid'} loading={busy || on === undefined} onClick={toggle}>
            {on ? 'Выключить здесь' : 'Включить здесь'}
          </Button>
        )}
        {on && (
          <Button size="sm" variant="ghost" onClick={async () => notify((await testPush()) ? 'Пробное отправлено' : 'Сервер уведомлений не ответил', 'info')}>
            Прислать пробное
          </Button>
        )}
      </Flex>
      <Field label="Утром: план на день" helper="сколько дел и главное, сроки сегодня, саббат завтра; пусто — не присылать">
        <TimeField value={n.morning} onChange={(morning) => set({ morning })} />
      </Field>
      <Field label="Днём: как идёт день" helper="сколько сделано и что можно уменьшить; пусто — не присылать">
        <TimeField value={n.afternoon} onChange={(afternoon) => set({ afternoon })} />
      </Field>
      <HStack gap="4" wrap="wrap">
        <Check checked={n.evening} onChange={(evening) => set({ evening })}>
          Вечером: вечерняя страница и ритуалы ({meta.eveningAt || 'время не задано'})
        </Check>
      </HStack>
      <HStack gap="4" wrap="wrap">
        <Check checked={n.deadlines} onChange={(deadlines) => set({ deadlines })}>
          Сроки в утреннем
        </Check>
        <Check checked={n.sabbats} onChange={(sabbats) => set({ sabbats })}>
          Саббаты в утреннем
        </Check>
      </HStack>
      <Text fontSize="xs" color="fg.subtle">
        Приходят на все устройства, где включены. В нави гримуар молчит.
      </Text>
    </Stack>
  )
}
