// «Ещё»: the coin journal (the balance is its sum), «уйти в навь», and the grimoire's settings.
import { Box, Button, Flex, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { Check, Chips, confirmAction, Field, NumInput, PageHeader, Section, Stat, TextInput } from '../../components/ui'
import { useBalance, useToday } from '../../grimoire/act'
import { dayCoins } from '../../grimoire/coins'
import { addDays, humanDay } from '../../grimoire/days'
import { words } from '../../grimoire/selectors'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'

export default function GrimoireMore() {
  const dispatch = useAppDispatch()
  const g = useAppSelector((s) => s.grimoire)
  const today = useToday()
  const coins = useBalance()
  const meta = g.meta
  const w = words(meta)
  const [limit, setLimit] = useState(50)
  const txs = Object.values(g.coinTxs).sort((a, b) => b.at.localeCompare(a.at))
  let week = 0
  for (let i = 0; i < 7; i++) week += dayCoins(g.coinTxs, addDays(today, -i))
  const [manual, setManual] = useState<{ amount?: number; reason: string }>({ reason: '' })

  return (
    <>
      <PageHeader title="Ещё" />

      <Section title="Навь">
        <Text fontSize="sm" color="fg.muted" mb="3">
          Если ты в нави, делать что-то в яви нельзя. Серии и бонусы замораживаются, привычки молчат, план пуст. Реальные сроки никуда не деваются, монеты и копилки на месте. Без вопросов и причин.
        </Text>
        <Button variant={meta.nav.active ? 'solid' : 'outline'} onClick={() => dispatch(A.setNav({ active: !meta.nav.active }))}>
          {meta.nav.active ? 'Вернуться в явь' : 'Уйти в навь'}
        </Button>
        {meta.nav.history.length > 0 && (
          <Text fontSize="xs" color="fg.subtle" mt="2">
            Была в нави: {meta.nav.history.slice(-5).map((p) => `${humanDay(p.from.slice(0, 10), today)} — ${p.to ? humanDay(p.to.slice(0, 10), today) : '…'}`).join(' · ')}
          </Text>
        )}
      </Section>

      <Section title={w.treasury}>
        <SimpleGrid columns={{ base: 2, md: 3 }} gap="3" mb="4">
          <Stat label="монет всего" value={coins} />
          <Stat label="за неделю" value={week} />
          <Stat label="сегодня" value={dayCoins(g.coinTxs, today)} />
        </SimpleGrid>
        <Text fontSize="xs" color="fg.subtle" mb="3">
          Тратить монеты пока негде: лавка наград появится, когда придумаешь, на что. Сейчас можно купить оберег для ритуала.
        </Text>
        <HStack gap="2" mb="4" align="flex-end" wrap="wrap">
          <Field label="Вручную" w="120px">
            <NumInput value={manual.amount} onChange={(v) => setManual({ ...manual, amount: v })} placeholder="±" />
          </Field>
          <Field label="За что" flex="1" minW="160px">
            <TextInput value={manual.reason} onChange={(v) => setManual({ ...manual, reason: v })} placeholder="потратила на серию сериала" />
          </Field>
          <Button
            disabled={!manual.amount || !manual.reason.trim()}
            onClick={() => {
              dispatch(A.addCoins({ amount: manual.amount!, reason: manual.reason.trim() }))
              setManual({ reason: '' })
            }}
          >
            Записать
          </Button>
        </HStack>
        <Stack gap="0">
          {txs.slice(0, limit).map((x) => (
            <Flex key={x.id} justify="space-between" gap="3" py="1.5" borderBottomWidth="1px" borderColor="border.muted" fontSize="sm">
              <Box minW="0">
                <Text lineClamp={1}>{x.reason}</Text>
                <Text fontSize="xs" color="fg.subtle">
                  {humanDay(x.day, today)}
                </Text>
              </Box>
              <Text color={x.amount > 0 ? 'ember.200' : 'fg.muted'} whiteSpace="nowrap">
                {x.amount > 0 ? '+' : ''}
                {x.amount}
              </Text>
            </Flex>
          ))}
        </Stack>
        {txs.length > limit && (
          <Button size="xs" variant="ghost" mt="2" onClick={() => setLimit(limit + 100)}>
            Показать ещё
          </Button>
        )}
      </Section>

      <Section title="Настройки гримуара">
        <Stack gap="5">
          <Field label="Граница дня" helper={`«сегодня» длится до ${meta.dayBoundaryHour}:00 следующего утра`}>
            <NumInput value={meta.dayBoundaryHour} onChange={(v) => dispatch(A.updateMeta({ dayBoundaryHour: Math.max(0, Math.min(12, Math.round(v ?? 0))) }))} suffix="ч" width="140px" />
          </Field>
          <Field label="Полушарие" helper="в южном колесо сдвигается на полгода">
            <Chips value={meta.hemisphere} onChange={(v) => v && dispatch(A.updateMeta({ hemisphere: v as 'north' | 'south' }))} options={[
              { value: 'north', label: 'северное' },
              { value: 'south', label: 'южное' },
            ]} />
          </Field>
          <Field label="Лимит плана на день" helper="при превышении — мягкое предупреждение, не запрет; 0 — без лимита">
            <HStack gap="3" wrap="wrap">
              <NumInput value={meta.planLimit.main} onChange={(v) => dispatch(A.updateMeta({ planLimit: { ...meta.planLimit, main: Math.max(0, Math.round(v ?? 0)) } }))} suffix="главное" width="160px" />
              <NumInput value={meta.planLimit.extra} onChange={(v) => dispatch(A.updateMeta({ planLimit: { ...meta.planLimit, extra: Math.max(0, Math.round(v ?? 0)) } }))} suffix="доп." width="140px" />
              <NumInput value={meta.planLimit.optional} onChange={(v) => dispatch(A.updateMeta({ planLimit: { ...meta.planLimit, optional: Math.max(0, Math.round(v ?? 0)) } }))} suffix="необяз." width="160px" />
            </HStack>
          </Field>
          <Check checked={meta.streaksOn} onChange={(v) => dispatch(A.updateMeta({ streaksOn: v }))}>
            Серии и бонусы за них
          </Check>
          <Check checked={meta.gameWords} onChange={(v) => dispatch(A.updateMeta({ gameWords: v }))}>
            Игровые названия (свиток, квест, ритуал)
          </Check>
          <Field label="Зоны дома" helper="через запятую">
            <TextInput value={meta.zones.join(', ')} onChange={(v) => dispatch(A.updateMeta({ zones: v.split(',').map((x) => x.trim()).filter(Boolean) }))} />
          </Field>
          <Box>
            <Text fontSize="sm" color="fg.muted" mb="2">
              Формула: монеты = {meta.coins.base} · сложность · (1 + {meta.coins.dreadFactor} · нехотение) + бонусы
            </Text>
            <SimpleGrid columns={{ base: 2, md: 3 }} gap="3">
              <Field label="База">
                <NumInput value={meta.coins.base} onChange={(v) => dispatch(A.updateMeta({ coins: { ...meta.coins, base: v ?? 10 } }))} />
              </Field>
              <Field label="Вес нехотения">
                <NumInput value={meta.coins.dreadFactor} onChange={(v) => dispatch(A.updateMeta({ coins: { ...meta.coins, dreadFactor: v ?? 0.5 } }))} />
              </Field>
              <Field label="В срок">
                <NumInput value={meta.coins.onTimeBonus} onChange={(v) => dispatch(A.updateMeta({ coins: { ...meta.coins, onTimeBonus: v ?? 0 } }))} />
              </Field>
              <Field label="Квест целиком">
                <NumInput value={meta.coins.complexBonus} onChange={(v) => dispatch(A.updateMeta({ coins: { ...meta.coins, complexBonus: v ?? 0 } }))} />
              </Field>
              <Field label="Начать понемногу">
                <NumInput value={meta.coins.startedCoins} onChange={(v) => dispatch(A.updateMeta({ coins: { ...meta.coins, startedCoins: v ?? 0 } }))} />
              </Field>
              <Field label="Мечта сбылась">
                <NumInput value={meta.coins.wishBonus} onChange={(v) => dispatch(A.updateMeta({ coins: { ...meta.coins, wishBonus: v ?? 0 } }))} />
              </Field>
            </SimpleGrid>
          </Box>
          <Button
            size="xs"
            variant="ghost"
            alignSelf="flex-start"
            onClick={() => {
              if (confirmAction('Вернуть стартовый набор практик колеса года? Скрытые останутся скрытыми, свои не пропадут.')) {
                dispatch(A.updateMeta({ practicesSeeded: false }))
              }
            }}
          >
            Вернуть стартовые практики
          </Button>
        </Stack>
      </Section>
    </>
  )
}
