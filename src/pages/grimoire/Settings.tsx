// «Настройки»: «уйти в навь» and the grimoire's settings. The sections themselves are in the menu (sections.tsx).
import { Box, Button, Flex, HStack, IconButton, Stack, Text } from '@chakra-ui/react'
import { LuTrash2 } from 'react-icons/lu'
import { AgentKeys } from '../../components/grimoire/AgentKeys'
import { PushSettings } from '../../components/grimoire/PushSettings'
import { SignOutRow } from '../../components/SignOut'
import { InvitesAdmin } from '../../components/Invites'
import { RolesAdmin } from '../../components/RolesAdmin'
import { LinkPeopleSetting } from '../../components/LinkPeopleSetting'
import { ErrorLogView } from '../../components/ErrorLogView'
import { Check, Chips, confirmAction, DateInput, Field, NumInput, PageHeader, Section, TextInput } from '@shared/components/ui'
import { useToday } from '../../grimoire/act'
import { humanDay } from '@grimoire-core/grimoire/days'
import { isOwnColor, tagCounts, tagPalette, tagPalettes, tagsByUse } from '@grimoire-core/grimoire/tags'
import { ColorDot } from '@shared/components/ColorDot'
import { Tag } from '../../components/grimoire/Marks'
import { isTouchDevice, saveFile } from '@shared/lib/download'
import { actionLabel, bodyLabel, factorLabel } from '@grimoire-core/grimoire/emotions'
import { mirrorCsv } from '@grimoire-core/grimoire/mirrorStats'
import { store, useAppDispatch, useAppSelector, useIsAdmin } from '../../store'
import { grimoireActions as A } from '@grimoire-core/store/grimoireSlice'

/**
 * Every tag with its colour and its trash can. A colour: one of the theme's swatches, or her own from
 * the last circle (any colour; it does not follow the theme). Deleting takes the tag off everything.
 */
function TagSettings() {
  const dispatch = useAppDispatch()
  const g = useAppSelector((s) => s.grimoire)
  const colors = g.meta.tagColors
  const counts = tagCounts(g)
  const tags = tagsByUse(g)
  if (!tags.length) return null
  const remove = async (t: string) => {
    const n = counts.get(t) ?? 0
    if (await confirmAction(`Тег #${t} снимется со всего, где он есть (${n}). Сами дела, хотелки и записи останутся.`, { label: 'Удалить тег', danger: true })) dispatch(A.removeTag(t))
  }
  return (
    <Field label="Теги" helper="цвет: кружок из темы или свой (последний); корзинка снимает тег со всего">
      <Stack gap="2">
        {tags.map((t) => {
          const own = colors[t]
          const on = isOwnColor(own) ? undefined : tagPalette(t, colors)
          return (
            <Flex key={t} align="center" gap="3" wrap="wrap">
              <HStack minW="140px" gap="1.5">
                <Tag name={t} />
                <Text fontSize="xs" color="fg.subtle">
                  {counts.get(t)}
                </Text>
              </HStack>
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
                    bg={`var(--g-tag-${p})`}
                    borderWidth="2px"
                    borderColor={p === on ? 'fg' : 'transparent'}
                    cursor="pointer"
                  />
                ))}
                <ColorDot value={isOwnColor(own) ? own : undefined} onChange={(c) => dispatch(A.updateMeta({ tagColors: { ...colors, [t]: c } }))} />
              </HStack>
              <IconButton size="2xs" variant="ghost" aria-label={`Удалить тег ${t}`} onClick={() => remove(t)}>
                <LuTrash2 />
              </IconButton>
            </Flex>
          )
        })}
      </Stack>
    </Field>
  )
}

