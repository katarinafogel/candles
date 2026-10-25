import { Text } from '@chakra-ui/react'
import { avgUse, fmt, stockOf } from '../lib/calc'
import { useData } from '../store'

/** "Пластификатора хватит на этот замес и ещё примерно на 2". */
export function StockHint({ materialId, need }: { materialId?: string; need: number }) {
  const d = useData()
  const m = materialId ? d.materials[materialId] : undefined
  if (!m) return null
  const left = stockOf(m) - need
  const per = avgUse(m) ?? need
  const more = per > 0 ? Math.floor(left / per) : undefined
  return (
    <Text fontSize="xs" color={left < 0 ? 'red.400' : more != null && more < 3 ? 'orange.300' : 'fg.muted'}>
      {left < 0
        ? `Не хватает ${fmt(-left)} — остаток уйдёт в минус`
        : `Хватит на это${more != null ? ` и ещё примерно на ${more}` : ''} · останется ${fmt(left)}`}
    </Text>
  )
}
