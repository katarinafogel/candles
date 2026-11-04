// Deeds of the wheel for a day or a week: «хочу» first, and among them the ones whose segment ends
// soonest; the coming sabbat joins two weeks ahead, the esbat a week ahead. Never offered in the навь.
import { Button, SimpleGrid, Stack } from '@chakra-ui/react'
import { useMemo, useState } from 'react'
import { Chips, Empty, Modal } from '../ui'
import { useToday, withUndo } from '../../grimoire/act'
import { addDays, daysBetween, humanDay } from '../../grimoire/days'
import type { DayKey, Sabbat, WheelPractice } from '../../grimoire/types'
import { nextFullMoon, sabbats, segmentOf, wheelNow } from '../../grimoire/wheel'
import { useAppDispatch, useAppSelector } from '../../store'
import { grimoireActions as A } from '../../store/grimoireSlice'
import { arcanaButton } from '../ArcanaCard'
import { PracticeCard } from './PracticeCard'
import { usePlanGuard } from './PlanGuard'
import { cardColumns } from './TaskCard'

const weekdayShort = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

interface Candidate {
  p: WheelPractice
  want: boolean
  /** The last day it can still be lived, and its own day (the sabbat or the full moon). */
  ends: DayKey
  holiday?: DayKey
}

export function useWheelCandidates(focus?: Sabbat) {
  const g = useAppSelector((s) => s.grimoire)
  const today = useToday()
  return useMemo(() => {
    const hemi = g.meta.hemisphere
    const now = wheelNow(today, hemi)
    const cur = now.current.sabbat
    const segs: Partial<Record<Sabbat | 'esbat', { ends: DayKey; holiday?: DayKey }>> = {
      [cur]: { ends: segmentOf(cur, today, hemi).to, holiday: now.current.day >= today ? now.current.day : undefined },
    }
    if (now.daysToNext <= 14 || focus === now.next.sabbat) segs[now.next.sabbat] = { ends: segmentOf(now.next.sabbat, today, hemi).to, holiday: now.next.day }
    const moon = nextFullMoon(today)
    if (daysBetween(today, moon) <= 7) segs.esbat = { ends: moon, holiday: moon }
    const wanted = new Set(Object.values(g.wishes).filter((w) => w.practiceId && (w.status === 'dream' || w.status === 'inProgress')).map((w) => w.practiceId!))
    const inBook = new Set(Object.values(g.tasks).filter((t) => t.practiceId && t.status !== 'done' && t.status !== 'cancelled').map((t) => t.practiceId!))
    const out: Candidate[] = []
    for (const p of Object.values(g.practices)) {
      const seg = segs[p.sabbat]
      if (!seg || p.hidden || inBook.has(p.id)) continue
      out.push({ p, want: wanted.has(p.id), ends: seg.ends, holiday: p.mode === 'day' ? seg.holiday : undefined })
    }
    return out.sort((a, b) => Number(b.want) - Number(a.want) || a.ends.localeCompare(b.ends) || Number(!!a.p.seasonal) - Number(!!b.p.seasonal) || a.p.title.localeCompare(b.p.title))
  }, [g.practices, g.wishes, g.tasks, g.meta.hemisphere, today, focus])
}

export function WheelPick({ onClose, focus }: { onClose: () => void; focus?: Sabbat }) {
  const dispatch = useAppDispatch()
  const today = useToday()
  const list = useWheelCandidates(focus)
  const [mode, setMode] = useState<'day' | 'week'>('day')
  const [guard, guardDialog] = usePlanGuard()
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i))

  function put(p: WheelPractice, day: DayKey) {
    const add = () => withUndo(`В делах на ${humanDay(day, today)}`, () => dispatch(A.practiceToTask({ practiceId: p.id, doOn: day })))
    // Only today has a plan limit to keep.
    if (day === today) guard(true, add, { stars: 1 })
    else add()
  }

  const title = focus ? `Подготовиться к ${sabbats[focus].dative}` : 'Дела колеса'
  return (
    <Modal open onClose={onClose} title={title}>
      <Stack gap="3">
        <Chips value={mode} onChange={(v) => setMode((v as 'day' | 'week') ?? mode)} options={[
          { value: 'day', label: 'на сегодня' },
          { value: 'week', label: 'на неделю' },
        ]} />
        {list.length ? (
          <SimpleGrid gridTemplateColumns={cardColumns} gap="3">
            {list.map(({ p, want, holiday }) => (
              <PracticeCard
                key={p.id}
                p={p}
                want={want}
                lines={[p.sabbat === 'esbat' ? 'эсбат' : sabbats[p.sabbat].name, holiday ? `в свой день: ${humanDay(holiday, today)}` : null]}
                actions={
                  <>
                    {holiday && holiday !== today && (
                      <Button {...arcanaButton} onClick={() => put(p, holiday)}>
                        {humanDay(holiday, today)}
                      </Button>
                    )}
                    {mode === 'day' ? (
                      <Button {...arcanaButton} onClick={() => put(p, today)}>
                        Сегодня
                      </Button>
                    ) : (
                      week.map((d) => (
                        <Button key={d} {...arcanaButton} px="1.5" minW="0" onClick={() => put(p, d)} title={humanDay(d, today)}>
                          {d === today ? 'сег' : weekdayShort[new Date(`${d}T12:00:00Z`).getUTCDay()]}
                        </Button>
                      ))
                    )}
                  </>
                }
              />
            ))}
          </SimpleGrid>
        ) : (
          <Empty>Всё, что можно сейчас, уже в делах или скрыто.</Empty>
        )}
      </Stack>
      {guardDialog}
    </Modal>
  )
}
