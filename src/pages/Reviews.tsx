import { Box, Button, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuCheckCheck, LuClipboardPaste, LuRefreshCw } from 'react-icons/lu'
import { useSearchParams } from 'react-router-dom'
import { ReviewCard } from '../components/ReviewForm'
import { confirmAction, Empty, Field, IdBadge, Modal, notify, PageHeader, Select, TextArea } from '../components/ui'
import { fmtDateTime } from '../lib/calc'
import { load } from '../lib/sync'
import type { Review } from '../types'
import { byId } from '../lib/selectors'
import { store, useAppDispatch, useAppSelector, useData } from '../store'
import { actions } from '../store/dataSlice'

/** The recipient's «Скопировать ответ» text is the review JSON; it is imported the same way. */
function parsePastedReview(text: string): Review {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('В тексте нет ответа')
  const r = JSON.parse(text.slice(start, end + 1))
  if (!r.id || !r.candleId) throw new Error('В ответе нет ИД свечи')
  return { ...r, source: 'qr', read: false }
}

function PasteDialog({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [text, setText] = useState('')
  return (
    <Modal
      open
      onClose={onClose}
      title="Вставить ответ"
      footer={
        <Button
          disabled={!text.trim()}
          onClick={() => {
            try {
              const r = parsePastedReview(text)
              dispatch(actions.addReviews([r]))
              notify(`Отзыв на ${r.candleId} добавлен`)
              onClose()
            } catch (e) {
              notify('Не получилось разобрать', 'error', (e as Error).message)
            }
          }}
        >
          Импортировать
        </Button>
      }
    >
      <Field label="Текст, который получатель скопировал кнопкой «Скопировать ответ»">
        <TextArea value={text} onChange={setText} rows={8} />
      </Field>
    </Modal>
  )
}

type Filter = 'all' | 'unread' | 'orphan'

export default function Reviews() {
  const d = useData()
  const dispatch = useAppDispatch()
  const [sp, setSp] = useSearchParams()
  const f = (sp.get('f') ?? 'all') as Filter
  const [pulling, setPulling] = useState(false)
  const loadedAt = useAppSelector((s) => s.local.sync.loadedAt)
  const [paste, setPaste] = useState(false)
  const all = Object.values(d.reviews).sort((a, b) => b.date.localeCompare(a.date))
  const list = all.filter((r) => (f === 'unread' ? !r.read : f === 'orphan' ? !d.candles[r.candleId] : true))
  const orphanCount = all.filter((r) => !d.candles[r.candleId]).length

  async function pull() {
    setPulling(true)
    await load()
    setPulling(false)
    const err = store.getState().local.sync.error
    if (err) notify('Не удалось обновить', 'error', err)
    else notify('Обновлено')
  }

  return (
    <>
      <PageHeader title="Отзывы" back="/more">
        <Button size="sm" onClick={pull} loading={pulling}>
          <LuRefreshCw /> Обновить
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPaste(true)}>
          <LuClipboardPaste /> Вставить ответ
        </Button>
      </PageHeader>
      <Flex gap="2" mb="4" wrap="wrap" align="center">
        {(
          [
            ['all', `Все · ${all.length}`],
            ['unread', `Непрочитанные · ${all.filter((r) => !r.read).length}`],
            ['orphan', `Без свечи · ${orphanCount}`],
          ] as [Filter, string][]
        ).map(([k, label]) => (
          <Button key={k} size="xs" borderRadius="full" variant={f === k ? 'solid' : 'outline'} onClick={() => setSp(k === 'all' ? {} : { f: k }, { replace: true })}>
            {label}
          </Button>
        ))}
        {f === 'unread' && list.length > 0 && (
          <Button size="xs" variant="ghost" onClick={() => dispatch(actions.setReviewRead({ ids: list.map((r) => r.id), read: true }))}>
            <LuCheckCheck /> Прочитать все
          </Button>
        )}
        <Text fontSize="xs" color="fg.muted" ml="auto">
          Обновлено: {loadedAt ? fmtDateTime(loadedAt) : '—'}
        </Text>
      </Flex>
      {!list.length && <Empty>Отзывов нет.</Empty>}
      <Stack gap="3">
        {list.map((r) => {
          const known = !!d.candles[r.candleId]
          return (
            <Box key={r.id}>
              <HStack mb="1" gap="2">
                <IdBadge id={r.candleId} to={known ? `/candles/${r.candleId}` : undefined} />
                {known ? (
                  <Text fontSize="sm" color="fg.muted">
                    {d.candles[r.candleId].name}
                  </Text>
                ) : (
                  <Text fontSize="sm" color="orange.300">
                    свечи с таким ИД нет
                  </Text>
                )}
              </HStack>
              <ReviewCard r={r}>
                <HStack mt="2" gap="2" wrap="wrap">
                  <Button size="xs" variant="ghost" onClick={() => dispatch(actions.setReviewRead({ ids: [r.id], read: !r.read }))}>
                    {r.read ? 'Сделать непрочитанным' : 'Прочитано'}
                  </Button>
                  {!known && (
                    <Box minW="200px">
                      <Select
                        size="sm"
                        value=""
                        onChange={(v) => v && dispatch(actions.reassignReview({ id: r.id, candleId: v }))}
                        placeholder="Привязать к свече…"
                        options={byId(d.candles).map((c) => ({ value: c.id, label: `${c.id} · ${c.name}` }))}
                      />
                    </Box>
                  )}
                  <Button size="xs" variant="ghost" colorPalette="red" onClick={() => confirmAction('Удалить отзыв?') && dispatch(actions.deleteReview(r.id))}>
                    Удалить
                  </Button>
                </HStack>
              </ReviewCard>
            </Box>
          )
        })}
      </Stack>
      {paste && <PasteDialog onClose={() => setPaste(false)} />}
    </>
  )
}
