import { Box, Flex, Stack, Text } from '@chakra-ui/react'
import { fmt, fmtDateTime } from '../lib/calc'
import { unitLabel } from '../lib/labels'
import { useData } from '../store'
import type { StageEntry } from '../types'

/** Timeline "этап — дата — комментарий" with what each step took from stock. */
export function History({ entries, labels }: { entries: StageEntry[]; labels: Record<string, string> }) {
  const d = useData()
  return (
    <Stack gap="0">
      {entries.map((e, i) => (
        <Flex key={i} gap="3">
          <Stack align="center" gap="0">
            <Box w="2.5" h="2.5" mt="1.5" borderRadius="full" bg={e.stage === 'defect' ? 'red.400' : 'emerald.400'} />
            {i < entries.length - 1 && <Box w="1px" flex="1" bg="border.emphasized" />}
          </Stack>
          <Box pb="4" flex="1">
            <Text fontWeight="medium" fontSize="sm">
              {labels[e.stage] ?? e.stage}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              {fmtDateTime(e.date)}
            </Text>
            {e.comment && <Text fontSize="sm">{e.comment}</Text>}
            {e.consumption.length > 0 && (
              <Text fontSize="xs" color="fg.subtle">
                списано:{' '}
                {e.consumption
                  .map((c) => {
                    if (c.decorId) return `${c.decorId} × ${fmt(c.qty)}`
                    const m = c.materialId ? d.materials[c.materialId] : undefined
                    return m ? `${m.name} ${fmt(c.qty)} ${unitLabel[m.unit]}` : ''
                  })
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            )}
          </Box>
        </Flex>
      ))}
    </Stack>
  )
}
