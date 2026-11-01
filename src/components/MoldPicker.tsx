import { Box, CloseButton, Flex, Heading, HStack, IconButton, Input, InputGroup, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuMinus, LuPlus, LuSearch } from 'react-icons/lu'
import { moldPurposeLabel, moldPurposePlural } from '../lib/labels'
import { normalize } from '../lib/selectors'
import type { Mold, MoldPurpose } from '../types'
import { Chips, LeafMark } from './ui'

/** Picks forms with a count each. `limitCopies` is for casting: a form can't be filled more times than there are copies of it. */
export function MoldPicker({
  molds,
  kinds,
  counts,
  onChange,
  limitCopies,
}: {
  molds: Mold[]
  kinds: MoldPurpose[]
  counts: Record<string, number>
  onChange: (counts: Record<string, number>) => void
  limitCopies?: boolean
}) {
  const [kind, setKind] = useState<MoldPurpose | 'all'>('all')
  const [query, setQuery] = useState('')
  const q = normalize(query.trim())
  // A picked form stays in the list whatever the filter, so it can be seen and taken back.
  const visible = molds.filter((m) => counts[m.id] || ((kind === 'all' || m.purpose === kind) && (!q || normalize(m.name).includes(q))))
  return (
    <>
      <Flex justify="space-between" align="center" gap="2" wrap="wrap" mb="3">
        <Heading size="xl" fontWeight="semibold" color="ember.100">
          Формы
        </Heading>
        {molds.length > 0 && (
          <Chips
            value={kind}
            onChange={(v) => setKind((v as typeof kind) ?? 'all')}
            options={[{ value: 'all', label: 'Все' }, ...kinds.map((p) => ({ value: p, label: moldPurposePlural[p] }))]}
          />
        )}
      </Flex>
      {!molds.length && (
        <Text color="fg.muted" fontSize="sm">
          Подходящих форм нет. Добавьте их в разделе «Формы».
        </Text>
      )}
      {molds.length > 0 && (
        <InputGroup mb="3" startElement={<LuSearch />} endElement={query && <CloseButton size="xs" onClick={() => setQuery('')} aria-label="Очистить" />}>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по названию" />
        </InputGroup>
      )}
      {molds.length > 0 && kind !== 'all' && !molds.some((m) => m.purpose === kind) && (
        <Text color="fg.muted" fontSize="sm" mb="2">
          Нет форм типа «{moldPurposeLabel[kind]}» в работе. Поменять тип или вернуть форму из архива можно в разделе «Формы».
        </Text>
      )}
      {q && !visible.length && (
        <Text color="fg.muted" fontSize="sm" mb="2">
          Ничего не найдено.
        </Text>
      )}
      <Stack gap="1" maxH="296px" overflowY="auto">
        {visible.map((m) => {
          const n = counts[m.id] ?? 0
          const max = limitCopies ? m.copies : Infinity
          const set = (v: number) => onChange({ ...counts, [m.id]: Math.max(0, Math.min(max, v)) })
          return (
            <Flex
              key={m.id}
              align="center"
              gap="3"
              p="2"
              borderRadius="l2"
              bg={n ? 'emerald.subtle' : undefined}
              cursor="pointer"
              onClick={() => set(n ? 0 : 1)}
            >
              <Box flex="1">
                <HStack gap="2">
                  <Text fontWeight={n ? 'semibold' : 'normal'}>{m.name}</Text>
                  {m.rating && (
                    <Text fontSize="xs" color="ember.300">
                      {'★'.repeat(m.rating)}
                    </Text>
                  )}
                </HStack>
                <Text fontSize="xs" color="fg.muted">
                  {m.waterVolumeMl} мл
                  {m.purpose !== 'holder' ? ` · ${moldPurposeLabel[m.purpose]}` : ''}
                  {limitCopies && m.copies > 1 ? ` · копий: ${m.copies}` : ''}
                </Text>
              </Box>
              {max > 1 && n > 0 ? (
                <HStack onClick={(e) => e.stopPropagation()}>
                  <IconButton size="xs" variant="outline" aria-label="меньше" onClick={() => set(n - 1)}>
                    <LuMinus />
                  </IconButton>
                  <Text w="5" textAlign="center">
                    {n}
                  </Text>
                  <IconButton size="xs" variant="outline" aria-label="больше" onClick={() => set(n + 1)}>
                    <LuPlus />
                  </IconButton>
                </HStack>
              ) : (
                <LeafMark on={n > 0} />
              )}
            </Flex>
          )
        })}
      </Stack>
    </>
  )
}
