// Starting an app: theme, error catching and the router at the app's own address (BASE_URL).
// Workshop and grimoire also bring the store and their service worker (see entries/).
import { ChakraProvider } from '@chakra-ui/react'
import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary, installErrorCatcher } from './components/ErrorCatcher'
import { ConfirmHost, Toaster } from '@shared/components/ui'
import { system } from '@shared/theme'
import { installThemes } from '@shared/themes'

export function boot(app: ReactNode, wrap: (children: ReactNode) => ReactNode = (c) => c) {
  installErrorCatcher()
  installThemes()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ChakraProvider value={system}>
        {wrap(
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <ErrorBoundary>{app}</ErrorBoundary>
          </BrowserRouter>,
        )}
        <Toaster />
        <ConfirmHost />
      </ChakraProvider>
    </StrictMode>,
  )
}
