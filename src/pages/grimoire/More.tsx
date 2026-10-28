// «Ещё»: the coin journal (the balance is its sum), «уйти в навь», and the grimoire's settings.
import { Box, Button, Flex, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { LuChevronRight } from 'react-icons/lu'
import { Link as RouterLink } from 'react-router-dom'
import { useState } from 'react'
import { AgentKeys } from '../../components/grimoire/AgentKeys'
import { Check, Chips, confirmAction, Field, NumInput, PageHeader, Section, Stat, TextInput } from '../../components/ui'
import { useBalance, useToday } from '../../grimoire/act'
import { dayCoins } from '../../grimoire/coins'
import { addDays, humanDay } from '../../grimoire/days'
import { words } from '../../grimoire/selectors'
import { tagPalette, tagPalettes, tagsByUse } from '../../grimoire/tags'
import { Tag } from '../../components/grimoire/Marks'
import { isTouchDevice, saveFile } from '../../lib/download'
import { actionLabel, bodyLabel, factorLabel } from '../../grimoire/emotions'
import { mirrorCsv } from '../../grimoire/mirrorStats'
import { store, useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'

/** A colour for each tag: the swatches under it; until one is chosen the name picks it. */
function TagColors() {
  const dispatch = useAppDispatch()
  const tasks = useAppSelector((s) => s.grimoire.tasks)
  const colors = useAppSelector((s) => s.grimoire.meta.tagColors)
  const tags = tagsByUse({ tasks })
  if (!tags.length) return null
  return (
    <Field label="Цвета тегов">
      <Stack gap="2">
        {tags.map((t) => {
          const on = tagPalette(t, colors)
          return (
            <Flex key={t} align="center" gap="3" wrap="wrap">
              <Box minW="110px">
                <Tag name={t} />
              </Box>
              <HStack gap="1.5" wrap="wrap">
                {tagPalettes.map((p) => (
                  <Box
                    as="button"
                    key={p}
                    aria-label={p}
                    aria-pressed={p === on}
                    onClick={() => dispatch(A.updateMeta({ tagColors: { ...colors, [t]: p } }))}
                    w="5"
                    h="5"
                    borderRadius="full"
                    bg={`${p}.400`}
                    borderWidth="2px"
                    borderColor={p === on ? 'fg' : 'transparent'}
                    cursor="pointer"
                  />
                ))}
              </HStack>
            </Flex>
          )
        })}
      </Stack>
    </Field>
  )
}

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
      <Stack gap="0" borderWidth="1px" borderColor="border" borderRadius="l3" bg="bg.subtle" overflow="hidden" mb="4">
        {[
          { to: '/g/calendar', label: 'Календарь: луны, саббаты и эсбаты' },
          { to: '/g/projects', label: `${words(meta).projects}: полка проектов` },
          { to: '/g/mirror', label: 'Зеркало: словарь эмоций и записи' },
          { to: '/g/people', label: 'Бестиарий: люди, памятка и даты' },
          { to: '/g/wishes', label: 'Сундук желаний и зал славы' },
          { to: '/apps', label: 'Другие проекты' },
        ].map((i) => (
          <RouterLink key={i.to} to={i.to}>
            <Flex align="center" gap="3" px="4" py="3" borderBottomWidth="1px" borderColor="border.muted" _hover={{ bg: 'bg.muted' }}>
              <Text flex="1">{i.label}</Text>
              <Box color="fg.subtle">
                <LuChevronRight />
              </Box>
            </Flex>
          </RouterLink>
        ))}
      </Stack>

      <Section title="Навь">
        <Text fontSize="sm" color="fg.muted" mb="3">
          Если ты в нави, делать что-то в яви нельзя. Серии и бонусы замораживаются, привычки молчат, план пуст. Реальные сроки никуда не деваются, монеты и копилки на месте. Без вопросов и причин.
        </Text>
        <Button variant={meta.nav.active ? 'solid' : 'outline'} onClick={() => dispatch(A.setNav({ active: !meta.nav.active }))}>
          {meta.nav.active ? 'Вернуться в явь' : 'Уйти в навь'}
        </Button>
        <Field label="Ассистент, пока ты в нави" helper="о делах с пометкой «даже в нави» он напомнит в любом случае">
          <Chips value={meta.nav.agent ?? 'hello'} onChange={(v) => v && dispatch(A.updateMeta({ nav: { ...meta.nav, agent: v as 'hello' | 'silent' } }))} options={[
            { value: 'hello', label: 'пишет «я тут»' },
            { value: 'silent', label: 'молчит' },
          ]} />
        </Field>
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

      <Section title="Доступ для агента">
        <AgentKeys />
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
          <Field label="Лимит плана на день" helper="при превышении гримуар спросит, что сдвинуть; 0 — без лимита">
            <HStack gap="3" wrap="wrap">
              <NumInput value={meta.planLimit.main} onChange={(v) => dispatch(A.updateMeta({ planLimit: { ...meta.planLimit, main: Math.max(0, Math.round(v ?? 0)) } }))} suffix="главное" width="160px" />
              <NumInput value={meta.planLimit.extra} onChange={(v) => dispatch(A.updateMeta({ planLimit: { ...meta.planLimit, extra: Math.max(0, Math.round(v ?? 0)) } }))} suffix="доп." width="140px" />
              <NumInput value={meta.planLimit.optional} onChange={(v) => dispatch(A.updateMeta({ planLimit: { ...meta.planLimit, optional: Math.max(0, Math.round(v ?? 0)) } }))} suffix="необяз." width="160px" />
            </HStack>
          </Field>
          <Field label="Похвала" helper="что пишет гримуар, когда дело сделано">
            <Chips value={meta.tone.praise} onChange={(v) => v && dispatch(A.updateMeta({ tone: { ...meta.tone, praise: v as typeof meta.tone.praise } }))} options={[
              { value: 'quiet', label: 'тихо' },
              { value: 'normal', label: 'обычно' },
              { value: 'warm', label: 'тепло' },
            ]} />
          </Field>
          <Field label="Анимации" helper="искра летит с карточки в монеты; «нет» — и без вибрации">
            <Chips value={meta.tone.motion} onChange={(v) => v && dispatch(A.updateMeta({ tone: { ...meta.tone, motion: v as typeof meta.tone.motion } }))} options={[
              { value: 'off', label: 'нет' },
              { value: 'soft', label: 'мягко' },
              { value: 'bright', label: 'ярко' },
            ]} />
          </Field>
          <Field label="Звёзд на день" helper="сколько сложности план дня держит спокойно; сверх — красные звёзды в свитке; 0 — не показывать">
            <NumInput value={meta.dayStars} onChange={(v) => dispatch(A.updateMeta({ dayStars: Math.max(0, Math.round(v ?? 0)) }))} suffix="★" width="140px" />
          </Field>
          <Field label="Жабы" helper="дело с нехотением 3 или отложенное столько раз становится жабой и платит больше">
            <HStack gap="3" wrap="wrap">
              <NumInput value={meta.frogPostpones} onChange={(v) => dispatch(A.updateMeta({ frogPostpones: Math.max(1, Math.round(v ?? 3)) }))} suffix="переносов" width="170px" />
              <NumInput value={meta.coins.frogFactor} onChange={(v) => dispatch(A.updateMeta({ coins: { ...meta.coins, frogFactor: Math.max(1, v ?? 1.5) } }))} suffix="× награда" width="170px" />
            </HStack>
          </Field>
          <Field label="Чувство у дела" helper="«С каким чувством берёшься?» при «Начать понемногу» и «Как теперь?» после «Сделала»">
            <Chips value={meta.emotionAsk ?? 'hard'} onChange={(v) => v && dispatch(A.updateMeta({ emotionAsk: v as typeof meta.emotionAsk }))} options={[
              { value: 'off', label: 'не спрашивать' },
              { value: 'hard', label: 'жабы и чудовища' },
              { value: 'all', label: 'все дела' },
            ]} />
          </Field>
          <Field label="Вечерняя страница" helper="с этого времени до конца дня свиток зовёт её записать; пусто — не звать">
            <input
              type="time"
              value={meta.eveningAt ?? '21:00'}
              onChange={(e) => dispatch(A.updateMeta({ eveningAt: e.target.value }))}
              style={{ background: 'transparent', color: 'inherit', border: '1px solid var(--chakra-colors-border)', borderRadius: 6, padding: '6px 8px', colorScheme: 'dark', width: 120 }}
            />
          </Field>
          <Check checked={meta.cycleToAgent ?? true} onChange={(v) => dispatch(A.updateMeta({ cycleToAgent: v }))}>
            Цикл: показывать ассистенту (фаза в утреннем плане)
          </Check>
          <Check checked={meta.streaksOn} onChange={(v) => dispatch(A.updateMeta({ streaksOn: v }))}>
            Серии и бонусы за них
          </Check>
          <Check checked={meta.gameWords} onChange={(v) => dispatch(A.updateMeta({ gameWords: v }))}>
            Игровые названия (свиток, квест, ритуал)
          </Check>
          <Field label="Круги бестиария" helper="через запятую">
            <TextInput value={(meta.circles ?? []).join(', ')} onChange={(v) => dispatch(A.updateMeta({ circles: v.split(',').map((x) => x.trim()).filter(Boolean) }))} />
          </Field>
          <Field label="Зоны дома" helper="через запятую">
            <TextInput value={meta.zones.join(', ')} onChange={(v) => dispatch(A.updateMeta({ zones: v.split(',').map((x) => x.trim()).filter(Boolean) }))} />
          </Field>
          <TagColors />
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
            size="sm"
            variant="outline"
            alignSelf="flex-start"
            onClick={async () => {
              // Everything with dates in one JSON: a backup and the file to hand over for analysis.
              const { _persist, ...grimoire } = store.getState().grimoire as typeof g & { _persist?: unknown }
              void _persist
              const file = { app: 'candle-tracker/grimoire', exportedAt: new Date().toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, grimoire }
              await saveFile(new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' }), `grimoire-${today}.json`, isTouchDevice())
            }}
          >
            Выгрузить гримуар (JSON)
          </Button>
          <Button
            size="sm"
            variant="outline"
            alignSelf="flex-start"
            onClick={async () => {
              const csv = mirrorCsv(store.getState().grimoire, store.getState().data.people, { factor: factorLabel, body: bodyLabel, action: actionLabel })
              await saveFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `mirror-${today}.csv`, isTouchDevice())
            }}
          >
            Выгрузить зеркало (CSV)
          </Button>
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
