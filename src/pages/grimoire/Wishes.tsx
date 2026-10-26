// «Сундук желаний» and «Зал славы»: dreams without deadlines; one button makes a dream a deed, and a
// fulfilled one moves to the hall of fame with the time it took «от мечты до яви».
import { Box, Button, Flex, HStack, SimpleGrid, Stack, Tabs, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuPlus } from 'react-icons/lu'
import { Crescent, Sparkle } from '../../components/Magic'
import { confirmAction, Empty, Field, Modal, notify, NumInput, PageHeader, TextArea, TextInput } from '../../components/ui'
import { daysBetween, plural } from '../../grimoire/days'
import type { Wish } from '../../grimoire/types'
import { sabbats } from '../../grimoire/wheel'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'

/** «1 год 2 месяца 5 дней». */
export function span(fromIso: string, toIso: string) {
  const a = new Date(fromIso)
  const b = new Date(toIso)
  let y = b.getFullYear() - a.getFullYear()
  let m = b.getMonth() - a.getMonth()
  let d = b.getDate() - a.getDate()
  if (d < 0) {
    m--
    d += new Date(b.getFullYear(), b.getMonth(), 0).getDate()
  }
  if (m < 0) {
    y--
    m += 12
  }
  const parts = [y && plural(y, 'год', 'года', 'лет'), m && plural(m, 'месяц', 'месяца', 'месяцев'), d && plural(d, 'день', 'дня', 'дней')].filter(Boolean)
  return parts.length ? parts.join(' ') : 'в тот же день'
}

type Draft = Partial<Wish> & { title: string }

