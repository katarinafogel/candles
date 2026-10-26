import { Box, Button, Flex, HStack, Input, SimpleGrid, Stack, Text, Wrap } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { LuDroplets, LuPlus, LuPrinter, LuSparkles, LuCheck, LuTriangleAlert } from 'react-icons/lu'
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom'
import { DecorateDialog, DefectDialog } from '../components/StepDialogs'
import { ArcanaCard } from '../components/ArcanaCard'
import { Check, Empty, Field, IdBadge, Modal, notify, NumInput, PageHeader, Select, TextInput, Chips } from '../components/ui'
import { fmt } from '../lib/calc'
import { nowLocal, toIso } from '../lib/dates'
import { candleStageLabel, candleStageOrder, wickSchemeLabel } from '../lib/labels'
import { byId, candleRating, materialOptions, moldOfCandle, sootShare, sortMolds } from '../lib/selectors'
import { useAppDispatch, useData } from '../store'
import { actions } from '../store/dataSlice'
import type { CandleStage, WickScheme } from '../types'
import { withUndo } from '../lib/undo'
import { figureOf } from '../components/MoldIcons'

function ReadyDialog({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [date, setDate] = useState(nowLocal())
  return (
    <Modal
      open
      onClose={onClose}
      title={`Готова · ${ids.length} шт.`}
      footer={
        <Button
          onClick={() => {
            const iso = toIso(date)
            withUndo('candle', ids, () => dispatch(actions.advanceCandles({ ids, date: iso, params: { step: 'ready', readyAt: iso } })), 'Свечи готовы')
            onClose()
          }}
        >
          Сохранить
        </Button>
      }
    >
      <Field label="Дата окончания дозревания">
        <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
    </Modal>
  )
}

function MoldedCandleDialog({ onClose }: { onClose: () => void }) {
  const d = useData()
  const dispatch = useAppDispatch()
  const molds = sortMolds(d, Object.values(d.molds).filter((m) => m.purpose === 'candle' && !m.archived))
  const [moldId, setMoldId] = useState(molds[0]?.id ?? '')
  const mold = d.molds[moldId]
  const [name, setName] = useState(mold?.name ?? '')
  const [scheme, setScheme] = useState<WickScheme>(mold?.defaultWick?.scheme ?? 'double05')
  const [length, setLength] = useState<number | undefined>(mold?.defaultWick?.lengthCm)
  const [materialId, setMaterialId] = useState<string>()
  const [count, setCount] = useState<number | undefined>(1)
  return (
    <Modal
      open
      onClose={onClose}
      title="Формовая свеча"
      footer={
        <Button
          disabled={!moldId || !length}
          onClick={() => {
            for (let i = 0; i < (count ?? 1); i++)
              dispatch(
                actions.createMoldedCandle({
                  moldId,
                  name: name || mold?.name || '',
                  wick: { scheme, lengthCm: length! },
                  materialId,
                  instructionId: 'default',
                  date: new Date().toISOString(),
                }),
              )
            notify('Свечи созданы с фитилём')
            onClose()
          }}
        >
          Создать
        </Button>
      }
    >
      <Stack gap="4">
        {!molds.length && <Text color="orange.300">Нет форм с назначением «формовая свеча».</Text>}
        <Field label="Форма">
          <Select
            value={moldId}
            onChange={(v) => {
              setMoldId(v)
              const m = d.molds[v]
              setName(m?.name ?? '')
              setLength(m?.defaultWick?.lengthCm)
              if (m?.defaultWick) setScheme(m.defaultWick.scheme)
            }}
            options={molds.map((m) => ({ value: m.id, label: m.name }))}
          />
        </Field>
        <Field label="Название">
          <TextInput value={name} onChange={setName} />
        </Field>
        <Field label="Схема фитиля">
          <Chips
            value={scheme}
            onChange={(v) => v && setScheme(v as WickScheme)}
            options={Object.entries(wickSchemeLabel).map(([value, label]) => ({ value: value as WickScheme, label }))}
          />
        </Field>
        <Field label="Длина фитиля">
          <NumInput value={length} onChange={setLength} suffix="см" />
        </Field>
        <Field label="Фитиль со склада">
          <Select value={materialId} onChange={(v) => setMaterialId(v || undefined)} placeholder="— не списывать —" options={materialOptions(d, 'wick')} />
        </Field>
        <Field label="Сколько штук">
          <NumInput value={count} onChange={setCount} />
        </Field>
      </Stack>
    </Modal>
  )
}

type Sort = 'id' | 'rating' | 'soot'

export default function Candles() {
  const d = useData()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const stage = (sp.get('stage') ?? '') as CandleStage | ''
  const [f, setF] = useState({ fragrance: '', wax: '', person: '', scheme: '', moldTemp: '', minRating: '' })
  const [sort, setSort] = useState<Sort>('id')
  const [sel, setSel] = useState<string[]>([])
  const [dialog, setDialog] = useState<'decor' | 'ready' | 'defect' | 'molded' | null>(null)

  // A holder with a wick is still a holder until it is poured; molded candles have no holder to wait on.
  const all = byId(d.candles).filter((c) => !(c.holderId && c.stage === 'wicked'))
  const list = useMemo(() => {
    const out = all.filter((c) => {
      const pour = c.pourId ? d.pours[c.pourId] : undefined
      if (stage && c.stage !== stage && !(stage === 'curing' && c.stage === 'decorated')) return false
      if (f.fragrance && pour?.fragrance.materialId !== f.fragrance) return false
      if (f.wax && !pour?.waxes.some((w) => w.materialId === f.wax)) return false
      if (f.person && (f.person === 'self' ? !c.burnedBySelf : c.personId !== f.person)) return false
      if (f.scheme && c.wick.scheme !== f.scheme) return false
      if (f.moldTemp === 'none' && pour?.tempMoldC !== 'none') return false
      if (f.moldTemp === 'heated' && (pour?.tempMoldC == null || pour.tempMoldC === 'none')) return false
      if (f.minRating && (candleRating(d, c.id) ?? -1) < Number(f.minRating)) return false
      return true
    })
    if (sort === 'rating') out.sort((a, b) => (candleRating(d, b.id) ?? -1) - (candleRating(d, a.id) ?? -1))
    if (sort === 'soot') out.sort((a, b) => (sootShare(d, b.id) ?? -1) - (sootShare(d, a.id) ?? -1))
    return out
  }, [all, d, stage, f, sort])

  const selected = sel.filter((i) => list.some((c) => c.id === i))
  const stages = selected.map((i) => d.candles[i].stage)
  const allIn = (...s: CandleStage[]) => stages.length > 0 && stages.every((x) => s.includes(x))
  const close = () => {
    setDialog(null)
    setSel([])
  }
  const setStage = (v: string) => {
    const n = new URLSearchParams(sp)
    if (v) n.set('stage', v)
    else n.delete('stage')
    setSp(n, { replace: true })
    setSel([])
  }

  return (
    <>
      <PageHeader title="Свечи">
        <Button size="sm" variant="outline" onClick={() => setDialog('molded')}>
          <LuPlus /> Формовая
        </Button>
        <Button asChild size="sm">
          <RouterLink to="/pour/new">
            <LuDroplets /> Создать свечи
          </RouterLink>
        </Button>
      </PageHeader>

      {/* Still scrolls sideways on a narrow screen, just without a visible bar. */}
      <Flex gap="2" mb="3" overflowX="auto" pb="1" css={{ scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
        <Button size="xs" borderRadius="full" variant={!stage ? 'solid' : 'outline'} onClick={() => setStage('')}>
          Все · {all.length}
        </Button>
        {candleStageOrder.map((s) => (
          <Button key={s} size="xs" flexShrink={0} borderRadius="full" variant={stage === s ? 'solid' : 'outline'} onClick={() => setStage(s)}>
            {candleStageLabel[s]} · {all.filter((c) => c.stage === s).length}
          </Button>
        ))}
      </Flex>

      <SimpleGrid columns={{ base: 2, md: 4 }} gap="2" mb="4">
        <Select size="sm" value={f.fragrance} onChange={(v) => setF({ ...f, fragrance: v })} placeholder="Любая отдушка" options={materialOptions(d, 'fragrance')} />
        <Select size="sm" value={f.wax} onChange={(v) => setF({ ...f, wax: v })} placeholder="Любой воск" options={materialOptions(d, 'wax')} />
        <Select
          size="sm"
          value={f.person}
          onChange={(v) => setF({ ...f, person: v })}
          placeholder="Любой человек"
          options={[{ value: 'self', label: 'сожгла сама' }, ...Object.values(d.people).map((p) => ({ value: p.id, label: p.name }))]}
        />
        <Select
          size="sm"
          value={f.scheme}
          onChange={(v) => setF({ ...f, scheme: v })}
          placeholder="Любой фитиль"
          options={Object.entries(wickSchemeLabel).map(([value, label]) => ({ value, label }))}
        />
        <Select
          size="sm"
          value={f.moldTemp}
          onChange={(v) => setF({ ...f, moldTemp: v })}
          placeholder="Прогрев формы: любой"
          options={[
            { value: 'none', label: 'не грела' },
            { value: 'heated', label: 'грела' },
          ]}
        />
        <Select
          size="sm"
          value={f.minRating}
          onChange={(v) => setF({ ...f, minRating: v })}
          placeholder="Любая оценка"
          options={[9, 8, 7, 5].map((n) => ({ value: String(n), label: `оценка ≥ ${n}` }))}
        />
        <Select
          size="sm"
          value={sort}
          onChange={(v) => setSort((v || 'id') as Sort)}
          options={[
            { value: 'id', label: 'Сначала новые' },
            { value: 'rating', label: 'По оценке' },
            { value: 'soot', label: 'По доле «коптила»' },
          ]}
        />
      </SimpleGrid>

      {list.length > 0 && (
        <Box mb="2">
          <Check checked={selected.length === list.length} onChange={(v) => setSel(v ? list.map((c) => c.id) : [])}>
            <Text fontSize="sm">Выбрать все ({list.length})</Text>
          </Check>
        </Box>
      )}
      {!list.length && <Empty>Свечей с такими условиями нет.</Empty>}

      <SimpleGrid columns={{ base: 2, sm: 3, lg: 4, xl: 5 }} gap={{ base: '3', md: '4' }} gridAutoRows="1fr">
        {list.map((c) => {
          const on = sel.includes(c.id)
          const pour = c.pourId ? d.pours[c.pourId] : undefined
          const rating = candleRating(d, c.id)
          const soot = sootShare(d, c.id)
          const person = c.personId ? d.people[c.personId]?.name : c.burnedBySelf ? 'сожгла сама' : undefined
          return (
            <ArcanaCard
              key={c.id}
              tone="olive"
              figure={figureOf(moldOfCandle(d, c))}
              title={c.name || moldOfCandle(d, c)?.name}
              sub={c.id}
              selected={on}
              dim={c.stage === 'defect'}
              corner={rating != null ? `${rating}/10` : undefined}
              select={<Check checked={on} onChange={(v) => setSel(v ? [...sel, c.id] : sel.filter((x) => x !== c.id))} />}
              onClick={() => nav(`/candles/${c.id}`, { state: { back: `/candles${sp.size ? `?${sp}` : ''}` } })}
            >
              <Text color={c.stage === 'defect' ? 'red.300' : 'fg'} fontWeight="medium">
                {candleStageLabel[c.stage]}
              </Text>
              <Text>
                {wickSchemeLabel[c.wick.scheme]}, {fmt(c.wick.lengthCm)} см
              </Text>
              {pour?.fragrance.materialId && <Text lineClamp={2}>{d.materials[pour.fragrance.materialId]?.name}</Text>}
              {person && <Text>{person}</Text>}
              {soot != null && soot > 0 && <Text color="orange.200">коптила {Math.round(soot * 100)}%</Text>}
            </ArcanaCard>
          )
        })}
      </SimpleGrid>
      {/* Room for the action bar so it does not cover the last cards. */}
      {selected.length > 0 && <Box h="140px" />}

      {selected.length > 0 && (
        <Box position="fixed" bottom={{ base: '72px', md: '6' }} left={{ base: '4', md: 'calc(240px + 2rem)' }} right="4" zIndex="docked">
          <Flex gap="2" p="2" bg="bg.panel" borderWidth="1px" borderColor="emerald.700" borderRadius="l3" shadow="lg" maxW="720px" mx="auto" wrap="wrap" justify="center">
            {allIn('wicked') && (
              <Button size="sm" onClick={() => nav(`/pour/new?ids=${selected.join(',')}`)}>
                <LuDroplets /> Залить · {selected.length}
              </Button>
            )}
            {allIn('curing') && (
              <Button size="sm" onClick={() => setDialog('decor')}>
                <LuSparkles /> Украсить
              </Button>
            )}
            {allIn('curing', 'decorated') && (
              <Button size="sm" onClick={() => setDialog('ready')}>
                <LuCheck /> Готова
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => nav(`/print?ids=${selected.join(',')}`)}>
              <LuPrinter /> QR-лист
            </Button>
            <Button size="sm" variant="outline" colorPalette="red" onClick={() => setDialog('defect')}>
              <LuTriangleAlert /> Брак
            </Button>
          </Flex>
        </Box>
      )}

      {dialog === 'decor' && <DecorateDialog ids={selected} onClose={close} />}
      {dialog === 'ready' && <ReadyDialog ids={selected} onClose={close} />}
      {dialog === 'defect' && <DefectDialog kind="candle" ids={selected} onClose={close} />}
      {dialog === 'molded' && <MoldedCandleDialog onClose={() => setDialog(null)} />}
    </>
  )
}

export { ReadyDialog }
