// «Список проектов»: the projects of this site as cards — open one, or install it on a phone as its
// own app with its own icon. The grimoire's card is seen only by a witch.
import { Box, Button, Container, Flex, Heading, HStack, Image, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuArrowLeft, LuDownload, LuExternalLink } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { MoonPhases } from '../components/Magic'
import { appOf, apps, chooseForInstall, isIOS, isStandalone, promptInstall, useInstallPrompt, type AppId } from '../lib/apps'
import { useIsWitch } from '../store'

const about: Record<AppId, { text: string; icon: string }> = {
  workshop: { text: 'Производственный журнал: подсвечники, свечи, склад, формы, отзывы получателей.', icon: './icon-192.png' },
  grimoire: { text: 'Дела и ритуалы, колесо года, зеркало эмоций, бестиарий и сундук желаний.', icon: './icon-grimoire-192.png' },
}

function AppCard({ id }: { id: AppId }) {
  const navigate = useNavigate()
  const prompt = useInstallPrompt()
  const [hint, setHint] = useState(false)
  const chosen = appOf('/apps') === id && new URLSearchParams(window.location.search).has('app')
  const a = apps[id]
  const install = async () => {
    // iPhone has no install prompt: the app is added from the share menu on its own page.
    if (isIOS()) return setHint(!hint)
    if (chosen && prompt) return void (await promptInstall())
    if (!chosen) return chooseForInstall(id)
    setHint(true)
  }
  return (
    <Box p="5" borderRadius="l3" borderWidth="1px" borderColor={chosen ? 'ember.600' : 'border'} bg="bg.subtle">
      <Flex gap="4" align="center" mb="3">
        <Image src={about[id].icon} alt="" w="56px" h="56px" borderRadius="14px" flexShrink={0} />
        <Box>
          <Heading size="xl" fontWeight="semibold" color="ember.50">
            {a.name}
          </Heading>
          <Text fontSize="sm" color="fg.muted">
            {about[id].text}
          </Text>
        </Box>
      </Flex>
      <HStack gap="2" wrap="wrap">
        <Button size="sm" onClick={() => navigate(a.start)}>
          <LuExternalLink /> Открыть
        </Button>
        {!isStandalone() && (
          <Button size="sm" variant="outline" onClick={install}>
            <LuDownload /> {isIOS() ? 'Как установить' : chosen && prompt ? 'Установить' : 'Установить на телефон'}
          </Button>
        )}
      </HStack>
      {hint && (
        <Text fontSize="sm" color="fg.muted" mt="3">
          {isIOS()
            ? `Нажми «Открыть», затем в Safari «Поделиться» → «На экран „Домой“». На экране появится «${a.short}» со своей иконкой.`
            : `Браузер не предложил установку сам. Открой меню браузера (⋮) → «Установить приложение» или «Добавить на главный экран». Если «${a.short}» уже установлен, он есть среди приложений.`}
        </Text>
      )}
    </Box>
  )
}

export default function Apps() {
  const navigate = useNavigate()
  const witch = useIsWitch()
  const list: AppId[] = witch ? ['workshop', 'grimoire'] : ['workshop']
  return (
    <Container maxW="760px" px="4" py={{ base: '6', md: '10' }}>
      <Stack gap="6">
        <Flex align="center" gap="3">
          <Button variant="ghost" size="sm" px="2" aria-label="Назад" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
            <LuArrowLeft />
          </Button>
          <Heading size={{ base: '2xl', md: '4xl' }} fontWeight="semibold" color="ember.50">
            Список проектов
          </Heading>
        </Flex>
        <MoonPhases size={12} gap="2.5" color="ember.200" />
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
          {list.map((id) => (
            <AppCard key={id} id={id} />
          ))}
        </SimpleGrid>
        <Text fontSize="xs" color="fg.subtle">
          Каждый проект ставится на телефон отдельным приложением со своей иконкой. Данные общие: вход один, всё синхронизируется.
        </Text>
      </Stack>
    </Container>
  )
}
