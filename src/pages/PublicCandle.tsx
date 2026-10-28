import { Box, Button, Container, Flex, Heading, HStack, Spinner, Stack, Text } from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'
import { LuCopy, LuFlame, LuSend, LuWind } from 'react-icons/lu'
import { useParams } from 'react-router-dom'
import { ReviewForm } from '../components/ReviewForm'
import { Chips, Field, notify, NumInput, TextArea } from '../components/ui'
import { candleColors, scentNotes } from '../lib/labels'
import { fmt, round2 } from '../lib/calc'
import { supabase } from '../lib/supabase'
import type { ReviewAnswers, TesterAnswer } from '../types'
import { MoonSlice } from '../components/Magic'

interface Session {
  start: number
  end?: number
  selfOut?: boolean
}

const LONG = 12 * 3600 * 1000
const key = (id: string) => `burn:${id}`

// The tracker lives in the recipient's browser under the candle id.
function load(id: string): Session[] {
  try {
    return JSON.parse(localStorage.getItem(key(id)) ?? '[]')
  } catch {
    return []
  }
}
function store(id: string, s: Session[]) {
  try {
    localStorage.setItem(key(id), JSON.stringify(s))
  } catch {
    /* storage unavailable: the tracker just won't survive a reload */
  }
}

const fmtDur = (ms: number) => {
  const m = Math.floor(ms / 60000)
  const h = Math.floor(m / 60)
  return h ? `${h} ч ${m % 60} мин` : `${m} мин`
}

function useTick(active: boolean) {
  const [, set] = useState(0)
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => set((x) => x + 1), 15000)
    return () => clearInterval(t)
  }, [active])
}

function BurnTracker({ id, sessions, setSessions }: { id: string; sessions: Session[]; setSessions: (s: Session[]) => void }) {
  const open = sessions.find((s) => !s.end)
  const [askOut, setAskOut] = useState(false)
  useTick(!!open)
  const now = Date.now()
  const total = sessions.reduce((a, s) => a + ((s.end ?? now) - s.start), 0)
  const save = (s: Session[]) => {
    setSessions(s)
    store(id, s)
  }
  const stop = (selfOut: boolean) => {
    save(sessions.map((s) => (s === open ? { ...s, end: Date.now(), selfOut } : s)))
    setAskOut(false)
  }

  return (
    <Stack gap="4" align="center" textAlign="center">
      {!askOut ? (
        <Button
          size="2xl"
          h="20"
          w="100%"
          maxW="340px"
          borderRadius="full"
          fontSize="xl"
          variant={open ? 'outline' : 'solid'}
          colorPalette="ember"
          boxShadow={open ? undefined : '0 0 32px -6px rgba(224,164,85,.55)'}
          onClick={() => (open ? setAskOut(true) : save([...sessions, { start: Date.now() }]))}
        >
          {open ? <LuWind /> : <LuFlame />} {open ? 'Потушить' : 'Зажечь'}
        </Button>
      ) : (
        <Stack w="100%" maxW="340px" gap="2">
          <Button size="xl" onClick={() => stop(false)}>
            Потушила сама(сам)
          </Button>
          <Button size="xl" variant="outline" onClick={() => stop(true)}>
            Потухла сама
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAskOut(false)}>
            Отмена
          </Button>
        </Stack>
      )}
      {open && <Text color="emerald.300">Горит {fmtDur(now - open.start)}</Text>}
      <HStack gap="6" justify="center">
        <Box>
          <Text fontSize="2xl" fontWeight="semibold">
            {sessions.length}
          </Text>
          <Text fontSize="xs" color="fg.muted">
            сессий
          </Text>
        </Box>
        <Box>
          <Text fontSize="2xl" fontWeight="semibold">
            {fmt(total / 3600000, 1)}
          </Text>
          <Text fontSize="xs" color="fg.muted">
            часов всего
          </Text>
        </Box>
      </HStack>
      {sessions.map((s, i) =>
        (s.end ?? now) - s.start > LONG ? (
          <Box key={i} p="3" borderWidth="1px" borderColor="orange.700" borderRadius="l3" w="100%" textAlign="start">
            <Text fontSize="sm" color="orange.300" mb="2">
              Похоже, свечу забыли потушить в трекере ({new Date(s.start).toLocaleString('ru-RU')}). Сколько она горела на самом деле?
            </Text>
            <NumInput
              value={undefined}
              placeholder="часов"
              suffix="ч"
              onChange={(v) => {
                if (!v) return
                save(sessions.map((x) => (x === s ? { ...x, end: x.start + v * 3600000 } : x)))
              }}
            />
          </Box>
        ) : null,
      )}
    </Stack>
  )
}

