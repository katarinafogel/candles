import { Box, Button, Center, Container, Flex, Heading, IconButton, Input, Separator, Spinner, Stack, Text } from '@chakra-ui/react'
import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { FcGoogle } from 'react-icons/fc'
import { useLocation } from 'react-router-dom'
import { appOf, applyApp, setTitleOverride } from '../lib/apps'
import { publicBase } from '../lib/config'
import { authRedirect, supabase, supabaseConfigured } from '../lib/supabase'
import { startSync } from '../lib/sync'
import { useAppDispatch, useAppSelector, useData } from '../store'
import { grimoireActions as A } from '../store/grimoireSlice'
import { localActions } from '../store/localSlice'
import { Eucalyptus, MoonPhases, MoonSlice } from './Magic'
import { Chips, Field, notify } from './ui'

function Shell({ children }: { children: ReactNode }) {
  return (
    <Center minH="100dvh" px="4" py="6" pt="calc(24px + env(safe-area-inset-top))">
      <Container maxW="400px" p="0">
        <Flex direction="column" align="center" mb="5" gap="2" position="relative">
          <Eucalyptus width={80} position="absolute" top="-50px" left="-20px" opacity={0.5} />
          <Eucalyptus width={60} flip position="absolute" top="-44px" right="-6px" opacity={0.35} />
          <MoonSlice size={48} />
          <Heading size="3xl" fontWeight="semibold" color="ember.50">
            Гримуар
          </Heading>
          <MoonPhases size={10} gap="2" color="ember.200" />
          <Text color="fg.muted" fontSize="sm" textAlign="center">
            Открывая гримуар, представься
          </Text>
        </Flex>
        <Box p="4" borderWidth="1px" borderColor="border" bg="bg.subtle" borderRadius="l3">
          {children}
        </Box>
        <Text textAlign="center" mt="4" fontSize="xs">
          <Box as="a" color="fg.subtle" textDecoration="underline" {...{ href: './privacy.html' }}>
            Политика конфиденциальности
          </Box>
        </Text>
      </Container>
    </Center>
  )
}

function Login() {
  const { pathname } = useLocation()
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // The sign-in page is shared by both projects and carries the grimoire's name in the tab.
  useEffect(() => {
    setTitleOverride('Гримуар')
    applyApp(appOf(pathname))
    return () => {
      setTitleOverride(null)
      applyApp(appOf(pathname))
    }
  }, [pathname])

  async function signIn() {
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) notify('Гримуар тебя не узнал. Проверь почту и слово-ключ', 'error', error.code === 'invalid_credentials' ? undefined : error.message)
    setBusy(false)
  }

  async function google() {
    setGoogleBusy(true)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirect() } })
    if (error) {
      notify('Не удалось начать вход через Google', 'error', error.message)
      setGoogleBusy(false)
    }
  }

  return (
    <Shell>
      <Stack gap="4">
        <Stack
          as="form"
          gap="3"
          onSubmit={(e) => {
            e.preventDefault()
            void signIn()
          }}
        >
          <Field label="Почта">
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Слово-ключ">
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" mt="1" loading={busy} loadingText="Узнаю тебя…" disabled={!email.trim() || !password}>
            Представиться
          </Button>
          <Text fontSize="xs" color="fg.subtle" textAlign="center">
            Новых ведьм гримуар запомнит сам
          </Text>
        </Stack>
        <Flex align="center" gap="3">
          <Separator flex="1" />
          <Text fontSize="xs" color="fg.subtle">
            или
          </Text>
          <Separator flex="1" />
        </Flex>
        <Center>
          <IconButton
            size="lg"
            variant="outline"
            rounded="full"
            aria-label="Войти через Google"
            title="Войти через Google"
            onClick={google}
            loading={googleBusy}
          >
            <FcGoogle />
          </IconButton>
        </Center>
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
  const [gender, setGender] = useState<'f' | 'm'>()
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
    dispatch(A.updateMeta({ gender }))
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
        <Field label="Пол">
          <Chips value={gender} onChange={(v) => setGender(v as 'f' | 'm' | undefined)} options={[
            { value: 'f', label: 'женский' },
            { value: 'm', label: 'мужской' },
          ]} />
        </Field>
        <Button onClick={save} disabled={!valid || free !== true || !name.trim() || !gender} loading={busy}>
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
