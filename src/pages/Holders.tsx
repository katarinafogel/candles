import { Box, Button, Flex, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuArrowRight, LuDroplets, LuFlaskConical, LuTriangleAlert } from 'react-icons/lu'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import { DefectDialog, HolderStepDialog } from '../components/StepDialogs'
import { ArcanaCard, arcanaButton } from '../components/ArcanaCard'
import { Check, Empty, LeafMark, PageHeader, Select } from '../components/ui'
import { daysBetween, fmtDate } from '../lib/calc'
import { holderNextTitle, holderStageLabel, moldPurposeLabel, holderStageOrder, holderStageShort } from '../lib/labels'
import { byId } from '../lib/selectors'
import { useAppDispatch, useData } from '../store'
import { actions, nextHolderStage, varnishTarget } from '../store/dataSlice'
import type { Holder, HolderStage } from '../types'
import { withUndo } from '../lib/undo'
import { figureOf } from '../components/MoldIcons'

/** One leaf per varnish layer; ticking the last one moves the item to the next stage. */
function VarnishLeaves({ h }: { h: Holder }) {
  const d = useData()
  const dispatch = useAppDispatch()
  const step = nextHolderStage(h)
  if (step !== 'varnishIn' && step !== 'varnishOut') return null
  const target = varnishTarget(d, step)
  const done = h.layersDone ?? 0
  const set = (n: number) => {
    const change = () => dispatch(actions.setVarnishLayers({ id: h.id, done: n, date: new Date().toISOString() }))
    if (n >= target) withUndo('holder', [h.id], change, `${step === 'varnishIn' ? 'Лак внутри' : 'Лак снаружи'}: все ${target} слоёв`)
    else change()
  }
  return (
    <Stack gap="0.5" align="center" w="100%">
      <Text fontSize="2xs" color="fg.muted">
        {step === 'varnishIn' ? 'слои лака внутри' : 'слои лака снаружи'} · {done}/{target}
      </Text>
      <Flex gap="0" justify="center" wrap="wrap">
        {Array.from({ length: target }, (_, i) => (
          <Box
            as="button"
            key={i}
            p="0.5"
            cursor="pointer"
            aria-label={`Слой ${i + 1}`}
            // A tap on the last ticked leaf takes that layer back.
            onClick={() => set(i + 1 === done ? i : i + 1)}
          >
            <LeafMark on={i < done} size={18} />
          </Box>
        ))}
      </Flex>
    </Stack>
  )
}

