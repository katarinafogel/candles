// One switch, shown in both apps' settings to whoever has both: the bestiary's people and the
// workshop's recipients can be tied together (cards show the candles given, lists link across).
import { Stack, Text } from '@chakra-ui/react'
import { Check } from '@shared/components/ui'
import { grimoireActions as A } from '@grimoire-core/store/grimoireSlice'
import { useAppDispatch, useAppSelector, useBothApps } from '../store'

export function LinkPeopleSetting() {
  const dispatch = useAppDispatch()
  const on = useAppSelector((s) => !!s.grimoire.meta.linkWorkshopPeople)
  const both = useBothApps()
  if (!both) return null
  return (
    <Stack gap="1">
      <Check checked={on} onChange={(v) => dispatch(A.updateMeta({ linkWorkshopPeople: v || undefined }))}>
        Связывать людей бестиария и мастерской
      </Check>
      <Text fontSize="xs" color="fg.muted">
        В карточке бестиария можно указать, кто это в мастерской, — и там появятся подаренные свечи. В «Людях» мастерской появится ссылка в бестиарий.
      </Text>
    </Stack>
  )
}
