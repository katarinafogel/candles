import { Button, Flex, IconButton, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuArchive, LuPencil, LuShoppingCart, LuTrash2, LuClipboardCheck } from 'react-icons/lu'
import { useParams } from 'react-router-dom'
import { confirmAction, Empty, IdBadge, PageHeader, Row, Section, Stat } from '../components/ui'
import { fmt, fmtDateTime, stockOf, thresholdOf, unitPrice } from '../lib/calc'
import { categoryLabel, unitLabel } from '../lib/labels'
import { fallbackUse } from '../lib/selectors'
import { useAppDispatch, useData } from '../store'
import { actions } from '../store/dataSlice'
import { InventoryDialog, MaterialDialog, PurchaseDialog } from './Stock'

const kindLabel = { purchase: 'закупка', use: 'списание', return: 'возврат', inventory: 'инвентаризация' }

export default function MaterialPage() {
  const { id = '' } = useParams()
  const d = useData()
  const dispatch = useAppDispatch()
  const [dialog, setDialog] = useState<'edit' | 'buy' | 'inv' | null>(null)
  const m = d.materials[id]
  if (!m) return <Empty>Материал не найден</Empty>
  const st = stockOf(m)
  const thr = thresholdOf(m, fallbackUse(d, m))
  const price = unitPrice(m)
  const u = unitLabel[m.unit]
  const moves = [...m.movements].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <PageHeader title={m.name} back="/stock">
        <Button size="sm" onClick={() => setDialog('buy')}>
          <LuShoppingCart /> Закупка
        </Button>
        <Button size="sm" variant="outline" onClick={() => setDialog('inv')}>
          <LuClipboardCheck /> Инвентаризация
        </Button>
        <Button size="sm" variant="outline" onClick={() => setDialog('edit')}>
          <LuPencil />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => confirmAction('Убрать материал в архив? История сохранится.') && dispatch(actions.upsertMaterial({ ...m, archived: !m.archived }))}
        >
          <LuArchive /> {m.archived ? 'Из архива' : 'В архив'}
        </Button>
      </PageHeader>
      <SimpleGrid columns={{ base: 2, md: 3 }} gap="3" mb="4">
        <Stat label={`остаток, ${u}`} value={fmt(st)} tone={thr != null && st < thr ? 'warn' : undefined} />
        <Stat label={`порог «заканчивается», ${u}${m.thresholdOverride != null ? ' (вручную)' : ''}`} value={fmt(thr)} />
        <Stat label={`цена за ${u}`} value={price != null ? `${fmt(price, 3)} ₽` : '—'} />
      </SimpleGrid>
      <Section title="О материале">
        <Row label="Категория">{categoryLabel[m.category]}</Row>
        <Row label="Производитель">{m.maker || '—'}</Row>
        {m.color && <Row label="Цвет">{m.color}{m.dyeForm ? ` · ${m.dyeForm === 'liquid' ? 'жидкий' : 'твёрдый'}` : ''}</Row>}
        {m.wickWidthCm && <Row label="Ширина фитиля">{fmt(m.wickWidthCm)} см</Row>}
        {!!m.seasons?.length && <Row label="Сезоны">{m.seasons.join(', ')}</Row>}
        {!!m.notes?.length && <Row label="Ноты">{m.notes.join(', ')}</Row>}
        <Row label="Оценка">{m.rating ? '★'.repeat(m.rating) : '—'}</Row>
        <Row label="Докупить">{m.toBuy ? 'да' : 'нет'}</Row>
        <Row label="Отзыв">{m.review || '—'}</Row>
      </Section>
      <Section title="Движения">
        {!moves.length && <Text color="fg.muted" fontSize="sm">Движений пока не было.</Text>}
        <Stack gap="0">
          {moves.map((mv) => (
            <Flex key={mv.id} align="center" gap="3" py="2" borderBottomWidth="1px" borderColor="border.muted" _last={{ borderBottomWidth: 0 }}>
              <Stack gap="0" flex="1" minW="0">
                <Flex gap="2" align="center" wrap="wrap">
                  <Text fontSize="sm">{kindLabel[mv.kind]}</Text>
                  {mv.ref && <IdBadge id={mv.ref} to={mv.ref.startsWith('P-') ? `/holders/${mv.ref}` : mv.ref.startsWith('S-') ? `/candles/${mv.ref}` : undefined} />}
                </Flex>
                <Text fontSize="xs" color="fg.muted" truncate>
                  {fmtDateTime(mv.date)}
                  {mv.price != null && ` · ${fmt(mv.price)} ₽`}
                  {mv.comment && ` · ${mv.comment}`}
                  {mv.link && ` · ${mv.link}`}
                </Text>
              </Stack>
              <Text fontSize="sm" color={mv.qty < 0 ? 'fg.muted' : 'emerald.300'} whiteSpace="nowrap">
                {mv.qty > 0 ? '+' : ''}
                {fmt(mv.qty)} {u}
              </Text>
              {(mv.kind === 'purchase' || mv.kind === 'inventory') && (
                <IconButton
                  size="xs"
                  variant="ghost"
                  aria-label="удалить"
                  onClick={() => confirmAction('Удалить эту запись?') && dispatch(actions.removeMovement({ materialId: id, movementId: mv.id }))}
                >
                  <LuTrash2 />
                </IconButton>
              )}
            </Flex>
          ))}
        </Stack>
      </Section>
      {dialog === 'edit' && <MaterialDialog material={m} onClose={() => setDialog(null)} />}
      {dialog === 'buy' && <PurchaseDialog materialId={id} onClose={() => setDialog(null)} />}
      {dialog === 'inv' && <InventoryDialog materialId={id} onClose={() => setDialog(null)} />}
    </>
  )
}