export default function Holders() {
  const d = useData()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const stage = (sp.get('stage') ?? '') as HolderStage | ''
  const moldId = sp.get('mold') ?? ''
  const [sel, setSel] = useState<string[]>([])
  const [dialog, setDialog] = useState<'next' | 'defect' | null>(null)

  const all = byId(d.holders)
  const list = all.filter(
    (h) => (stage ? h.stage === stage : h.stage !== 'candle' && h.stage !== 'defect' && h.stage !== 'done') && (!moldId || h.moldId === moldId),
  )
  const setFilter = (k: string, v: string) => {
    const n = new URLSearchParams(sp)
    if (v) n.set(k, v)
    else n.delete(k)
    setSp(n, { replace: true })
    setSel([])
  }
  const counts = Object.fromEntries(holderStageOrder.map((s) => [s, all.filter((h) => h.stage === s).length]))
  const selected = sel.filter((i) => list.some((h) => h.id === i))
  const selStage = selected.length ? nextHolderStage(d.holders[selected[0]]) : undefined
  const sameStage = selected.every((i) => d.holders[i].stage === d.holders[selected[0]]?.stage)
  const canNext = selected.length > 0 && sameStage && !!selStage
  const allWicked = selected.length > 0 && selected.every((i) => d.holders[i].stage === 'wicked' && d.holders[i].candleId)
  const pour = (ids: string[]) => nav(`/pour/new?ids=${ids.map((i) => d.holders[i].candleId).join(',')}`)

  return (
    <>
      <PageHeader title="Подсвечники">
        <Button asChild size="sm">
          <RouterLink to="/mix/new">
            <LuFlaskConical /> Создать подсвечники
          </RouterLink>
        </Button>
      </PageHeader>

      <Flex gap="2" mb="3" overflowX="auto" pb="1">
        <Button size="xs" borderRadius="full" variant={!stage ? 'solid' : 'outline'} onClick={() => setFilter('stage', '')}>
          В работе
        </Button>
        {holderStageOrder.map((s) => (
          <Button
            key={s}
            size="xs"
            borderRadius="full"
            flexShrink={0}
            variant={stage === s ? 'solid' : 'outline'}
            onClick={() => setFilter('stage', s)}
          >
            {holderStageShort[s]} · {counts[s]}
          </Button>
        ))}
      </Flex>
      <Box mb="4" maxW="sm">
        <Select
          size="sm"
          value={moldId}
          onChange={(v) => setFilter('mold', v)}
          placeholder="Все формы"
          options={Object.values(d.molds).map((m) => ({ value: m.id, label: m.name }))}
        />
      </Box>

      {list.length > 0 && (
        <HStack mb="2" justify="space-between">
          <Check checked={selected.length === list.length} onChange={(v) => setSel(v ? list.map((h) => h.id) : [])}>
            <Text fontSize="sm">Выбрать все ({list.length})</Text>
          </Check>
        </HStack>
      )}

      {!list.length && <Empty>Здесь пока пусто.</Empty>}

      <SimpleGrid columns={{ base: 2, sm: 3, lg: 4, xl: 5 }} gap={{ base: '3', md: '4' }} gridAutoRows="1fr">
        {list.map((h) => {
          const mold = d.molds[h.moldId]
          const on = sel.includes(h.id)
          const drying = h.stage === 'drying' ? daysBetween(h.dryStart, new Date().toISOString()) : undefined
          return (
            <ArcanaCard
              key={h.id}
              tone="pearl"
              figure={figureOf(mold)}
              title={mold?.name ?? '—'}
              sub={h.id}
              selected={on}
              dim={h.stage === 'defect'}
              corner={h.purpose !== 'holder' ? moldPurposeLabel[h.purpose] : undefined}
              select={<Check checked={on} onChange={(v) => setSel(v ? [...sel, h.id] : sel.filter((x) => x !== h.id))} />}
              onClick={() => nav(`/holders/${h.id}`, { state: { back: `/holders${sp.size ? `?${sp}` : ''}` } })}
              footer={
                h.stage === 'wicked' && h.candleId ? (
                  <Button {...arcanaButton} onClick={() => pour([h.id])}>
                    <LuDroplets /> Залить
                  </Button>
                ) : (
                  nextHolderStage(h) && (
                    <>
                      <VarnishLeaves h={h} />
                      <Button
                        {...arcanaButton}
                        onClick={() => {
                          setSel([h.id])
                          setDialog('next')
                        }}
                      >
                        {holderNextTitle(h) ?? 'Готово'} <LuArrowRight />
                      </Button>
                    </>
                  )
                )
              }
            >
              <Text color={h.stage === 'defect' ? 'red.600' : 'fg'} fontWeight="medium">
                {holderStageLabel[h.stage]}
                {drying != null && ` · ${Math.max(0, Math.floor(drying))} дн.`}
              </Text>
              <Text>
                замес {h.mixId} · {fmtDate(h.dryStart)}
              </Text>
            </ArcanaCard>
          )
        })}
      </SimpleGrid>
      {/* Room for the action bar so it does not cover the last cards. */}
      {selected.length > 0 && <Box h="140px" />}

      {selected.length > 0 && (
        <Box
          position="fixed"
          bottom={{ base: '72px', md: '6' }}
          left={{ base: '4', md: 'calc(240px + 2rem)' }}
          right="4"
          zIndex="docked"
        >
          <SimpleGrid
            columns={2}
            gap="2"
            p="2"
            bg="bg.panel"
            borderWidth="1px"
            borderColor="emerald.700"
            borderRadius="l3"
            shadow="lg"
            maxW="560px"
            mx="auto"
          >
            {allWicked ? (
              <Button onClick={() => pour(selected)}>
                <LuDroplets /> Залить · {selected.length}
              </Button>
            ) : (
              <Button onClick={() => setDialog('next')} disabled={!canNext}>
                {canNext ? holderNextTitle(d.holders[selected[0]]) ?? 'Дальше' : 'Разные этапы'} · {selected.length}
              </Button>
            )}
            <Button variant="outline" colorPalette="red" onClick={() => setDialog('defect')}>
              <LuTriangleAlert /> Брак
            </Button>
          </SimpleGrid>
        </Box>
      )}

      {dialog === 'next' && (
        <HolderStepDialog
          ids={selected.length ? selected : sel}
          onClose={() => {
            setDialog(null)
            setSel([])
          }}
        />
      )}
      {dialog === 'defect' && (
        <DefectDialog
          kind="holder"
          ids={selected}
          onClose={() => {
            setDialog(null)
            setSel([])
          }}
        />
      )}
    </>
  )
}
