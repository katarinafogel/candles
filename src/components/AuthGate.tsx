import { Box, Button, Center, Container, Flex, Heading, Input, Spinner, Stack, Text } from '@chakra-ui/react'
import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { FcGoogle } from 'react-icons/fc'
import { LuFlame, LuMail } from 'react-icons/lu'
import { publicBase } from '../lib/config'
import { authRedirect, supabase, supabaseConfigured } from '../lib/supabase'
import { startSync } from '../lib/sync'
import { useAppDispatch, useAppSelector, useData } from '../store'
import { localActions } from '../store/localSlice'
import { Field, notify } from './ui'

function Shell({ children }: { children: ReactNode }) {
  return (
    <Center minH="100dvh" px="4" py="10">
      <Container maxW="400px" p="0">
        <Flex direction="column" align="center" mb="8" gap="2">
          <Box color="emerald.400" fontSize="5xl">
            <LuFlame />
          </Box>
          <Heading size="2xl" letterSpacing="-0.01em">
            Мастерская свечей
          </Heading>
          <Text color="fg.muted" fontSize="sm" textAlign="center">
            Производственный журнал: замесы, заливки, склад и отзывы
          </Text>
        </Flex>
        <Box p="6" borderWidth="1px" borderColor="border" bg="bg.subtle" borderRadius="l3">
          {children}
        </Box>
      </Container>
    </Center>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function google() {
    setBusy(true)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirect() } })
    if (error) {
      notify('Не удалось начать вход через Google', 'error', error.message)
      setBusy(false)
    }
  }

  async function sendCode() {
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: authRedirect() },
    })
    setBusy(false)
    if (error) return notify('Не удалось отправить письмо', 'error', error.message)
    setSent(true)
  }

  async function verify() {
    setBusy(true)
    // A code typed into the app works even when the letter is opened on another device.
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) notify('Код не подошёл', 'error', error.message)
  }

  return (
    <Shell>
      <Stack gap="5">
        <Button size="lg" variant="outline" onClick={google} loading={busy && !sent}>
          <FcGoogle /> Войти через Google
        </Button>
        <Flex align="center" gap="3" color="fg.subtle" fontSize="xs">
          <Box flex="1" h="1px" bg="border" />
          или по почте
          <Box flex="1" h="1px" bg="border" />
        </Flex>
        {!sent ? (
          <>
            <Field label="Почта">
              <Input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button onClick={sendCode} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())} loading={busy}>
              <LuMail /> Получить код
            </Button>
          </>
        ) : (
          <>
            <Text fontSize="sm" color="fg.muted">
              Отправили письмо на <b>{email}</b>. Введите код из письма или откройте ссылку в нём.
            </Text>
            <Field label="Код из письма">
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                fontSize="xl"
                letterSpacing="0.3em"
                textAlign="center"
              />
            </Field>
            <Button onClick={verify} disabled={code.length < 6} loading={busy}>
              Войти
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSent(false)}>
              Другая почта
            </Button>
          </>
        )}
      </Stack>
    </Shell>
  )
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/@.*/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)

function Onboarding({ session }: { session: Session }) {
  const dispatch = useAppDispatch()
  const meta = session.user.user_metadata as { full_name?: string; name?: string }
  const [name, setName] = useState(meta.full_name ?? meta.name ?? '')
  const [slug, setSlug] = useState(slugify(session.user.email ?? ''))
  const [free, setFree] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const valid = /^[a-z0-9][a-z0-9-]{2,29}$/.test(slug)
  const d = useData()

  useEffect(() => {
    setFree(null)
    if (!valid) return
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('slug_available', { p_slug: slug })
      setFree(!!data)
    }, 400)
    return () => clearTimeout(t)
  }, [slug, valid])

  async function save() {
    setBusy(true)
    const { error } = await supabase.from('profiles').insert({ user_id: session.user.id, slug, name: name.trim() })
    setBusy(false)
    if (error) return notify('Не получилось сохранить', 'error', error.code === '23505' ? 'Этот адрес уже занят' : error.message)
    dispatch(localActions.setProfile({ slug, name: name.trim() }))
  }

  return (
    <Shell>
      <Stack gap="5">
        <Heading size="md">Как вас называть</Heading>
        <Field label="Имя мастера или мастерской" helper="видно получателям на странице свечи">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field
          label="Адрес в ссылках QR"
          invalid={!valid || free === false}
          helper={
            !valid
              ? 'латиница, цифры и дефис, от 3 до 30 символов'
              : free === false
                ? 'этот адрес уже занят'
                : `${publicBase(d.settings)}#/c/${slug}/S-0001 · изменить потом нельзя`
          }
        >
          <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
        </Field>
        <Button onClick={save} disabled={!valid || free !== true || !name.trim()} loading={busy}>
          Продолжить
        </Button>
      </Stack>
    </Shell>
  )
}

/** Shows the app only to a signed-in master with a profile; the recipient's page lives outside. */
export function AuthGate({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const profile = useAppSelector((s) => s.local.profile)
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [profileChecked, setProfileChecked] = useState(false)

  useEffect(() => {
    if (!supabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    // Drop ?code=… left by the sign-in redirect.
    if (location.search) history.replaceState(null, '', location.pathname + location.hash)
    void startSync(session.user.id, session.user.email)
    supabase
      .from('profiles')
      .select('slug,name')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        // Offline: keep the cached profile.
        if (!error) dispatch(localActions.setProfile(data ? { slug: data.slug, name: data.name } : null))
        setProfileChecked(true)
      })
  }, [session?.user.id, dispatch]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!supabaseConfigured)
    return (
      <Shell>
        <Text>Сервер не настроен: при сборке не заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.</Text>
      </Shell>
    )
  if (session === undefined || (session && !profile && !profileChecked))
    return (
      <Center minH="100dvh">
        <Spinner color="emerald.400" size="lg" />
      </Center>
    )
  if (!session) return <Login />
  if (!profile) return <Onboarding session={session} />
  return <>{children}</>
}
