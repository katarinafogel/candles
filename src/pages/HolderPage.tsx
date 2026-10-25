import { Box, Button, HStack, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuArrowRight, LuUndo2, LuTriangleAlert } from 'react-icons/lu'
import { useParams } from 'react-router-dom'
import { History } from '../components/History'
import { DefectDialog, HolderStepDialog } from '../components/StepDialogs'
import { confirmAction, Empty, IdBadge, Link, notify, PageHeader, Row, Section, Select } from '../components/ui'
import { daysBetween, fmt, fmtDateTime } from '../lib/calc'
import { candleStageLabel, defectReasonLabel, holderNextTitle, holderStageLabel, varnishKindLabel } from '../lib/labels'
import { holderTitle } from '../lib/selectors'
import { useAppDispatch, useData } from '../store'
import { actions, nextHolderStage } from '../store/dataSlice'
import type { MixPart } from '../types'

export function MixRecipe({ mix }: { mix: { water: MixPart; plaster: MixPart; plasticizer: MixPart; defoamer: MixPart; dye: MixPart & { color?: string; form?: string }; comment: string } }) {
  const d = useData()
  const mat = (p: MixPart) => (p.materialId ? d.materials[p.materialId]?.name : undefined)
  const line = (label: string, p: MixPart, showPct = true) => (
    <Row label={label}>
      {fmt(p.factG)} г{showPct ? ` · ${fmt(p.pct)}%` : ''}
      {mat(p) ? ` · ${mat(p)}` : ''}
      {p.factG !== p.calcG && (
        <Text as="span" color="fg.muted">
          {' '}
          (расчёт {fmt(p.calcG)})
        </Text>
      )}
    </Row>
  )
  return (
    <>
      {line('Вода', mix.water)}
      {line('Гипс', mix.plaster, false)}
      {line('Пластификатор', mix.plasticizer)}
      {line('Пеногаситель', mix.defoamer)}
      <Row label="Краситель">
        {fmt(mix.dye.factG)} г · {fmt(mix.dye.pct)}%{mat(mix.dye) ? ` · ${mat(mix.dye)}` : ''}
        {mix.dye.color ? ` · ${mix.dye.color}` : ''}
        {mix.dye.form ? ` · ${mix.dye.form === 'liquid' ? 'жидкий' : 'твёрдый'}` : ''}
      </Row>
      {mix.comment && <Row label="Комментарий">{mix.comment}</Row>}
    </>
  )
}

export default function HolderPage() {
  const { id = '' } = useParams()
  const d = useData()
  const dispatch = useAppDispatch()
  const [dialog, setDialog] = useState<'next' | 'defect' | null>(null)
  const h = d.holders[id]
  if (!h) return <Empty>Подсвечник {id} не найден</Empty>
  const mold = d.molds[h.moldId]
  const candle = h.candleId ? d.candles[h.candleId] : undefined
  const mat = (mid?: string) => (mid ? d.materials[mid]?.name ?? '—' : '—')
  const next = nextHolderStage(h)
  const lastStage = h.history[h.history.length - 1]?.stage
  const canUndo = h.history.length > 1 && !(lastStage === 'wicked' && candle && candle.stage !== 'wicked')

  return (
    <>
      <PageHeader title={holderTitle(d, h)} back="/holders">
        {next && (
          <Button size="sm" onClick={() => setDialog('next')}>
            {holderNextTitle(h)} <LuArrowRight />
          </Button>
        )}
        {canUndo && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!confirmAction('Вернуть на этап назад? Материалы этого этапа вернутся на склад.')) return
              dispatch(actions.undoHolder({ id, date: new Date().toISOString() }))
              notify('Возвращено на этап назад')
            }}
          >
            <LuUndo2 /> Назад
          </Button>
        )}
        {h.stage !== 'defect' && (
          <Button size="sm" variant="outline" colorPalette="red" onClick={() => setDialog('defect')}>
            <LuTriangleAlert /> Брак
          </Button>
        )}
      </PageHeader>

      <Section title="Подсвечник">
        <Row label="Этап">
          <Text color={h.stage === 'defect' ? 'red.400' : 'emerald.300'}>{holderStageLabel[h.stage]}</Text>
        </Row>
        <Row label="Форма">{mold ? <Link to={`/molds/${mold.id}`}>{mold.name}</Link> : '—'}</Row>
        <Row label="Замес">
          {h.mixId} · {fmtDateTime(h.dryStart)}
        </Row>
        <Row label="Сушка">
          {fmtDateTime(h.dryStart)} → {h.dryEnd ? fmtDateTime(h.dryEnd) : 'сохнет'}
          {h.dryEnd && ` · ${fmt(daysBetween(h.dryStart, h.dryEnd), 1)} дн.`}
        </Row>
        {h.varnishIn && (
          <Row label="Лак внутри">
            {mat(h.varnishIn.materialId)} · слоёв: {h.varnishIn.layers}
          </Row>
        )}
        {h.painting && (
          <Row label="Роспись">
            {h.painting.done
              ? `${h.painting.description || 'да'}${h.painting.paintIds.length ? ` · ${h.painting.paintIds.map(mat).join(', ')}` : ''}`
              : 'нет'}
          </Row>
        )}
        {h.varnishOut && (
          <Row label="Лак снаружи">
            {varnishKindLabel[h.varnishOut.kind]} · {mat(h.varnishOut.materialId)} · слоёв: {h.varnishOut.layers}
          </Row>
        )}
        {h.dampers && (
          <Row label="Демпферы">
            {mat(h.dampers.materialId)} · {h.dampers.count} шт
          </Row>
        )}
        {h.defect && (
          <Row label="Брак">
            <Text color="red.400">
              {defectReasonLabel[h.defect.reason]} на этапе «{holderStageLabel[h.defect.stage as never] ?? h.defect.stage}»
              {h.defect.comment && ` — ${h.defect.comment}`}
            </Text>
          </Row>
        )}
        <Row label="Свеча">
          {candle ? (
            <HStack>
              <IdBadge id={candle.id} to={`/candles/${candle.id}`} />
              <Text>
                {candle.name} · {candleStageLabel[candle.stage]}
              </Text>
            </HStack>
          ) : (
            '—'
          )}
        </Row>
      </Section>

      <Section title="Рецепт гипса">
        <MixRecipe mix={h.mix} />
      </Section>

      <Section title="История этапов">
        <Stack>
          <History entries={h.history} labels={holderStageLabel} />
        </Stack>
      </Section>

      {dialog === 'next' && <HolderStepDialog ids={[id]} onClose={() => setDialog(null)} />}
      {dialog === 'defect' && <DefectDialog kind="holder" ids={[id]} onClose={() => setDialog(null)} />}
    </>
  )
}
