// Adding ready-made holders and candles with everything known about them, and editing existing ones.
import { Input, SimpleGrid, Text } from '@chakra-ui/react'
import { nanoid } from '@reduxjs/toolkit'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CandleFields, HolderCommentField, HolderFields, type HolderSections } from '../components/ItemFields'
import { MoldPicker } from '../components/MoldPicker'
import { DateInput, Empty, Field, FormActions, notify, PageHeader, Section, Select, TextInput } from '../components/ui'
import { nowLocal, toIso, toLocal } from '../lib/dates'
import { candleToForm, emptyCandleForm, emptyHolderForm, formToDecor, formToHolder, formToPour, holderToForm, type CandleForm } from '../lib/itemForms'
import { isPlaster, plasterPurposes } from '../lib/labels'
import { sortMolds } from '../lib/selectors'
import { useAppDispatch, useData } from '../store'
import { actions } from '../store/dataSlice'
import type { Holder } from '../types'

const itemsOf = (counts: Record<string, number>) => Object.entries(counts).filter(([, n]) => n > 0).map(([moldId, count]) => ({ moldId, count }))
const total = (counts: Record<string, number>) => Object.values(counts).reduce((a, n) => a + n, 0)
const noStock = 'Со склада ничего не спишется.'
const sharesOk = (f: CandleForm) => Math.abs(f.waxes.reduce((a, w) => a + w.share, 0) - 100) <= 0.01

/** What an existing holder has been through; a ready-made one can have any of it. */
const reachedOf = (h: Holder): HolderSections => ({
  mix: h.premade || !!h.mix,
  varnishIn: h.premade || !!h.varnishIn,
  painting: h.premade || !!h.painting,
  varnishOut: h.premade || !!h.varnishOut,
  dampers: h.purpose === 'holder' && (h.premade || !!h.dampers),
})

export function AddHolders() {
  const d = useData()
  const dispatch = useAppDispatch()
  const nav = useNavigate()
  const molds = sortMolds(d, Object.values(d.molds).filter((m) => !m.archived && isPlaster(m.purpose)))
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [date, setDate] = useState(nowLocal())
  const [f, setF] = useState(emptyHolderForm)
  const n = total(counts)
  const anyHolder = itemsOf(counts).some((i) => d.molds[i.moldId]?.purpose === 'holder')
  function save() {
    dispatch(actions.addReadyHolders({ items: itemsOf(counts), date: toIso(date), details: formToHolder(f, d.settings.plasterDensity) }))
    notify(`Добавлено: ${n} шт.`)
    nav(`/holders?stage=${anyHolder ? 'dampers' : 'done'}`)
  }
  return (
    <>
      <PageHeader title="Добавить готовые изделия" back="/holders" />
      <Section>
        <Text fontSize="sm" color="fg.muted" mb="4">
          Подсвечники встанут на этап «ждёт фитиля», тарелки и фигурки сразу будут готовы. Заполните что помните, всё необязательно. {noStock}
        </Text>
        <MoldPicker molds={molds} kinds={plasterPurposes} counts={counts} onChange={setCounts} />
      </Section>
      <Section>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
          <Field label="Дата">
            <DateInput kind="datetime-local" value={date} onChange={setDate} />
          </Field>
          <HolderCommentField value={f.comment} onChange={(v) => setF({ ...f, comment: v })} />
        </SimpleGrid>
      </Section>
      <HolderFields f={f} onChange={setF} show={{ mix: true, varnishIn: true, painting: true, varnishOut: true, dampers: anyHolder || !n }} />
      <FormActions onCancel={() => nav(-1)} onSave={save} disabled={!n} saveLabel={`Сохранить · ${n}`} />
    </>
  )
}

const giftNew = '__new'
const giftSelf = '__self'

