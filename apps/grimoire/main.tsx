import { registerSW } from 'virtual:pwa-register'
import { boot } from '../../src/boot'
import { catchInvite } from '../../src/components/Invites'
import GrimoireApp from '../../src/entries/GrimoireApp'
import { withStore } from '../../src/entries/withStore'

registerSW({ immediate: true })
// An invite link (/grimoire/invite/…) is remembered before the sign-in, which may leave the page.
catchInvite()
boot(<GrimoireApp />, withStore)
