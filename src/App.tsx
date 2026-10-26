import { Outlet, Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import GrimoireLayout from './components/grimoire/GrimoireLayout'
import Layout from './components/Layout'
import CandlePage from './pages/CandlePage'
import Candles from './pages/Candles'
import Decor from './pages/Decor'
import Book from './pages/grimoire/Book'
import GrimoireMore from './pages/grimoire/More'
import Rituals from './pages/grimoire/Rituals'
import Scroll from './pages/grimoire/Scroll'
import Wheel from './pages/grimoire/Wheel'
import HolderPage from './pages/HolderPage'
import Holders from './pages/Holders'
import Home from './pages/Home'
import Instructions from './pages/Instructions'
import MaterialPage from './pages/MaterialPage'
import MoldPage from './pages/MoldPage'
import Molds from './pages/Molds'
import More from './pages/More'
import NewMix from './pages/NewMix'
import NewPour from './pages/NewPour'
import People from './pages/People'
import PrintQr from './pages/PrintQr'
import PublicCandle from './pages/PublicCandle'
import Reviews from './pages/Reviews'
import Settings from './pages/Settings'
import Stock from './pages/Stock'

export default function App() {
  return (
    <Routes>
      {/* The recipient's page lives outside the master layout. */}
      <Route path="/c/:slug/:id" element={<PublicCandle />} />
      <Route
        element={
          <AuthGate>
            <Outlet />
          </AuthGate>
        }
      >
      <Route path="/print" element={<PrintQr />} />
      {/* The grimoire: only for the witch role (GrimoireLayout sends everyone else to the workshop). */}
      <Route path="/g" element={<GrimoireLayout />}>
        <Route index element={<Scroll />} />
        <Route path="book" element={<Book />} />
        <Route path="rituals" element={<Rituals />} />
        <Route path="wheel" element={<Wheel />} />
        <Route path="more" element={<GrimoireMore />} />
        <Route path="*" element={<Scroll />} />
      </Route>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="holders" element={<Holders />} />
        <Route path="holders/:id" element={<HolderPage />} />
        <Route path="candles" element={<Candles />} />
        <Route path="candles/:id" element={<CandlePage />} />
        <Route path="mix/new" element={<NewMix />} />
        <Route path="pour/new" element={<NewPour />} />
        <Route path="molds" element={<Molds />} />
        <Route path="molds/:id" element={<MoldPage />} />
        <Route path="stock" element={<Stock />} />
        <Route path="stock/:id" element={<MaterialPage />} />
        <Route path="decor" element={<Decor />} />
        <Route path="people" element={<People />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="instructions" element={<Instructions />} />
        <Route path="settings" element={<Settings />} />
        <Route path="more" element={<More />} />
        <Route path="*" element={<Home />} />
      </Route>
      </Route>
    </Routes>
  )
}
