// «Шаблоны» as a page, from «Ещё»: the same list as the dialog in the book of deeds.
import { Text } from '@chakra-ui/react'
import { SpellList } from '../../components/grimoire/Spells'
import { PageHeader } from '../../components/ui'
import { words } from '../../grimoire/selectors'
import { useAppSelector } from '../../store'

export default function SpellsPage() {
  const meta = useAppSelector((s) => s.grimoire.meta)
  return (
    <>
      <PageHeader title={words(meta).spells} />
      <Text fontSize="sm" color="fg.muted" mb="4">
        Шаблон — дело, квест или цепочка, которые повторяются. Когда называешь новое дело, подходящие шаблоны подсказываются сами.
      </Text>
      <SpellList />
    </>
  )
}
