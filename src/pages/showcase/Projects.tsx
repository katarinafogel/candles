// «Другие проекты»: the showcase's front page. For now a stub with the two apps;
// later it gets the master's own words and pictures.
import { Box, Container, Flex, Heading, Image, Stack, Text } from '@chakra-ui/react'
import { MoonPhases } from '@shared/components/Magic'

const projects = [
  { href: '/workshop/', icon: '/workshop/icon.svg', name: 'Мастерская свечей', text: 'Журнал заливки: подсвечники, свечи, замесы, склад и отзывы получателей.' },
  { href: '/grimoire/', icon: '/grimoire/icon.svg', name: 'Гримуар дел', text: 'Дела, ритуалы и колесо года — список дел, который не давит.' },
]

export default function ProjectsPage() {
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
          {projects.map((p) => (
            <Box asChild key={p.href} borderWidth="1px" borderColor="border" borderRadius="xl" p="4" _hover={{ bg: 'bg.muted' }}>
              <a href={p.href}>
                <Flex gap="4" align="center">
                  <Image src={p.icon} alt="" boxSize="14" borderRadius="xl" />
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
