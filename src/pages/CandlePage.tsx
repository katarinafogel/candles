import { Box, Button, HStack, Input, Stack, Text } from '@chakra-ui/react'
import { nanoid } from '@reduxjs/toolkit'
import { useState } from 'react'
import { LuCheck, LuGift, LuPlus, LuQrCode, LuSparkles, LuTriangleAlert, LuUndo2 } from 'react-icons/lu'
import { useParams } from 'react-router-dom'
import { History } from '../components/History'
import { QrBlock } from '../components/QrBlock'
import { ReviewCard, ReviewForm } from '../components/ReviewForm'
import { DecorateDialog, DefectDialog } from '../components/StepDialogs'
import { Check, confirmAction, Empty, Field, Link, Modal, notify, PageHeader, Row, Section, Select, TextInput } from '../components/ui'
import { candleCost, daysBetween, fmt, fmtDate, fmtDateTime } from '../lib/calc'
import { nowLocal, toIso } from '../lib/dates'
import { candleStageLabel, decorKindLabel, defectReasonLabel, holderStageLabel, wickSchemeLabel } from '../lib/labels'
import { moldOfCandle, reviewsOf } from '../lib/selectors'
import { useAppDispatch, useData } from '../store'
import { actions } from '../store/dataSlice'
import type { ReviewAnswers } from '../types'
import { MixRecipe } from './HolderPage'
import { ReadyDialog } from './Candles'

function GiveDialog({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: () => void }) {
  const d = useData()
  const dispatch = useAppDispatch()
  const [personId, setPersonId] = useState('')
  const [newName, setNewName] = useState('')
  const [self, setSelf] = useState(false)
  const [date, setDate] = useState(nowLocal())
  return (
    <Modal
      open
      onClose={onClose}
      title="Подарить"
      footer={
        <Button
          disabled={!self && !personId && !newName.trim()}
          onClick={() => {
            let pid = personId || undefined
            if (!self && !pid && newName.trim()) {
              pid = nanoid(8)
              dispatch(actions.upsertPerson({ id: pid, name: newName.trim(), contact: '', notes: '' }))
            }
            const iso = toIso(date)
            dispatch(
              actions.advanceCandles({
                ids: [id],
                date: iso,
                params: { step: 'given', personId: self ? undefined : pid, burnedBySelf: self, givenAt: iso },
              }),
            )
            onDone()
            notify('Свеча выдана — распечатайте QR')
          }}
        >
          Подарить
        </Button>
      }
    >
      <Stack gap="4">
        <Check checked={self} onChange={setSelf}>
          Сожгла сама
        </Check>
        {!self && (
          <>
            <Field label="Кому">
              <Select
                value={personId}
                onChange={setPersonId}
                placeholder="— новый человек —"
                options={Object.values(d.people)
                  .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
                  .map((p) => ({ value: p.id, label: p.name }))}
              />
            </Field>
            {!personId && (
              <Field label="Имя нового человека">
                <TextInput value={newName} onChange={setNewName} />
              </Field>
            )}
          </>
        )}
        <Field label="Дата выдачи">
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </Stack>
    </Modal>
  )
}

