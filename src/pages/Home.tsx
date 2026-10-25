import { Alert, Box, Button, Flex, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuDownload, LuDroplets, LuFlaskConical, LuRefreshCw } from 'react-icons/lu'
import { Link as RouterLink } from 'react-router-dom'
import { IdBadge, Link, notify, PageHeader, Section, Stat } from '../components/ui'
import { downloadBackup } from '../lib/backup'
import { fmt, fmtDate, stockOf, thresholdOf } from '../lib/calc'
import { unitLabel } from '../lib/labels'
import { pullAll } from '../lib/publish'
import { fallbackUse, lowMaterials, unreadReviews } from '../lib/selectors'
import { store, useAppDispatch, useData } from '../store'
import { actions } from '../store/dataSlice'

export default function Home() {
  const d = useData()
  const dispatch = useAppDispatch()
  const [pulling, setPulling] = useState(false)
  const holders = Object.values(d.holders)
  const candles = Object.values(d.candles)
  const hCount = (...st: string[]) => holders.filter((h) => st.includes(h.stage)).length
  const cCount = (...st: string[]) => candles.filter((c) => st.includes(c.stage)).length
  const low = lowMaterials(d)
  const unread = unreadReviews(d)

  const s = d.settings
  const weekAgo = Date.now() - 7 * 86400000
  const needBackup =
    !!s.lastChangeAt &&
    (!s.lastBackupAt || (new Date(s.lastBackupAt).getTime() < weekAgo && s.lastChangeAt > s.lastBackupAt))

  async function pull() {
    setPulling(true)
    try {
      const n = await pullAll(store.getState, dispatch)
      notify(n ? `Новых отзывов: ${n}` : 'Новых отзывов нет')
    } catch (e) {
      notify('Не удалось подтянуть отзывы', 'error', (e as Error).message)
    } finally {
      setPulling(false)
    }
  }

  return (
    <>
      <PageHeader title="Главная">
        <Button asChild>
          <RouterLink to="/mix/new">
            <LuFlaskConical /> Новый замес
          </RouterLink>
        </Button>
        <Button asChild variant="outline">
          <RouterLink to="/pour/new">
            <LuDroplets /> Новая заливка
          </RouterLink>
        </Button>
      </PageHeader>

      {needBackup && (
        <Alert.Root status="warning" mb="4" borderRadius="l3">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Давно не было бэкапа</Alert.Title>
            <Alert.Description>
              {s.lastBackupAt ? `Последний — ${fmtDate(s.lastBackupAt)}.` : 'Бэкап ещё ни разу не делался.'} Данные живут
              только на этом устройстве.
            </Alert.Description>
          </Alert.Content>
          <Button
            size="sm"
            variant="surface"
            colorPalette="orange"
            onClick={async () => {
              await downloadBackup(d)
              dispatch(actions.markBackup(new Date().toISOString()))
            }}
          >
            <LuDownload /> Скачать
          </Button>
        </Alert.Root>
      )}

      <Section title="Подсвечники">
        <SimpleGrid columns={{ base: 2, sm: 3, lg: 6 }} gap="3">
          <Stat label="сохнут" value={hCount('drying')} to="/holders?stage=drying" />
          <Stat label="ждут лака внутри" value={hCount('dried')} to="/holders?stage=dried" />
          <Stat label="ждут росписи" value={hCount('varnishIn')} to="/holders?stage=varnishIn" />
          <Stat label="ждут лака снаружи" value={hCount('painted')} to="/holders?stage=painted" />
          <Stat label="ждут демпферов" value={hCount('varnishOut')} to="/holders?stage=varnishOut" />
          <Stat label="готовы под фитиль" value={hCount('dampers')} to="/holders?stage=dampers" />
        </SimpleGrid>
      </Section>

      <Section title="Свечи">
        <SimpleGrid columns={{ base: 2, sm: 3, lg: 5 }} gap="3">
          <Stat label="с фитилём, ждут заливки" value={cCount('wicked')} to="/candles?stage=wicked" />
          <Stat label="дозревают" value={cCount('curing', 'decorated')} to="/candles?stage=curing" />
          <Stat label="готовы" value={cCount('ready')} to="/candles?stage=ready" />
          <Stat label="подарены / сожжены" value={cCount('given')} to="/candles?stage=given" />
          <Stat label="брак (свечи и подсвечники)" value={cCount('defect') + hCount('defect')} to="/candles?stage=defect" />
        </SimpleGrid>
      </Section>

      <SimpleGrid columns={{ base: 1, lg: 2 }} gap="4">
        <Section title={`Материалы на исходе${low.length ? ` · ${low.length}` : ''}`}>
          {low.length ? (
            <Stack gap="2">
              {low.map((m) => (
                <Flex key={m.id} justify="space-between" gap="2">
                  <Link to={`/stock/${m.id}`}>{m.name}</Link>
                  <Text color={stockOf(m) < 0 ? 'red.400' : 'orange.300'} fontSize="sm" whiteSpace="nowrap">
                    {fmt(stockOf(m))} из {fmt(thresholdOf(m, fallbackUse(d, m)))} {unitLabel[m.unit]}
                  </Text>
                </Flex>
              ))}
            </Stack>
          ) : (
            <Text color="fg.muted" fontSize="sm">
              Всего хватает.
            </Text>
          )}
        </Section>

        <Section
          title={`Непрочитанные отзывы${unread.length ? ` · ${unread.length}` : ''}`}
          actions={
            <Button size="xs" variant="outline" onClick={pull} loading={pulling}>
              <LuRefreshCw /> Подтянуть
            </Button>
          }
        >
          {unread.length ? (
            <Stack gap="2">
              {unread.slice(0, 8).map((r) => (
                <HStack key={r.id} justify="space-between">
                  <HStack>
                    <IdBadge id={r.candleId} to={d.candles[r.candleId] ? `/candles/${r.candleId}` : '/reviews?f=orphan'} />
                    <Text fontSize="sm" color="fg.muted">
                      {r.name || 'без имени'}
                    </Text>
                  </HStack>
                  <Text fontSize="sm">{r.overall != null ? `${r.overall}/10` : '—'}</Text>
                </HStack>
              ))}
              <Box>
                <Link to="/reviews?f=unread">Все отзывы →</Link>
              </Box>
            </Stack>
          ) : (
            <Text color="fg.muted" fontSize="sm">
              Нет непрочитанных.{' '}
              {s.lastPullAt && `Последнее подтягивание: ${fmtDate(s.lastPullAt)}.`}
            </Text>
          )}
        </Section>
      </SimpleGrid>
    </>
  )
}
