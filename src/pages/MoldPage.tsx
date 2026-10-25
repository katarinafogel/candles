import { Badge, Button, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuPencil } from 'react-icons/lu'
import { Empty, IdBadge, PageHeader, Row, Section, Stat, StarRating } from '../components/ui'
import { fmt } from '../lib/calc'
import { candleStageLabel, holderStageLabel, moldPurposeLabel, wickSchemeLabel } from '../lib/labels'
import { candleRating, moldStats } from '../lib/selectors'
import { useAppDispatch, useData } from '../store'
import { actions } from '../store/dataSlice'
import { ArchiveButton, MoldDialog } from './Molds'
import { useParams } from 'react-router-dom'

export default function MoldPage() {
  const { id = '' } = useParams()
  const d = useData()
  const dispatch = useAppDispatch()
  const [edit, setEdit] = useState(false)
  const m = d.molds[id]
  if (!m) return <Empty>Форма {id} не найдена</Empty>
  const st = moldStats(d, id)

  return (
    <>
      <PageHeader title={m.name} back="/molds">
        <Button size="sm" variant="outline" onClick={() => setEdit(true)}>
          <LuPencil /> Изменить
        </Button>
        <ArchiveButton mold={m} size="sm" />
      </PageHeader>
      <HStack mb="4" gap="3">
        <StarRating value={m.rating} onChange={(v) => dispatch(actions.upsertMold({ ...m, rating: v }))} />
        {m.archived && <Badge colorPalette="gray">в архиве — не показывается при заливке</Badge>}
      </HStack>
      <SimpleGrid columns={{ base: 2, md: 4 }} gap="3" mb="4">
        <Stat label="подсвечников отлито" value={st.holders.length} />
        <Stat label="процент брака" value={st.defectPct != null ? `${fmt(st.defectPct, 0)}%` : '—'} tone={(st.defectPct ?? 0) > 20 ? 'warn' : undefined} />
        <Stat label="средняя оценка" value={st.avgOverall != null ? fmt(st.avgOverall, 1) : '—'} />
        <Stat label="оценка дизайна" value={st.avgDesign != null ? fmt(st.avgDesign, 1) : '—'} />
      </SimpleGrid>
      <Section title="Параметры">
        <Row label="ИД">{m.id}</Row>
        <Row label="Назначение">{moldPurposeLabel[m.purpose]}</Row>
        <Row label="Копий">{m.copies}</Row>
        <Row label="Объём по воде">{fmt(m.waterVolumeMl)} мл</Row>
        <Row label="% воды">{fmt(m.waterPct)}%</Row>
        <Row label="Ёмкость под воск">{fmt(m.waxCapacityG)} г</Row>
        <Row label="Фитиль">{m.defaultWick ? `${wickSchemeLabel[m.defaultWick.scheme]}, ${fmt(m.defaultWick.lengthCm)} см` : '—'}</Row>
        <Row label="% отдушки">{fmt(m.fragrancePct)}%</Row>
        <Row label="Статус">{m.archived ? 'в архиве' : 'в работе'}</Row>
        {m.comment && <Row label="Комментарий">{m.comment}</Row>}
      </Section>
      <Section title="Отлитые подсвечники">
        {!st.holders.length && <Text color="fg.muted" fontSize="sm">Пока ничего.</Text>}
        <Stack gap="1.5">
          {st.holders.map((h) => {
            const c = h.candleId ? d.candles[h.candleId] : undefined
            const r = c ? candleRating(d, c.id) : undefined
            return (
              <HStack key={h.id} gap="2" wrap="wrap">
                <IdBadge id={h.id} to={`/holders/${h.id}`} />
                <Text fontSize="sm" color={h.stage === 'defect' ? 'red.400' : 'fg.muted'}>
                  {holderStageLabel[h.stage]}
                </Text>
                {c && (
                  <>
                    <IdBadge id={c.id} to={`/candles/${c.id}`} />
                    <Text fontSize="sm" color="fg.muted">
                      {candleStageLabel[c.stage]}
                      {r != null && ` · ${r}/10`}
                    </Text>
                  </>
                )}
              </HStack>
            )
          })}
        </Stack>
      </Section>
      {edit && <MoldDialog mold={m} onClose={() => setEdit(false)} />}
    </>
  )
}
