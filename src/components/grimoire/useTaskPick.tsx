// «Выбрать»: marks several deeds in a list to delete them or send them to the backlog at once.
// Shift+click marks the whole run from the last marked card; Esc leaves the mode.
import { Button, HStack, Text } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { LuListChecks } from 'react-icons/lu'
import { removeMany, withUndo } from '../../grimoire/act'
import type { Task } from '../../grimoire/types'
import { useAppDispatch } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { confirmAction } from '../ui'

export function useTaskPick(list: Task[]) {
  const dispatch = useAppDispatch()
  const [on, setOn] = useState(false)
  const [ids, setIds] = useState<string[]>([])
  const [last, setLast] = useState<string>()

  const stop = () => {
    setOn(false)
    setIds([])
    setLast(undefined)
  }
  useEffect(() => {
    if (!on) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && stop()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [on])

  const toggle = (t: Task, range: boolean) => {
    const order = list.map((x) => x.id)
    if (range && last && order.includes(last)) {
      const [a, b] = [order.indexOf(last), order.indexOf(t.id)].sort((x, y) => x - y)
      setIds([...new Set([...ids, ...order.slice(a, b + 1)])])
    } else setIds(ids.includes(t.id) ? ids.filter((x) => x !== t.id) : [...ids, t.id])
    setLast(t.id)
  }

  /** For a TaskCard: undefined outside the mode. */
  const pick = (t: Task) => (on ? { on: ids.includes(t.id), toggle } : undefined)

  const button = (
    <Button size="sm" variant={on ? 'solid' : 'outline'} onClick={() => (on ? stop() : setOn(true))}>
      <LuListChecks /> {on ? 'Готово' : 'Выбрать'}
    </Button>
  )

  const bar = on ? (
    <HStack
      position="sticky"
      bottom={{ base: 'calc(84px + env(safe-area-inset-bottom))', md: '4' }}
      zIndex="docked"
      mt="4"
      p="2.5"
      gap="2"
      wrap="wrap"
      borderRadius="l3"
      borderWidth="1px"
      borderColor="border.emphasized"
      bg="bg.panel"
      boxShadow="lg"
    >
      <Text fontSize="sm" flex="1" minW="120px" color="fg.muted">
        {ids.length ? `Выбрано: ${ids.length}` : 'Отметь дела · Shift — сразу несколько'}
      </Text>
      <Button size="sm" variant="ghost" onClick={() => setIds(ids.length === list.length ? [] : list.map((t) => t.id))}>
        {ids.length === list.length && list.length ? 'Снять все' : 'Все'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!ids.length}
        onClick={() => {
          withUndo(`В бэклоге: ${ids.length}`, () => dispatch(A.toBacklog(ids)))
          stop()
        }}
      >
        В бэклог
      </Button>
      <Button
        size="sm"
        colorPalette="red"
        disabled={!ids.length}
        onClick={async () => {
          if (!(await confirmAction(`Удалить дел: ${ids.length}?`))) return
          removeMany(ids)
          stop()
        }}
      >
        Удалить ({ids.length})
      </Button>
      <Button size="sm" variant="ghost" onClick={stop}>
        Отменить
      </Button>
    </HStack>
  ) : null

  return { on, pick, button, bar }
}
