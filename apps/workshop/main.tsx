import { registerSW } from 'virtual:pwa-register'
import { boot } from '../../src/boot'
import { catchInvite } from '../../src/components/Invites'
import WorkshopApp from '../../src/entries/WorkshopApp'
import { withStore } from '../../src/entries/withStore'

registerSW({ immediate: true })
// An invite link (/workshop/invite/…) is remembered before the sign-in, which may leave the page.
catchInvite()
boot(<WorkshopApp />, withStore)
