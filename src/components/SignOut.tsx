import { Box, Flex, Text } from '@chakra-ui/react'
import { LuChevronRight, LuLogOut } from 'react-icons/lu'
import { signOut } from '../lib/sync'

/** «Выйти» at the end of a side menu, looking like the links above it. */
export function SignOutSideLink() {
  return (
    <Flex as="button" w="100%" textAlign="start" cursor="pointer" align="center" gap="3" px="3" py="2" borderRadius="l2" color="fg.muted" _hover={{ bg: 'bg.muted', color: 'fg' }} onClick={() => void signOut()}>
      <Box fontSize="lg">
        <LuLogOut />
      </Box>
      <Text flex="1">Выйти</Text>
    </Flex>
  )
}

/** «Выйти» at the end of a list on the «Ещё» pages, for phones. */
export function SignOutRow({ icon }: { icon?: boolean }) {
  return (
    <Flex as="button" w="100%" textAlign="start" cursor="pointer" align="center" gap="3" px="4" py="3" borderBottomWidth="1px" borderColor="border.muted" _hover={{ bg: 'bg.muted' }} onClick={() => void signOut()}>
      {icon && (
        <Box color="emerald.400" fontSize="lg">
          <LuLogOut />
        </Box>
      )}
      <Text flex="1">Выйти</Text>
      <Box color="fg.subtle">
        <LuChevronRight />
      </Box>
    </Flex>
  )
}
