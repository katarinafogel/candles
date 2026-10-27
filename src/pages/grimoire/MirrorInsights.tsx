// «Что видно»: the mirror's analytics. Answers to questions, in her own numbers, without verdicts;
// below ten marks in the period there are no conclusions at all, just «пока мало записей».
import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react'
import { useState, type ReactNode } from 'react'
import { Chips, Empty, Section } from '../../components/ui'
import { useToday } from '../../grimoire/act'
import { addDays, plural } from '../../grimoire/days'
import { factorLabel, mirrorFactors, petalOrder, petals } from '../../grimoire/emotions'
import { byFactor, byMoon, bySabbat, countPetals, dayParts, deedsAndFeelings, inDays, marksIn, minMarks, moonGroups, peopleFeelings, postponeFeelings, rhythm, total, vocabulary, type PetalCounts } from '../../grimoire/mirrorStats'
import type { JournalEntry } from '../../grimoire/types'
import { sabbats, wheelNow } from '../../grimoire/wheel'
import { useAppSelector } from '../../store'
import { energyNames } from './MirrorEntry'

type Period = 'week' | 'month' | 'segment'

/** One row: a label and a bar split by petals, widths by share; the names of the two biggest under it. */
function PetalBar({ label, counts, note }: { label: ReactNode; counts: PetalCounts; note?: ReactNode }) {
  const sum = total(counts)
  const top = petalOrder.filter((p) => counts[p]).sort((a, b) => counts[b] - counts[a]).slice(0, 2)
  return (
    <Box>
      <Flex justify="space-between" fontSize="sm" mb="1" gap="2">
        <Text>{label}</Text>
        <Text color="fg.muted" fontSize="xs" textAlign="right">
          {sum ? top.map((p) => `${petals[p].name.toLowerCase()} ${Math.round((counts[p] / sum) * 100)}%`).join(' · ') : 'нет слов'}
          {note && <> · {note}</>}
        </Text>
      </Flex>
      <Flex h="10px" borderRadius="full" overflow="hidden" bg="bg.muted" aria-hidden>
        {petalOrder.map((p) => (counts[p] ? <Box key={p} w={`${(counts[p] / sum) * 100}%`} bg={petals[p].color} /> : null))}
      </Flex>
    </Box>
  )
}

function Block({ title, question, children }: { title: string; question: string; children: ReactNode }) {
  return (
    <Section title={title}>
      <Text fontSize="sm" color="fg.muted" mb="3">
        {question}
      </Text>
      <Stack gap="3">{children}</Stack>
    </Section>
  )
}

const quiet = (text: string) => (
  <Text fontSize="sm" color="fg.subtle">
    {text}
  </Text>
)

