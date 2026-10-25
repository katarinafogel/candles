import { ChakraProvider } from '@chakra-ui/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { HashRouter } from 'react-router-dom'
import { PersistGate } from 'redux-persist/integration/react'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { Toaster } from './components/ui'
import { persistor, store } from './store'
import { system } from './theme'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          {/* HashRouter: GitHub Pages would answer 404 to deep links from QR codes otherwise. */}
          <HashRouter>
            <App />
          </HashRouter>
        </PersistGate>
      </Provider>
      <Toaster />
    </ChakraProvider>
  </StrictMode>,
)