const testerKey = (slug: string) => `tester:${slug}`
const answeredTester = (slug: string) => {
  try {
    return !!localStorage.getItem(testerKey(slug))
  } catch {
    return false
  }
}

/**
 * Right after a review: «Хотите помогать тестировать свечи дальше?». No — a thank-you; yes — which
 * scents and colours they like and a free comment. Asked once per master in this browser.
 */
function TesterQuestion({ slug, reviewId, master, onDone }: { slug: string; reviewId: string; master?: string; onDone: () => void }) {
  const [step, setStep] = useState<'ask' | 'form' | 'thanks'>('ask')
  const [wants, setWants] = useState(false)
  const [a, setA] = useState<TesterAnswer>({ wants: true })
  const [sending, setSending] = useState(false)
  const send = async (answer: TesterAnswer) => {
    setSending(true)
    // Not getting through is no reason to bother the person: the review itself is already in.
    await supabase
      .rpc('submit_tester', {
        p_slug: slug,
        p_review_id: reviewId,
        p_tester: answer,
      })
      .then(
        () => undefined,
        () => undefined,
      )
    try {
      localStorage.setItem(testerKey(slug), answer.wants ? 'yes' : 'no')
    } catch {
      /* the question may come again next time */
    }
    setSending(false)
    setWants(answer.wants)
    setStep('thanks')
  }
  return (
    <Box p="5" borderRadius="l3" bg="bg.subtle" borderWidth="1px" borderColor="ember.700">
      {step === 'ask' && (
        <Stack gap="4" textAlign="center">
          <Heading size="lg" fontWeight="semibold">
            Хотите помогать тестировать свечи дальше?
          </Heading>
          <Text fontSize="sm" color="fg.muted">
            Иногда {master ?? 'мастер'} делает новые свечи и ищет, кому дать их попробовать.
          </Text>
          <HStack gap="3" justify="center">
            <Button size="lg" onClick={() => setStep('form')}>
              Да, хочу
            </Button>
            <Button size="lg" variant="outline" loading={sending} onClick={() => send({ wants: false })}>
              Нет, спасибо
            </Button>
          </HStack>
        </Stack>
      )}
      {step === 'form' && (
        <Stack gap="5">
          <Heading size="lg" fontWeight="semibold">
            Здорово! Немного о вкусах
          </Heading>
          <Field label="Какие ароматы нравятся?">
            <Chips multi value={a.notes ?? []} onChange={(v) => setA({ ...a, notes: (v as string[]) ?? [] })} options={scentNotes.map((n) => ({ value: n, label: n }))} />
          </Field>
          <Field label="Какие цвета любите?">
            <Chips multi value={a.colors ?? []} onChange={(v) => setA({ ...a, colors: (v as string[]) ?? [] })} options={candleColors.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Комментарий">
            <TextArea value={a.comment ?? ''} onChange={(v) => setA({ ...a, comment: v })} rows={3} placeholder="что угодно: любимые запахи, на что аллергия, какие свечи хотелось бы" />
          </Field>
          <Button
            size="lg"
            loading={sending}
            onClick={() =>
              send({
                ...a,
                wants: true,
                comment: a.comment?.trim() || undefined,
              })
            }
          >
            <LuSend /> Отправить
          </Button>
        </Stack>
      )}
      {step === 'thanks' && (
        <Stack gap="3" textAlign="center">
          <Heading size="lg" fontWeight="semibold">
            {wants ? 'Спасибо! Записали' : 'Спасибо, что попробовали свечу!'}
          </Heading>
          <Text fontSize="sm" color="fg.muted">
            {wants ? `${master ?? 'Мастер'} напишет, когда будет новая свеча на пробу.` : 'Ваш отзыв очень помогает делать свечи лучше. Пусть она горит тепло и ровно.'}
          </Text>
          <Button variant="ghost" size="sm" onClick={onDone}>
            Закрыть
          </Button>
        </Stack>
      )}
    </Box>
  )
}

export default function PublicCandle() {
  const { slug = '', id = '' } = useParams()
  const trackerKey = `${slug}/${id}`
  const [info, setInfo] = useState<{
    name?: string
    instruction?: string
    master?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<Session[]>(() => load(trackerKey))
  const [answers, setAnswers] = useState<ReviewAnswers>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(0)
  const [sentFinal, setSentFinal] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [askTester, setAskTester] = useState<string>()

  useEffect(() => {
    // Only the name, the instruction and the master's name are public.
    supabase
      .rpc('candle_public', { p_slug: slug, p_id: id })
      .then(({ data }) => setInfo(data?.found ? data : data?.master ? { master: data.master } : null))
      .then(
        () => setLoading(false),
        () => setLoading(false),
      )
  }, [slug, id])

  const outCount = sessions.filter((s) => s.selfOut).length
  // The tracker pre-fills «Тухла ли в процессе?» unless the person answered it.
  const wentOut = useMemo(
    () => (outCount === 0 ? undefined : outCount === 1 ? 'sometimes' : outCount / Math.max(1, sessions.length) > 0.3 ? 'often' : 'sometimes'),
    [outCount, sessions.length],
  ) as ReviewAnswers['wentOut']

  function payload() {
    const now = Date.now()
    const total = sessions.reduce((a, s) => a + ((s.end ?? now) - s.start), 0)
    return {
      ...answers,
      wentOut: answers.wentOut ?? wentOut,
      id: crypto.randomUUID(),
      candleId: id,
      date: new Date().toISOString(),
      burnHours: round2(total / 3600000),
      sessions: sessions.length,
      selfExtinguished: outCount,
    }
  }

  async function send() {
    const p = payload()
    setSending(true)
    setFailed(null)
    try {
      const { error } = await supabase.rpc('submit_review', {
        p_slug: slug,
        p_review: p,
      })
      if (error) throw new Error(error.message)
      setSent((n) => n + 1)
      setSentFinal(p.finished === 'yes')
      if (!answeredTester(slug)) setAskTester(p.id)
      notify('Спасибо! Отзыв отправлен')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setFailed(JSON.stringify(p))
    } finally {
      setSending(false)
    }
  }

  return (
    <Container maxW="560px" px="4" py="8" pb="16">
      <Stack gap="8">
        <Box textAlign="center">
          <Flex justify="center" mb="3">
            <MoonSlice size={64} />
          </Flex>
          {loading ? (
            <Spinner color="ember.300" />
          ) : (
            <Heading size="4xl" fontWeight="semibold" color="ember.50">
              {info?.name || 'Свеча'}
            </Heading>
          )}
          <Text color="fg.muted" fontFamily="mono" fontSize="sm" mt="1">
            {id}
          </Text>
          {info?.master && (
            <Text color="fg.muted" fontSize="sm">
              {info.master}
            </Text>
          )}
          {sent > 0 && (
            <Text color="emerald.300" mt="3">
              {sentFinal ? 'Спасибо! Отзыв получен.' : `Отзыв получен${sent > 1 ? ` (${sent})` : ''}. Можно отправить ещё один, когда свеча догорит.`}
            </Text>
          )}
        </Box>

        {askTester && (
          <TesterQuestion
            slug={slug}
            reviewId={askTester}
            master={info?.master}
            onDone={() => {
              setAskTester(undefined)
              window.scrollTo({ top: 0 })
            }}
          />
        )}

        {!askTester && (
          <>
            {info?.instruction && (
              <Box p="4" borderRadius="l3" bg="bg.subtle" borderWidth="1px" borderColor="border">
                <Heading size="sm" mb="2">
                  Как жечь свечу
                </Heading>
                <Text whiteSpace="pre-wrap" fontSize="sm" color="fg.muted">
                  {info.instruction}
                </Text>
              </Box>
            )}

            <Box>
              <Heading size="md" mb="4" textAlign="center">
                Трекер горения
              </Heading>
              <BurnTracker id={trackerKey} sessions={sessions} setSessions={setSessions} />
              <Text fontSize="xs" color="fg.subtle" textAlign="center" mt="3">
                История хранится в этом браузере: при смене телефона или очистке браузера она потеряется.
              </Text>
            </Box>

            <Box>
              <Heading size="md" mb="1">
                Отзыв
              </Heading>
              <Text fontSize="sm" color="fg.muted" mb="4">
                Все вопросы необязательные — ответьте, на что хочется.
              </Text>
              <ReviewForm value={{ ...answers, wentOut: answers.wentOut ?? wentOut }} onChange={setAnswers} />
            </Box>

            <Stack gap="3">
              <Button size="xl" onClick={send} loading={sending}>
                <LuSend /> Отправить
              </Button>
              {failed && (
                <Box p="3" borderWidth="1px" borderColor="orange.700" borderRadius="l3">
                  <Text fontSize="sm" color="orange.300" mb="2">
                    Не получилось отправить. Скопируйте ответ и перешлите его мастеру в мессенджер.
                  </Text>
                  <Button
                    variant="outline"
                    w="100%"
                    onClick={async () => {
                      await navigator.clipboard.writeText(`Отзыв на свечу ${slug}/${id}:\n${failed}`)
                      notify('Ответ скопирован')
                    }}
                  >
                    <LuCopy /> Скопировать ответ
                  </Button>
                </Box>
              )}
            </Stack>
          </>
        )}
      </Stack>
    </Container>
  )
}
