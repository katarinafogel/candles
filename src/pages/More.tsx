import { Box, Button, Flex, Stack, Text } from '@chakra-ui/react'
import { LuChevronRight, LuDownload } from 'react-icons/lu'
import { Link as RouterLink } from 'react-router-dom'
import { moreItems } from '../components/Layout'
import { PageHeader } from '../components/ui'
import { downloadBackup } from '../lib/backup'
import { useAppDispatch, useData } from '../store'
import { actions } from '../store/dataSlice'

export default function More() {
  const d = useData()
  const dispatch = useAppDispatch()
  const unread = Object.values(d.reviews).filter((r) => !r.read).length
  return (
    <>
      <PageHeader title="Ещё" />
      <Stack gap="0" borderWidth="1px" borderColor="border" borderRadius="l3" bg="bg.subtle" overflow="hidden" mb="4">
        {moreItems.map((i) => (
          <RouterLink key={i.to} to={i.to}>
            <Flex align="center" gap="3" px="4" py="3" borderBottomWidth="1px" borderColor="border.muted" _hover={{ bg: 'bg.muted' }}>
              <Box color="emerald.400" fontSize="lg">
                {i.icon}
              </Box>
              <Text flex="1">{i.label}</Text>
              {i.to === '/reviews' && unread > 0 && (
                <Box bg="emerald.solid" color="emerald.contrast" borderRadius="full" px="2" fontSize="xs" fontWeight="bold">
                  {unread}
                </Box>
              )}
              <Box color="fg.subtle">
                <LuChevronRight />
              </Box>
            </Flex>
          </RouterLink>
        ))}
      </Stack>
      <Button
        w="100%"
        variant="outline"
        onClick={async () => {
          await downloadBackup(d)
          dispatch(actions.markBackup(new Date().toISOString()))
        }}
      >
        <LuDownload /> Скачать бэкап
      </Button>
    </>
  )
}