export default function GrimoireSettings() {
  const dispatch = useAppDispatch()
  const isAdmin = useIsAdmin()
  const g = useAppSelector((s) => s.grimoire)
  const today = useToday()
  const meta = g.meta

  return (
    <>
      <PageHeader title="Настройки" />
      <Section title="Навь">
        <Text fontSize="sm" color="fg.muted" mb="3">
          Если ты в нави, делать что-то в яви нельзя. Серии замораживаются, привычки молчат, план пуст. Реальные сроки никуда не деваются, копилки на месте. Без вопросов и причин.
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


      <Section title="Уведомления">
        <PushSettings />
      </Section>
      <Section title="Доступ для агента">
        <AgentKeys />
      </Section>

      <Section title="Настройки гримуара">
        <Stack gap="5">
          <LinkPeopleSetting />
          <Field label="Граница дня" helper={`«сегодня» длится до ${meta.dayBoundaryHour}:00 следующего утра`}>
            <NumInput value={meta.dayBoundaryHour} onChange={(v) => dispatch(A.updateMeta({ dayBoundaryHour: Math.max(0, Math.min(12, Math.round(v ?? 0))) }))} suffix="ч" width="140px" />
          </Field>
          <Field label="Полушарие" helper="в южном колесо сдвигается на полгода">
            <Chips value={meta.hemisphere} onChange={(v) => v && dispatch(A.updateMeta({ hemisphere: v as 'north' | 'south' }))} options={[
              { value: 'north', label: 'северное' },
              { value: 'south', label: 'южное' },
            ]} />
          </Field>
          <Field label="Лимит плана на день" helper="сколько дел в плане, прежде чем гримуар спросит, что сдвинуть; 0 — без лимита (остаётся лимит звёзд)">
            <NumInput value={meta.planMax} onChange={(v) => dispatch(A.updateMeta({ planMax: Math.max(0, Math.round(v ?? 0)) }))} suffix="дел" width="140px" />
          </Field>
          <Field label="Похвала" helper="что пишет гримуар, когда дело сделано">
            <Chips value={meta.tone.praise} onChange={(v) => v && dispatch(A.updateMeta({ tone: { ...meta.tone, praise: v as typeof meta.tone.praise } }))} options={[
              { value: 'quiet', label: 'тихо' },
              { value: 'normal', label: 'обычно' },
              { value: 'warm', label: 'тепло' },
            ]} />
          </Field>
          <Field label="Вибрация" helper="телефон отзывается на сделанное дело, на жабу — дважды">
            <Chips value={meta.tone.motion === 'off' ? 'off' : 'soft'} onChange={(v) => v && dispatch(A.updateMeta({ tone: { ...meta.tone, motion: v as typeof meta.tone.motion } }))} options={[
              { value: 'off', label: 'нет' },
              { value: 'soft', label: 'да' },
            ]} />
          </Field>
          <Field label="Звёзд на день" helper="сколько сложности план дня держит спокойно; сверх — красные звёзды в свитке; 0 — не показывать">
            <NumInput value={meta.dayStars} onChange={(v) => dispatch(A.updateMeta({ dayStars: Math.max(0, Math.round(v ?? 0)) }))} suffix="★" width="140px" />
          </Field>
          <Field label="Жабы" helper="дело с нехотением 3 или отложенное столько раз становится жабой">
            <NumInput value={meta.frogPostpones} onChange={(v) => dispatch(A.updateMeta({ frogPostpones: Math.max(1, Math.round(v ?? 3)) }))} suffix="переносов" width="170px" />
          </Field>
          <Field label="Чувство у дела" helper="«С каким чувством берёшься?» при «Начать понемногу» и «Как теперь?» после «Сделала»">
            <Chips value={meta.emotionAsk ?? 'hard'} onChange={(v) => v && dispatch(A.updateMeta({ emotionAsk: v as typeof meta.emotionAsk }))} options={[
              { value: 'off', label: 'не спрашивать' },
              { value: 'hard', label: 'жабы и чудовища' },
              { value: 'all', label: 'все дела' },
            ]} />
          </Field>
          <Field label="Вечерняя страница" helper="с этого времени до конца дня свиток зовёт её записать; пусто — не звать">
            <DateInput kind="time" w="120px" value={meta.eveningAt ?? '21:00'} onChange={(eveningAt) => dispatch(A.updateMeta({ eveningAt }))} />
          </Field>
          <Field label="Пол">
            <Chips value={meta.gender} onChange={(v) => dispatch(A.updateMeta(v === 'f' ? { gender: 'f' } : { gender: v as 'm' | undefined, cycleOn: false }))} options={[
              { value: 'f', label: 'женский' },
              { value: 'm', label: 'мужской' },
            ]} />
          </Field>
          {meta.gender === 'f' && (
            <Check checked={!!meta.cycleOn} onChange={(v) => dispatch(A.updateMeta({ cycleOn: v }))}>
              Цикл
            </Check>
          )}
          {meta.gender === 'f' && meta.cycleOn && (
            <Check checked={meta.cycleToAgent ?? true} onChange={(v) => dispatch(A.updateMeta({ cycleToAgent: v }))}>
              Цикл: показывать ассистенту (фаза в утреннем плане)
            </Check>
          )}
          <Check checked={meta.streaksOn} onChange={(v) => dispatch(A.updateMeta({ streaksOn: v }))}>
            Серии привычек
          </Check>
          <Check checked={meta.gameWords} onChange={(v) => dispatch(A.updateMeta({ gameWords: v }))}>
            Игровые названия (свиток, квест, ритуал)
          </Check>
          <Field label="Круги бестиария" helper="через запятую">
            <TextInput value={(meta.circles ?? []).join(', ')} onChange={(v) => dispatch(A.updateMeta({ circles: v.split(',').map((x) => x.trim()).filter(Boolean) }))} />
          </Field>
          <TagSettings />
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
              const csv = mirrorCsv(store.getState().grimoire, store.getState().grimoire.beings, { factor: factorLabel, body: bodyLabel, action: actionLabel })
              await saveFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `mirror-${today}.csv`, isTouchDevice())
            }}
          >
            Выгрузить зеркало (CSV)
          </Button>
          <Button
            size="xs"
            variant="ghost"
            alignSelf="flex-start"
            onClick={async () => {
              if (await confirmAction('Вернуть стартовый набор практик колеса года? Скрытые останутся скрытыми, свои не пропадут.')) {
                dispatch(A.updateMeta({ practicesSeeded: false }))
              }
            }}
          >
            Вернуть стартовые практики
          </Button>
        </Stack>
      </Section>
      <Section title="Последние ошибки">
        <ErrorLogView />
      </Section>
      <Stack gap="0" borderWidth="1px" borderColor="border" borderRadius="l3" bg="bg.subtle" overflow="hidden" mb="4">
        <SignOutRow />
      </Stack>
      {isAdmin && (
        <Section title="Ведьмы и приглашения">
          <RolesAdmin roles={['witch', 'admin']} />
          <InvitesAdmin role="witch" />
        </Section>
      )}
    </>
  )
}