function WishDialog({ wish, onClose }: { wish: Draft; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [w, setW] = useState<Draft>(wish)
  return (
    <Modal
      open
      onClose={onClose}
      title={w.id ? w.title : 'Новая хотелка'}
      footer={
        <>
          {w.id && (
            <Button
              variant="ghost"
              colorPalette="red"
              mr="auto"
              onClick={() => {
                if (confirmAction('Удалить хотелку насовсем? Можно вместо этого отпустить.')) {
                  dispatch(A.deleteWish(w.id!))
                  onClose()
                }
              }}
            >
              Удалить
            </Button>
          )}
          <Button
            disabled={!w.title.trim()}
            onClick={() => {
              dispatch(A.upsertWish({ wish: { tags: [], ...w, title: w.title.trim() } }))
              onClose()
            }}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <Stack gap="4">
        <Field label="Мечта">
          <TextInput value={w.title} onChange={(v) => setW({ ...w, title: v })} placeholder="съездить на Байкал" />
        </Field>
        <Field label="Описание">
          <TextArea value={w.description ?? ''} onChange={(v) => setW({ ...w, description: v || undefined })} />
        </Field>
        <Field label="Примерная стоимость" helper="необязательно">
          <NumInput value={w.price} onChange={(v) => setW({ ...w, price: v })} suffix="₽" />
        </Field>
        <Field label="Теги" helper="через запятую">
          <TextInput value={(w.tags ?? []).join(', ')} onChange={(v) => setW({ ...w, tags: v.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean) })} />
        </Field>
      </Stack>
    </Modal>
  )
}

function WishCard({ w, onEdit }: { w: Wish; onEdit: () => void }) {
  const dispatch = useAppDispatch()
  const task = useAppSelector((s) => (w.taskId ? s.grimoire.tasks[w.taskId] : undefined))
  return (
    <Box p="4" borderRadius="l3" borderWidth="1px" borderColor="purple.800" bg="bg.subtle" backgroundImage="radial-gradient(16rem 8rem at 100% 0%, rgba(147,112,170,.14), transparent 70%)">
      <Flex justify="space-between" gap="2" align="flex-start">
        <Box cursor="pointer" onClick={onEdit}>
          <HStack gap="2">
            <Box color="purple.200">
              <Sparkle size={12} />
            </Box>
            <Text fontFamily="heading" fontSize="xl" color="purple.100" fontWeight="semibold" lineHeight="1.2">
              {w.title}
            </Text>
          </HStack>
          {w.description && (
            <Text fontSize="sm" color="fg.muted" mt="1">
              {w.description}
            </Text>
          )}
          <Text fontSize="xs" color="fg.subtle" mt="1">
            {w.price ? `≈ ${w.price.toLocaleString('ru')} ₽ · ` : ''}
            {w.sabbat ? `к ${sabbats[w.sabbat].dative} · ` : ''}
            мечтаю {span(w.createdAt, new Date().toISOString())}
          </Text>
        </Box>
      </Flex>
      <HStack gap="2" mt="3" wrap="wrap">
        {w.status === 'dream' && (
          <Button size="xs" colorPalette="purple" onClick={() => {
            dispatch(A.wishToTask({ wishId: w.id }))
            notify('Стала делом: оно в бэклоге', 'success', 'Когда дело будет сделано, мечта уйдёт в зал славы')
          }}>
            Воплотить
          </Button>
        )}
        {w.status === 'inProgress' && (
          <Text fontSize="xs" color="purple.200">
            в деле{task ? `: ${task.title}` : ''}
          </Text>
        )}
        <Button size="xs" variant="outline" onClick={() => dispatch(A.fulfillWish({ id: w.id }))}>
          Сбылась
        </Button>
        <Button size="xs" variant="ghost" onClick={() => dispatch(A.releaseWish(w.id))}>
          Отпустить
        </Button>
      </HStack>
    </Box>
  )
}

export default function Wishes() {
  const g = useAppSelector((s) => s.grimoire)
  const [tab, setTab] = useState<'chest' | 'hall'>('chest')
  const [edit, setEdit] = useState<Draft>()
  const all = Object.values(g.wishes)
  const dreams = all.filter((w) => w.status === 'dream' || w.status === 'inProgress').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const fame = all.filter((w) => w.status === 'fulfilled').sort((a, b) => (b.fulfilledAt ?? '').localeCompare(a.fulfilledAt ?? ''))
  const avgDays = fame.length ? Math.round(fame.reduce((s, w) => s + daysBetween(w.createdAt.slice(0, 10), (w.fulfilledAt ?? w.createdAt).slice(0, 10)), 0) / fame.length) : 0

  return (
    <>
      <PageHeader title={tab === 'chest' ? 'Сундук желаний' : 'Зал славы'}>
        {tab === 'chest' && (
          <Button size="sm" onClick={() => setEdit({ title: '' })}>
            <LuPlus /> Хотелка
          </Button>
        )}
      </PageHeader>
      <Tabs.Root value={tab} onValueChange={(e) => setTab(e.value as 'chest' | 'hall')} variant="line" size="sm" mb="4">
        <Tabs.List>
          <Tabs.Trigger value="chest">Сундук · {dreams.length}</Tabs.Trigger>
          <Tabs.Trigger value="hall">Зал славы · {fame.length}</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
      {tab === 'chest' ? (
        dreams.length ? (
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
            {dreams.map((w) => (
              <WishCard key={w.id} w={w} onEdit={() => setEdit(w)} />
            ))}
          </SimpleGrid>
        ) : (
          <Empty>Сундук пуст. Мечте не нужен дедлайн.</Empty>
        )
      ) : (
        <>
          {fame.length > 0 && (
            <Text fontSize="sm" color="fg.muted" mb="3">
              Исполнено мечтаний: {fame.length} · в среднем {plural(avgDays, 'день', 'дня', 'дней')} от мечты до яви
            </Text>
          )}
          {fame.length ? (
            <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
              {fame.map((w) => (
                <Box key={w.id} p="4" borderRadius="l3" borderWidth="1px" borderColor="ember.700" bg="bg.subtle" backgroundImage="radial-gradient(16rem 8rem at 0% 0%, rgba(224,164,85,.14), transparent 70%)">
                  <HStack gap="2" color="ember.200">
                    <Crescent size={14} />
                    <Text fontFamily="heading" fontSize="xl" fontWeight="semibold">
                      {w.title}
                    </Text>
                  </HStack>
                  <Text fontSize="xs" color="fg.muted" mt="1">
                    {new Date(w.createdAt).toLocaleDateString('ru')} → {w.fulfilledAt ? new Date(w.fulfilledAt).toLocaleDateString('ru') : '—'} · {w.fulfilledAt ? span(w.createdAt, w.fulfilledAt) : ''}
                  </Text>
                  {w.fulfilledNote && (
                    <Text fontSize="sm" mt="2">
                      {w.fulfilledNote}
                    </Text>
                  )}
                </Box>
              ))}
            </SimpleGrid>
          ) : (
            <Empty>Здесь будут сбывшиеся мечты.</Empty>
          )}
        </>
      )}
      {edit && <WishDialog wish={edit} onClose={() => setEdit(undefined)} />}
    </>
  )
}
