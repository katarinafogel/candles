// /ui — a showcase of the components used in the project: a menu of sections on the left,
// the chosen section on the right.
import { Box, Flex, Grid, Heading, Stack, Text } from '@chakra-ui/react'
import { useState, type ReactNode } from 'react'
import { notify } from '@shared/components/ui'
import { Icon, iconSets } from '@shared/icons'

interface Section {
  id: string
  label: string
  render: () => ReactNode
}

const sections: Section[] = [{ id: 'icons', label: 'Иконки', render: () => <Icons /> }]

function Icons() {
  const copy = (name: string) => {
    navigator.clipboard.writeText(name).then(
      () => notify(`Скопировано: ${name}`),
      () => notify('Не удалось скопировать', 'error'),
    )
  }
  return (
    <Stack gap="8">
      {iconSets.map((set) => (
        <Box key={set.id}>
          <Text mb="3" color="fg.muted">
            {set.link ? (
              <a href={set.link} target="_blank" rel="noreferrer">
                {set.label}
              </a>
            ) : (
              set.label
            )}{' '}
            · {set.names.length}
          </Text>
          <IconGrid names={set.names} copy={copy} />
        </Box>
      ))}
    </Stack>
  )
}

function IconGrid({ names, copy }: { names: string[]; copy: (name: string) => void }) {
  return (
    <Grid templateColumns="repeat(auto-fill, minmax(112px, 1fr))" gap="0" borderTopWidth="1px" borderLeftWidth="1px" borderColor="border">
      {names.map((name) => (
        <Stack key={name} align="center" gap="2" p="4" borderRightWidth="1px" borderBottomWidth="1px" borderColor="border">
          <Box color="ember.200">
            <Icon name={name} size={28} />
          </Box>
          <Text
            as="button"
            fontSize="xs"
            color="fg.muted"
            textAlign="center"
            wordBreak="break-word"
            userSelect="all"
            cursor="copy"
            _hover={{ color: 'fg' }}
            onClick={() => copy(name)}
          >
            {name}
          </Text>
        </Stack>
      ))}
    </Grid>
  )
}

export default function UiKit() {
  const [active, setActive] = useState(sections[0].id)
  const section = sections.find((s) => s.id === active) ?? sections[0]
  return (
    <Flex minH="100dvh" direction={{ base: 'column', md: 'row' }}>
      <Stack as="nav" gap="1" p="4" w={{ md: '220px' }} flexShrink={0} borderRightWidth={{ md: '1px' }} borderBottomWidth={{ base: '1px', md: '0' }} borderColor="border">
        <Text fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wider" mb="2">
          UI-кит
        </Text>
        {sections.map((s) => (
          <Box
            key={s.id}
            as="button"
            textAlign="left"
            px="3"
            py="2"
            rounded="md"
            bg={s.id === active ? 'emerald.subtle' : undefined}
            color={s.id === active ? 'fg' : 'fg.muted'}
            _hover={{ color: 'fg' }}
            onClick={() => setActive(s.id)}
          >
            {s.label}
          </Box>
        ))}
      </Stack>
      <Box flex="1" p={{ base: '4', md: '8' }} minW="0">
        <Heading size="2xl" mb="6" color="ember.50">
          {section.label}
        </Heading>
        {section.render()}
      </Box>
    </Flex>
  )
}
