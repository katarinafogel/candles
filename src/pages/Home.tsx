import { Box, Button, Flex, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuDroplets, LuFlaskConical, LuRefreshCw } from 'react-icons/lu'
import { Link as RouterLink } from 'react-router-dom'
import { IdBadge, Link, notify, PageHeader, Section, Stat } from '../components/ui'
import { fmt, stockOf, thresholdOf } from '../lib/calc'
import { unitLabel } from '../lib/labels'
import { load } from '../lib/sync'
import { fallbackUse, lowMaterials, unreadReviews } from '../lib/selectors'
import { store, useData } from '../store'

export default function Home() {
  const d = useData()
  const [pulling, setPulling] = useState(false)
  const holders = Object.values(d.holders)
  const candles = Object.values(d.candles)
  const hCount = (...st: string[]) => holders.filter((h) => st.includes(h.stage)).length
  const cCount = (...st: string[]) => candles.filter((c) => st.includes(c.stage)).length
  const low = lowMaterials(d)
  const unread = unreadReviews(d)

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
      <PageHeader title="Главная">
        <Button asChild>
          <RouterLink to="/mix/new">
            <LuFlaskConical /> Создать подсвечники
          </RouterLink>
        </Button>
        <Button asChild variant="outline">
          <RouterLink to="/pour/new">
            <LuDroplets /> Создать свечи
          </RouterLink>
        </Button>
      </PageHeader>


      <Section title="Подсвечники">
        <SimpleGrid columns={{ base: 2, sm: 3, lg: 7 }} gap="3">
          <Stat label="сохнут" value={hCount('drying')} to="/holders?stage=drying" />
          <Stat label="ждут лака внутри" value={hCount('dried')} to="/holders?stage=dried" />
          <Stat label="ждут росписи" value={hCount('varnishIn')} to="/holders?stage=varnishIn" />
          <Stat label="ждут лака снаружи" value={hCount('painted')} to="/holders?stage=painted" />
          <Stat label="ждут демпферов" value={hCount('varnishOut')} to="/holders?stage=varnishOut" />
          <Stat label="готовы под фитиль" value={hCount('dampers')} to="/holders?stage=dampers" />
          <Stat label="с фитилём, ждут заливки" value={hCount('wicked')} to="/holders?stage=wicked" />
        </SimpleGrid>
      </Section>

      <Section title="Свечи">
        <SimpleGrid columns={{ base: 2, sm: 3, lg: 5 }} gap="3">
          <Stat label="формовые, ждут заливки" value={candles.filter((c) => !c.holderId && c.stage === 'wicked').length} to="/candles?stage=wicked" />
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
                  <Text color={stockOf(m) <= 0 ? 'red.400' : 'orange.300'} fontSize="sm" whiteSpace="nowrap">
                    {stockOf(m) <= 0
                      ? 'закончилось'
                      : `${fmt(stockOf(m))} из ${fmt(thresholdOf(m, fallbackUse(d, m)))} ${unitLabel[m.unit]}`}
                  </Text>
                </Flex>
              ))}
            </Stack>
          ) : (
            <Text color="fg.muted" fontSize="sm">
              Из того, что отмечено «купить», всего хватает.
            </Text>
          )}
        </Section>

        <Section
          title={`Непрочитанные отзывы${unread.length ? ` · ${unread.length}` : ''}`}
          actions={
            <Button size="xs" variant="outline" onClick={pull} loading={pulling}>
              <LuRefreshCw /> Обновить
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
              Нет непрочитанных.
            </Text>
          )}
        </Section>
      </SimpleGrid>
    </>
  )
}