export function MirrorInsights({ entries }: { entries: JournalEntry[] }) {
  const g = useAppSelector((s) => s.grimoire)
  const people = useAppSelector((s) => s.data.people)
  const today = useToday()
  const [period, setPeriod] = useState<Period>('month')
  const now = wheelNow(today, g.meta.hemisphere)
  const from = period === 'week' ? addDays(today, -6) : period === 'month' ? addDays(today, -29) : now.current.day
  const list = inDays(entries, from, today)
  const marks = marksIn(list)
  const deeds = deedsAndFeelings(g, list)
  const moves = postponeFeelings(g, list, from, today)
  const ppl = peopleFeelings(list, people)
  const factors = byFactor(list, mirrorFactors.map((f) => f.key))
  const vocab = vocabulary(entries, today)
  const legend = (
    <Flex gap="3" wrap="wrap" fontSize="xs" color="fg.muted">
      {petalOrder.map((p) => (
        <HStack key={p} gap="1">
          <Box w="8px" h="8px" borderRadius="full" bg={petals[p].color} />
          <Text>{petals[p].name}</Text>
        </HStack>
      ))}
    </Flex>
  )

  return (
    <>
      <Flex gap="2" wrap="wrap" align="center" mb="3">
        <Chips value={period} onChange={(v) => setPeriod((v as Period) ?? period)} options={[
          { value: 'week', label: 'неделя' },
          { value: 'month', label: 'месяц' },
          { value: 'segment', label: `отрезок колеса · ${sabbats[now.current.sabbat].name}` },
        ]} />
        <Text fontSize="sm" color="fg.muted">
          {plural(marks, 'отметка', 'отметки', 'отметок')}
        </Text>
      </Flex>
      {marks < minMarks ? (
        <Empty>
          Пока мало записей: {marks} из {minMarks} отметок за этот период. Выводы появятся, когда слов станет больше, — это наблюдение по своим данным, не оценка.
        </Empty>
      ) : (
        <Stack gap="0">
          <Box mb="4">{legend}</Box>
          <Block title="Карта лепестков" question="Какие чувства были чаще всего?">
            <PetalBar label="за период" counts={countPetals(list)} />
          </Block>
          <Block title="Ритм дня" question="В какое время суток какие чувства приходят чаще?">
            {rhythm(list).map((r) => (
              <PetalBar key={r.key} label={dayParts.find((p) => p.key === r.key)!.label} counts={r.counts} note={plural(total(r.counts), 'слово', 'слова', 'слов')} />
            ))}
          </Block>
          <Block title="Дела и чувства" question="Что чувствую перед жабами и чудовищами — и что после «Сделала»?">
            {total(deeds.before) || total(deeds.after) ? (
              <>
                <PetalBar label="до старта" counts={deeds.before} />
                <PetalBar label="после «Сделала»" counts={deeds.after} />
              </>
            ) : (
              quiet('Слов у трудных дел за этот период нет. Их спрашивают при «Начать понемногу» и после «Сделала».')
            )}
            {deeds.tags.length > 0 && (
              <Text fontSize="sm" color="fg.muted">
                Страх и отвращение перед стартом чаще у тегов: {deeds.tags.map(([t, n]) => `#${t} (${n})`).join(', ')}
              </Text>
            )}
          </Block>
          <Block title="Саботаж" question="Какие чувства были в дни, когда дела переносились?">
            {moves.moves && total(moves.near) ? (
              <>
                <PetalBar label={`до переноса · ${plural(moves.moves, 'перенос', 'переноса', 'переносов')}`} counts={moves.near} />
                <PetalBar label="все слова периода" counts={moves.all} />
                <Text fontSize="xs" color="fg.subtle">
                  Совпадение по времени, а не причина.
                </Text>
              </>
            ) : (
              quiet(moves.moves ? 'В дни переносов до переноса слов не отмечала.' : 'Переносов за этот период не было.')
            )}
          </Block>
          <Block title="Люди" question="С кем какие чувства?">
            {ppl.length ? ppl.slice(0, 8).map((r) => <PetalBar key={r.key} label={`@${people[r.key].name}`} counts={r.counts} />) : quiet('Людей в записях этого периода нет — их можно добавить в «Подробнее».')}
          </Block>
          <Block title="Колесо года и Луна" question="Как чувства ложатся на саббаты и фазы Луны? Наблюдение по своим данным, не прогноз.">
            {bySabbat(list, g.meta.hemisphere).map((r) => (
              <PetalBar key={r.key} label={`${sabbats[r.key].symbol} отрезок ${sabbats[r.key].name}`} counts={r.counts} />
            ))}
            {byMoon(list).map((r) => (
              <PetalBar key={r.key} label={moonGroups.find((m) => m.key === r.key)!.label} counts={r.counts} />
            ))}
          </Block>
          <Block title="Что влияет" question="Какие чувства и какая энергия рядом с каждым фактором?">
            {factors.length
              ? factors.map((f) => <PetalBar key={f.key} label={`${factorLabel(f.key)} · ${plural(f.count, 'запись', 'записи', 'записей')}`} counts={f.counts} note={f.energy ? `энергия ${energyNames[Math.round(f.energy) - 1]}` : undefined} />)
              : quiet('Факторы в этот период не отмечала.')}
          </Block>
          <Block title="Словарный запас" question="Сколько разных слов и насколько точно — за последние 30 дней.">
            <Text fontSize="sm">
              {plural(vocab.now.distinct, 'разное слово', 'разных слова', 'разных слов')} из 32
              {vocab.before.marks > 0 && ` (месяцем раньше — ${vocab.before.distinct})`}.
            </Text>
            {vocab.now.precise != null && (
              <Text fontSize="sm">
                Слабых и сильных слов — {Math.round(vocab.now.precise * 100)}%, средних — {100 - Math.round(vocab.now.precise * 100)}%
                {vocab.before.precise != null && ` (месяцем раньше слабых и сильных было ${Math.round(vocab.before.precise * 100)}%)`}.
              </Text>
            )}
          </Block>
        </Stack>
      )}
    </>
  )
}
