// «Другие проекты»: the showcase's front page. For now a stub with the two apps;
// later it gets the master's own words and pictures. An admin also sees the component showcase.
import { Box, Container, Flex, Heading, Image, Stack, Text } from '@chakra-ui/react'
import { useEffect, useState, type ReactNode } from 'react'
import { LuLayers } from 'react-icons/lu'
import { MoonPhases } from '@shared/components/Magic'
import { supabase } from '@shared/lib/supabase'

/**
 * True for a signed-in admin. The showcase has no store: it reads the shared session and asks
 * user_roles itself; signed out, offline or without the role — false. The page behind the link
 * checks the role on its own anyway (AdminOnly in the workshop).
 */
function useIsAdmin() {
  const [admin, setAdmin] = useState(false)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const id = data.session?.user.id
      if (!id) return
      const { data: rows } = await supabase.from('user_roles').select('role').eq('user_id', id).eq('role', 'admin')
      if (alive && rows?.length) setAdmin(true)
    })().catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return admin
}

type Project = { href: string; icon: string | ReactNode; name: string; text: string }

const adminProjects: Project[] = [
  { href: '/workshop/dev/components', icon: <LuLayers />, name: 'Витрина компонентов', text: 'Общие компоненты всех трёх приложений — видно только админу.' },
]

const projects: Project[] = [
  { href: '/workshop/', icon: '/workshop/icon.svg', name: 'Мастерская свечей', text: 'Журнал заливки: подсвечники, свечи, замесы, склад и отзывы получателей.' },
  { href: '/grimoire/', icon: '/grimoire/icon.svg', name: 'Гримуар дел', text: 'Дела, ритуалы и колесо года — список дел, который не давит.' },
]

export default function ProjectsPage() {
  const admin = useIsAdmin()
  const list = admin ? [...projects, ...adminProjects] : projects
  return (
    <Container maxW="640px" py="12" px="5">
      <Stack gap="8">
        <Stack gap="3" align="center" textAlign="center">
          <MoonPhases size={12} gap="2.5" color="ember.200" />
          <Heading size="3xl" fontWeight="semibold">
            Другие проекты
          </Heading>
          <Text color="fg.muted">Здесь скоро будет больше. Пока — то, что уже работает.</Text>
        </Stack>
        <Stack gap="3">
          {list.map((p) => (
            <Box asChild key={p.href} borderWidth="1px" borderColor="border" borderRadius="xl" p="4" _hover={{ bg: 'bg.muted' }}>
              <a href={p.href}>
                <Flex gap="4" align="center">
                  {typeof p.icon === 'string' ? (
                    <Image src={p.icon} alt="" boxSize="14" borderRadius="xl" />
                  ) : (
                    <Flex boxSize="14" flexShrink={0} align="center" justify="center" borderRadius="xl" bg="bg.muted" color="ember.300" fontSize="2xl">
                      {p.icon}
                    </Flex>
                  )}
                  <Box>
                    <Text fontWeight="semibold">{p.name}</Text>
                    <Text fontSize="sm" color="fg.muted">
                      {p.text}
                    </Text>
                  </Box>
                </Flex>
              </a>
            </Box>
          ))}
        </Stack>
        <Text fontSize="xs" color="fg.subtle" textAlign="center">
          <a href="/privacy">Политика конфиденциальности</a>
        </Text>
      </Stack>
    </Container>
  )
}