function ManualReview({ candleId, onClose }: { candleId: string; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [a, setA] = useState<ReviewAnswers>({})
  return (
    <Modal
      open
      onClose={onClose}
      title="Отзыв вручную"
      size="lg"
      footer={
        <Button
          onClick={() => {
            dispatch(
              actions.addReviews([{ ...a, id: crypto.randomUUID(), candleId, date: new Date().toISOString(), source: 'manual', read: true }]),
            )
            onClose()
          }}
        >
          Сохранить
        </Button>
      }
    >
      <ReviewForm value={a} onChange={setA} />
    </Modal>
  )
}

export default function CandlePage() {
  const { id = '' } = useParams()
  const d = useData()
  const dispatch = useAppDispatch()
  const [dialog, setDialog] = useState<'decor' | 'ready' | 'give' | 'defect' | 'qr' | 'review' | null>(null)
  const c = d.candles[id]
  if (!c) return <Empty>Свеча {id} не найдена</Empty>
  const h = c.holderId ? d.holders[c.holderId] : undefined
  const mold = moldOfCandle(d, c)
  const pour = c.pourId ? d.pours[c.pourId] : undefined
  const reviews = reviewsOf(d, id)
  const cost = candleCost(d, id)
  const mat = (mid?: string) => (mid ? d.materials[mid]?.name ?? '—' : '—')
  const person = c.personId ? d.people[c.personId] : undefined
  const close = () => setDialog(null)

  return (
    <>
      <PageHeader title={`${c.id} · ${c.name || mold?.name || ''}`} back="/candles">
        {c.stage === 'curing' && (
          <Button size="sm" onClick={() => setDialog('decor')}>
            <LuSparkles /> Украсить
          </Button>
        )}
        {(c.stage === 'curing' || c.stage === 'decorated') && (
          <Button size="sm" onClick={() => setDialog('ready')}>
            <LuCheck /> Готова
          </Button>
        )}
        {c.stage === 'ready' && (
          <Button size="sm" onClick={() => setDialog('give')}>
            <LuGift /> Подарить
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setDialog('qr')}>
          <LuQrCode /> QR
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const msg =
              c.history.length === 1
                ? c.holderId
                  ? 'Отклеить фитиль? Свеча удалится, подсвечник вернётся к этапу «Демпферы».'
                  : 'Удалить эту формовую свечу? Фитиль вернётся на склад.'
                : 'Вернуть на этап назад? Материалы этого этапа вернутся на склад.'
            if (!confirmAction(msg)) return
            dispatch(actions.undoCandle({ id, date: new Date().toISOString() }))
            notify('Возвращено на этап назад')
          }}
        >
          <LuUndo2 /> Назад
        </Button>
        {c.stage !== 'defect' && (
          <Button size="sm" variant="outline" colorPalette="red" onClick={() => setDialog('defect')}>
            <LuTriangleAlert /> Брак
          </Button>
        )}
      </PageHeader>

      <Section title="Свеча">
        <Row label="Этап">
          <Text color={c.stage === 'defect' ? 'red.400' : 'emerald.300'}>{candleStageLabel[c.stage]}</Text>
        </Row>
        <Row label="Название / дизайн">
          <Box maxW="sm">
            <TextInput value={c.name} onChange={(v) => dispatch(actions.updateCandle({ id, name: v }))} />
          </Box>
        </Row>
        <Row label="Инструкция">
          <Box maxW="sm">
            <Select
              size="sm"
              value={c.instructionId}
              onChange={(v) => dispatch(actions.updateCandle({ id, instructionId: v || undefined }))}
              placeholder="— без инструкции —"
              options={Object.values(d.instructions).map((i) => ({ value: i.id, label: i.title }))}
            />
          </Box>
        </Row>
        <Row label="Подсвечник">
          {h ? (
            <Link to={`/holders/${h.id}`}>
              {h.id} · {mold?.name}
            </Link>
          ) : (
            `формовая · ${mold?.name ?? '—'}`
          )}
        </Row>
        <Row label="Фитиль">
          {wickSchemeLabel[c.wick.scheme]}, {fmt(c.wick.lengthCm)} см
        </Row>
        <Row label="Дозревание">
          {c.pouredAt ? `${fmtDate(c.pouredAt)} → ${c.readyAt ? fmtDate(c.readyAt) : 'дозревает'}` : '—'}
          {c.readyAt && c.pouredAt && ` · ${fmt(daysBetween(c.pouredAt, c.readyAt), 0)} дн.`}
        </Row>
        {c.decor.length > 0 && (
          <Row label="Декор">
            {c.decor
              .map((x) => {
                const b = x.decorId ? d.decor[x.decorId] : undefined
                const name = b ? `${b.name} (${decorKindLabel[b.kind]})` : mat(x.materialId)
                return `${name} × ${x.qty}${x.dyed ? ', окрашен' : ''}`
              })
              .join('; ')}
          </Row>
        )}
        <Row label="Кому">
          {c.burnedBySelf ? 'сожгла сама' : person ? <Link to={`/people?p=${person.id}`}>{person.name}</Link> : '—'}
          {c.givenAt && ` · ${fmtDate(c.givenAt)}`}
        </Row>
        {c.defect && (
          <Row label="Брак">
            <Text color="red.400">
              {defectReasonLabel[c.defect.reason]} на этапе «{candleStageLabel[c.defect.stage as never] ?? c.defect.stage}»
              {c.defect.comment && ` — ${c.defect.comment}`}
            </Text>
          </Row>
        )}
        <Row label="Себестоимость">
          {cost.total || cost.complete ? `${fmt(cost.total)} ₽` : '—'}
          {!cost.complete && (
            <Text as="span" color="orange.300" fontSize="xs">
              {' '}
              неполная (нет цен у части материалов)
            </Text>
          )}
        </Row>
      </Section>

      <Section
        title={`Отзывы · ${reviews.length}`}
        actions={
          <Button size="xs" variant="outline" onClick={() => setDialog('review')}>
            <LuPlus /> Вручную
          </Button>
        }
      >
        {!reviews.length && (
          <Text color="fg.muted" fontSize="sm">
            Отзывов пока нет.
          </Text>
        )}
        <Stack gap="2">
          {reviews.map((r) => (
            <ReviewCard key={r.id} r={r}>
              {!r.read && (
                <Button size="xs" variant="ghost" mt="2" onClick={() => dispatch(actions.setReviewRead({ ids: [r.id], read: true }))}>
                  Отметить прочитанным
                </Button>
              )}
            </ReviewCard>
          ))}
        </Stack>
      </Section>

      {pour && (
        <Section title={`Заливка ${pour.id}`}>
          <Row label="Дата">{fmtDateTime(pour.date)}</Row>
          <Row label="Воск">
            {pour.waxes.map((w, i) => `${mat(w.materialId)} ${fmt(w.share)}% (${fmt(pour.fact.waxG[i])} г на всю заливку)`).join(' + ')}
          </Row>
          <Row label="Отдушка">
            {mat(pour.fragrance.materialId)} · {fmt(pour.fragrance.pct)}%
          </Row>
          <Row label="Краситель">
            {mat(pour.dye.materialId)} · {fmt(pour.dye.pct)}%{pour.dye.color ? ` · ${pour.dye.color}` : ''}
          </Row>
          <Row label="Температуры">
            ввод отдушки {pour.tempFragranceC ?? '—'} °C · заливка {pour.tempPourC ?? '—'} °C · форма{' '}
            {pour.tempMoldC === 'none' ? 'не грела' : `${pour.tempMoldC ?? '—'} °C`}
          </Row>
          <Row label="Свечей в заливке">{pour.candleIds.length}</Row>
          {pour.comment && <Row label="Комментарий">{pour.comment}</Row>}
        </Section>
      )}

      {h && (
        <Section title={`Подсвечник ${h.id}`}>
          <MixRecipe mix={h.mix} />
          <Box mt="4">
            <History entries={h.history} labels={holderStageLabel} />
          </Box>
        </Section>
      )}

      <Section title="История свечи">
        <History entries={c.history} labels={candleStageLabel} />
      </Section>

      {dialog === 'decor' && <DecorateDialog ids={[id]} onClose={close} />}
      {dialog === 'ready' && <ReadyDialog ids={[id]} onClose={close} />}
      {dialog === 'defect' && <DefectDialog kind="candle" ids={[id]} onClose={close} />}
      {dialog === 'give' && <GiveDialog id={id} onClose={close} onDone={() => setDialog('qr')} />}
      {dialog === 'review' && <ManualReview candleId={id} onClose={close} />}
      {dialog === 'qr' && (
        <Modal open onClose={close} title={`QR · ${id}`}>
          <QrBlock candleId={id} />
          <HStack justify="center" mt="4">
            <Link to={`/print?ids=${id}`}>Печать листом →</Link>
          </HStack>
        </Modal>
      )}
    </>
  )
}
