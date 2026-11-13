// While a page's code is on its way (pages load when first opened, so the apps start faster).
import { Center, Spinner } from '@chakra-ui/react'

export function PageLoading() {
  return (
    <Center py="20">
      <Spinner color="ember.300" />
    </Center>
  )
}
