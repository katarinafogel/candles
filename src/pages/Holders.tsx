import { Box, Button, Flex, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuArrowRight, LuFlaskConical, LuTriangleAlert } from 'react-icons/lu'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import { DefectDialog, HolderStepDialog } from '../components/StepDialogs'
import { Check, Empty, IdBadge, PageHeader, Select } from '../components/ui'
import { daysBetween, fmtDate } from '../lib/calc'
import { holderNextTitle, holderStageLabel, moldPurposeLabel, holderStageOrder, holderStageShort } from '../lib/labels'
import { byId } from '../lib/selectors'
import { useData } from '../store'
import { nextHolderStage } from '../store/dataSlice'
import type { HolderStage } from '../types'

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
    (h) => (stage ? h.stage === stage : h.stage !== 'wicked' && h.stage !== 'defect' && h.stage !== 'done') && (!moldId || h.moldId === moldId),
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

      <Stack gap="2">
        {list.map((h) => {
          const mold = d.molds[h.moldId]
          const on = sel.includes(h.id)
          const drying = h.stage === 'drying' ? daysBetween(h.dryStart, new Date().toISOString()) : undefined
          return (
            <Flex
              key={h.id}
              align="center"
              gap="3"
              p="3"
              borderWidth="1px"
              borderColor={on ? 'emerald.600' : 'border'}
              bg={on ? 'emerald.subtle' : 'bg.subtle'}
              borderRadius="l3"
            >
              <Check checked={on} onChange={(v) => setSel(v ? [...sel, h.id] : sel.filter((x) => x !== h.id))} />
              <Box flex="1" minW="0" cursor="pointer" onClick={() => nav(`/holders/${h.id}`, { state: { back: `/holders${sp.size ? `?${sp}` : ''}` } })}>
                <HStack gap="2" wrap="wrap">
                  <IdBadge id={h.id} />
                  <Text fontWeight="medium" truncate>
                    {mold?.name ?? '—'}
                  </Text>
                  {h.purpose !== 'holder' && (
                    <Text fontSize="xs" color="fg.muted">
                      {moldPurposeLabel[h.purpose]}
                    </Text>
                  )}
                </HStack>
                <Text fontSize="xs" color={h.stage === 'defect' ? 'red.400' : 'fg.muted'} mt="1">
                  {holderStageLabel[h.stage]}
                  {drying != null && ` · ${Math.floor(drying)} дн.`} · замес {h.mixId} от {fmtDate(h.dryStart)}
                </Text>
              </Box>
              {nextHolderStage(h) && (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    setSel([h.id])
                    setDialog('next')
                  }}
                >
                  {holderNextTitle(h) ?? 'Готово'} <LuArrowRight />
                </Button>
              )}
            </Flex>
          )
        })}
      </Stack>

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
            <Button onClick={() => setDialog('next')} disabled={!canNext}>
              {canNext ? holderNextTitle(d.holders[selected[0]]) ?? 'Дальше' : 'Разные этапы'} · {selected.length}
            </Button>
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
