// Templates suggested while a deed is named: from two letters on, up to six whose name has the typed
// words, the most used first. A pick hands the template back; the form decides what to do with it.
import { Box, HStack, Text } from '@chakra-ui/react'
import type { Spell } from '../../grimoire/types'
import { useAppSelector } from '../../store'
import { spellKind } from './Spells'

export function matchSpells(spells: Spell[], typed: string) {
  const q = typed.trim().toLowerCase()
  if (q.length < 2) return []
  return spells
    .filter((sp) => sp.title.toLowerCase().includes(q) && sp.title.toLowerCase() !== q)
    .sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0) || Number(!a.title.toLowerCase().startsWith(q)) - Number(!b.title.toLowerCase().startsWith(q)) || a.title.localeCompare(b.title, 'ru'))
    .slice(0, 6)
}

export function SpellHints({ typed, onPick }: { typed: string; onPick: (sp: Spell) => void }) {
  const spells = useAppSelector((s) => s.grimoire.meta.spells ?? [])
  const found = matchSpells(spells, typed)
  if (!found.length) return null
  return (
    <HStack gap="1.5" wrap="wrap" aria-label="Шаблоны">
      <Text fontSize="xs" color="fg.muted">
        Из шаблонов:
      </Text>
      {found.map((sp) => (
        <Box
          as="button"
          key={sp.id}
          px="2.5"
          py="1"
          borderRadius="full"
          borderWidth="1px"
          borderColor="border.emphasized"
          fontSize="sm"
          cursor="pointer"
          _hover={{ bg: 'bg.muted' }}
          onClick={() => onPick(sp)}
        >
          {sp.title}
          {sp.steps.length > 0 && (
            <Text as="span" color="fg.muted" fontSize="xs">
              {' '}
              · {spellKind(sp)}
            </Text>
          )}
        </Box>
      ))}
    </HStack>
  )
}
