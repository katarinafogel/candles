// The app's sign and name for its own header: the same circle as its icon on the phone.
import { Flex, Image, Text } from '@chakra-ui/react'
import { APP, apps } from '../lib/apps'

export function AppMark({ size, compact }: { size: number; compact?: boolean }) {
  return (
    <Flex align="center" gap={compact ? '2' : '3'}>
      <Image src={`${import.meta.env.BASE_URL}mark.svg`} alt="" boxSize={`${size}px`} flexShrink={0} />
      <Text fontFamily="heading" fontWeight="semibold" fontSize={compact ? 'lg' : '2xl'} lineHeight="1" color="ember.100">
        {apps[APP].short}
      </Text>
    </Flex>
  )
}