export function AddCandles() {
  const d = useData()
  const dispatch = useAppDispatch()
  const nav = useNavigate()
  const molds = sortMolds(d, Object.values(d.molds).filter((m) => !m.archived && (m.purpose === 'holder' || m.purpose === 'candle')))
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [date, setDate] = useState(nowLocal())
  const [f, setF] = useState(emptyCandleForm)
  const [hf, setHf] = useState(emptyHolderForm)
  const [gift, setGift] = useState('')
  const [newPerson, setNewPerson] = useState('')
  const [givenAt, setGivenAt] = useState(nowLocal())
  const n = total(counts)
  const anyHolder = itemsOf(counts).some((i) => d.molds[i.moldId]?.purpose === 'holder')
  function save() {
    if (!sharesOk(f)) return notify('Доли воска должны давать 100%', 'warning')
    let personId = gift && gift !== giftSelf && gift !== giftNew ? gift : undefined
    if (gift === giftNew && newPerson.trim()) {
      personId = nanoid(8)
      dispatch(actions.upsertPerson({ id: personId, name: newPerson.trim(), contact: '', notes: '' }))
    }
    const given = personId || gift === giftSelf ? { personId, burnedBySelf: gift === giftSelf, givenAt: toIso(givenAt) } : undefined
    dispatch(
      actions.addReadyCandles({
        items: itemsOf(counts),
        date: toIso(date),
        name: f.name.trim(),
        scheme: f.scheme,
        lengthCm: f.lengthCm,
        instructionId: f.instructionId,
        comment: f.comment.trim() || undefined,
        decor: formToDecor(f),
        pour: formToPour(f),
        holder: formToHolder(hf, d.settings.plasterDensity),
        given,
      }),
    )
    notify(`Добавлено свечей: ${n}`)
    nav(`/candles?stage=${given ? 'given' : 'ready'}`)
  }
  return (
    <>
      <PageHeader title="Добавить готовые свечи" back="/candles" />
      <Section>
        <Text fontSize="sm" color="fg.muted" mb="4">
          Свечи встанут на этап «готова» или «подарена». Заполните что помните, всё необязательно. Значения общие для всех выбранных свечей. {noStock}
        </Text>
        <MoldPicker molds={molds} kinds={['holder', 'candle']} counts={counts} onChange={setCounts} />
      </Section>
      <Section>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
          <Field label="Дата готовности">
            <DateInput kind="datetime-local" value={date} onChange={setDate} />
          </Field>
          <Field label="Кому подарена">
            <Select
              value={gift}
              onChange={setGift}
              placeholder="— пока не подарена —"
              options={[
                { value: giftSelf, label: 'сожгла сама' },
                { value: giftNew, label: '+ новый человек' },
                ...Object.values(d.people)
                  .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
                  .map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </Field>
          {gift === giftNew && (
            <Field label="Имя нового человека">
              <TextInput value={newPerson} onChange={setNewPerson} />
            </Field>
          )}
          {gift && (
            <Field label="Дата выдачи">
              <DateInput kind="datetime-local" value={givenAt} onChange={setGivenAt} />
            </Field>
          )}
        </SimpleGrid>
      </Section>
      <CandleFields f={f} onChange={setF} show={{ pour: true, decor: true }} wickHint="пусто — из формы" />
      {anyHolder && (
        <>
          <Text fontWeight="semibold" mb="2">
            Подсвечник
          </Text>
          <HolderFields f={hf} onChange={setHf} show={{ mix: true, varnishIn: true, painting: true, varnishOut: true, dampers: true }} />
        </>
      )}
      <FormActions onCancel={() => nav(-1)} onSave={save} disabled={!n} saveLabel={`Сохранить · ${n}`} />
    </>
  )
}

export function EditHolder() {
  const { id = '' } = useParams()
  const d = useData()
  const h = d.holders[id]
  if (!h) return <Empty>Изделие {id} не найдено</Empty>
  return <EditHolderForm key={id} h={h} />
}

function EditHolderForm({ h }: { h: Holder }) {
  const d = useData()
  const dispatch = useAppDispatch()
  const nav = useNavigate()
  const [f, setF] = useState(() => holderToForm(h))
  const [dryStart, setDryStart] = useState(toLocal(h.dryStart))
  const [dryEnd, setDryEnd] = useState(h.dryEnd ? toLocal(h.dryEnd) : '')
  function save() {
    dispatch(
      actions.editHolder({
        id: h.id,
        details: { ...formToHolder(f, d.settings.plasterDensity, h), dryStart: toIso(dryStart), dryEnd: h.dryEnd && dryEnd ? toIso(dryEnd) : h.dryEnd },
      }),
    )
    notify('Сохранено')
    nav(-1)
  }
  return (
    <>
      <PageHeader title={`Редактировать ${h.id}`} back={`/holders/${h.id}`} />
      <Section>
        <Text fontSize="sm" color="fg.muted" mb="4">
          Правки меняют запись об изделии. Склад и себестоимость остаются как были.
        </Text>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
          <Field label={h.premade ? 'Дата' : 'Начало сушки'}>
            <DateInput kind="datetime-local" value={dryStart} onChange={setDryStart} />
          </Field>
          {h.dryEnd && (
            <Field label="Конец сушки">
              <DateInput kind="datetime-local" value={dryEnd} onChange={setDryEnd} />
            </Field>
          )}
          <HolderCommentField value={f.comment} onChange={(v) => setF({ ...f, comment: v })} />
        </SimpleGrid>
      </Section>
      <HolderFields f={f} onChange={setF} show={reachedOf(h)} showMixComment={!h.premade} />
      <FormActions onCancel={() => nav(-1)} onSave={save} />
    </>
  )
}

export function EditCandle() {
  const { id = '' } = useParams()
  const d = useData()
  if (!d.candles[id]) return <Empty>Свеча {id} не найдена</Empty>
  return <EditCandleForm key={id} id={id} />
}

function EditCandleForm({ id }: { id: string }) {
  const d = useData()
  const dispatch = useAppDispatch()
  const nav = useNavigate()
  const c = d.candles[id]
  const h = c.holderId ? d.holders[c.holderId] : undefined
  const pour = c.pourId ? d.pours[c.pourId] : undefined
  const [f, setF] = useState(() => candleToForm(c, pour))
  const [hf, setHf] = useState(() => (h ? holderToForm(h) : emptyHolderForm()))
  const [readyAt, setReadyAt] = useState(c.readyAt ? toLocal(c.readyAt) : '')
  const [pouredAt, setPouredAt] = useState(c.pouredAt ? toLocal(c.pouredAt) : '')
  const [givenAt, setGivenAt] = useState(c.givenAt ? toLocal(c.givenAt) : '')
  const [personId, setPersonId] = useState(c.burnedBySelf ? giftSelf : (c.personId ?? ''))
  const others = pour ? pour.candleIds.length - 1 : 0
  function save() {
    if ((pour || c.premade) && !sharesOk(f)) return notify('Доли воска должны давать 100%', 'warning')
    const given = c.stage === 'given'
    dispatch(
      actions.editCandle({
        id,
        details: {
          name: f.name,
          wick: { scheme: f.scheme ?? c.wick.scheme, lengthCm: f.lengthCm ?? c.wick.lengthCm },
          instructionId: f.instructionId,
          comment: f.comment.trim() || undefined,
          decor: formToDecor(f),
          readyAt: c.readyAt && readyAt ? toIso(readyAt) : c.readyAt,
          pouredAt: c.pouredAt && pouredAt ? toIso(pouredAt) : c.pouredAt,
          ...(given && {
            givenAt: givenAt ? toIso(givenAt) : c.givenAt,
            burnedBySelf: personId === giftSelf,
            personId: personId && personId !== giftSelf ? personId : undefined,
          }),
        },
        pour: pour || c.premade ? formToPour(f, pour) : undefined,
      }),
    )
    if (h) dispatch(actions.editHolder({ id: h.id, details: formToHolder(hf, d.settings.plasterDensity, h) }))
    notify('Сохранено')
    nav(-1)
  }
  return (
    <>
      <PageHeader title={`Редактировать ${id}`} back={`/candles/${id}`} />
      {(c.readyAt || c.pouredAt || c.stage === 'given') && (
        <Section>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
            {c.pouredAt && (
              <Field label="Дата заливки">
                <DateInput kind="datetime-local" value={pouredAt} onChange={setPouredAt} />
              </Field>
            )}
            {c.readyAt && (
              <Field label="Дата готовности">
                <DateInput kind="datetime-local" value={readyAt} onChange={setReadyAt} />
              </Field>
            )}
            {c.stage === 'given' && (
              <>
                <Field label="Кому">
                  <Select
                    value={personId}
                    onChange={setPersonId}
                    placeholder="— не указано —"
                    options={[{ value: giftSelf, label: 'сожгла сама' }, ...Object.values(d.people).map((p) => ({ value: p.id, label: p.name }))]}
                  />
                </Field>
                <Field label="Дата выдачи">
                  <DateInput kind="datetime-local" value={givenAt} onChange={setGivenAt} />
                </Field>
              </>
            )}
          </SimpleGrid>
        </Section>
      )}
      <Text fontSize="sm" color="fg.muted" mb="4">
        Правки меняют запись о свече. Склад и себестоимость остаются как были.
      </Text>
      <CandleFields
        f={f}
        onChange={setF}
        show={{ pour: !!pour || c.premade, decor: c.premade || c.decor.length > 0 || c.history.some((e) => e.stage === 'decorated') }}
        sharedPour={others > 0 ? `Заливка ${c.pourId} общая ещё для свечей: ${others}. Изменения коснутся всех.` : undefined}
      />
      {h && (
        <>
          <Text fontWeight="semibold" mb="2">
            Подсвечник {h.id}
          </Text>
          <HolderFields f={hf} onChange={setHf} show={reachedOf(h)} showMixComment={!h.premade} />
        </>
      )}
      <FormActions onCancel={() => nav(-1)} onSave={save} />
    </>
  )
}
