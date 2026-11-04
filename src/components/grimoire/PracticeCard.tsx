// A practice of the wheel as the same arcana card as a deed: silver like the deed it becomes,
// a sun for the wheel, ♡ in the corner when wanted; its buttons sit at the bottom of the card.
import { Box, HStack, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { LuSun } from 'react-icons/lu'
import type { WheelPractice } from '../../grimoire/types'
import { ArcanaCard } from '../ArcanaCard'

export function PracticeCard({ p, want, lines, actions }: { p: WheelPractice; want?: boolean; lines: ReactNode[]; actions: ReactNode }) {
  return (
    <ArcanaCard
      tone="silver"
      title={p.title}
      corner={want ? <Box as="span" title="хочу" fontSize="sm">♡</Box> : undefined}
      footer={actions}
    >
      <HStack gap="1.5" justify="center">
        <Box display="inline-flex" title="колесо года">
          <LuSun />
        </Box>
      </HStack>
      {lines.filter(Boolean).map((l, i) => (
        <Text key={i}>{l}</Text>
      ))}
    </ArcanaCard>
  )
}
