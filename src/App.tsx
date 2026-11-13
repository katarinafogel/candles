import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { InviteTaker } from './components/Invites'
import { Moved, NotFound } from './components/NotFound'
import GrimoireLayout from './components/grimoire/GrimoireLayout'
import Layout from './components/Layout'
import CandlePage from './pages/CandlePage'
import Candles from './pages/Candles'
import Decor from './pages/Decor'
import Book from './pages/grimoire/Book'
import Mirror from './pages/grimoire/Mirror'
import MirrorEntry from './pages/grimoire/MirrorEntry'
import Bestiary, { BestiaryCard } from './pages/grimoire/Bestiary'
import ProjectBook from './pages/grimoire/ProjectBook'
import Projects from './pages/grimoire/Projects'
import GrimoireMore from './pages/grimoire/More'
import Rituals from './pages/grimoire/Rituals'
import Scroll from './pages/grimoire/Scroll'
import Wheel from './pages/grimoire/Wheel'
import GrimoireCalendar from './pages/grimoire/Calendar'
import Wishes from './pages/grimoire/Wishes'
import Jars from './pages/grimoire/Jars'
import Events from './pages/grimoire/Events'
import Tarot from './pages/grimoire/Tarot'
import Goals from './pages/grimoire/Goals'
import Notes from './pages/grimoire/Notes'
import SpellsPage from './pages/grimoire/SpellsPage'
import HolderPage from './pages/HolderPage'
import Holders from './pages/Holders'
import Home from './pages/Home'
import Instructions from './pages/Instructions'
import MaterialPage from './pages/MaterialPage'
import MoldPage from './pages/MoldPage'
import { AddCandles, AddHolders, EditCandle, EditHolder } from './pages/ItemForms'
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
import Apps from './pages/Apps'
import UiKit from './pages/UiKit'
import { useAppManifest } from './lib/apps'
import { useWorkshopSync, WorkshopRunner } from './components/grimoire/WorkshopRun'

export default function App() {
  useAppManifest()
  useWorkshopSync()
  return (
    <>
    <WorkshopRunner />
    <Routes>
      {/* The recipient's page lives outside the master layout. */}
      <Route path="/c/:slug/:id" element={<PublicCandle />} />
      <Route path="/c/:slug/:id/:token" element={<PublicCandle />} />
      {/* The component showcase: no data, so no sign-in. */}
      <Route path="/ui" element={<UiKit />} />
      <Route
        element={
          <AuthGate>
            <InviteTaker />
            <Outlet />
          </AuthGate>
        }
      >
      {/* The invite's token is taken from the address at start (catchInvite); the page itself is the start page. */}
      <Route path="/invite/:token" element={<Navigate to="/" replace />} />
      <Route path="/print" element={<PrintQr />} />
      <Route path="/apps" element={<Apps />} />
      {/* The grimoire: only for the witch role (GrimoireLayout sends everyone else to the workshop). */}
      <Route path="/g" element={<GrimoireLayout />}>
        <Route index element={<Scroll />} />
        <Route path="book" element={<Book />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectBook />} />
        <Route path="rituals" element={<Rituals />} />
        <Route path="wheel" element={<Wheel />} />
        <Route path="calendar" element={<GrimoireCalendar />} />
        <Route path="mirror" element={<Mirror />} />
        <Route path="mirror/:id" element={<MirrorEntry />} />
        <Route path="people" element={<Bestiary />} />
        <Route path="people/:id" element={<BestiaryCard />} />
        <Route path="wishes" element={<Wishes />} />
        <Route path="jars" element={<Jars />} />
        <Route path="events" element={<Events />} />
        <Route path="tarot" element={<Tarot />} />
        <Route path="goals" element={<Goals />} />
        <Route path="notes" element={<Notes />} />
        <Route path="spells" element={<SpellsPage />} />
        <Route path="more" element={<GrimoireMore />} />
        <Route path="*" element={<NotFound home="/g" homeLabel="В гримуар" />} />
      </Route>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="holders" element={<Holders />} />
        <Route path="holders/new" element={<AddHolders />} />
        <Route path="holders/:id" element={<HolderPage />} />
        <Route path="holders/:id/edit" element={<EditHolder />} />
        <Route path="candles" element={<Candles />} />
        <Route path="candles/new" element={<AddCandles />} />
        <Route path="candles/:id" element={<CandlePage />} />
        <Route path="candles/:id/edit" element={<EditCandle />} />
        <Route path="mixes/new" element={<NewMix />} />
        <Route path="pours/new" element={<NewPour />} />
        {/* Old addresses, still in bookmarks. */}
        <Route path="mix/new" element={<Moved to="/mixes/new" />} />
        <Route path="pour/new" element={<Moved to="/pours/new" />} />
        <Route path="holders/add" element={<Moved to="/holders/new" />} />
        <Route path="candles/add" element={<Moved to="/candles/new" />} />
        <Route path="stock" element={<Moved to="/materials" />} />
        <Route path="stock/:id" element={<Moved to="/materials" keepTail />} />
        <Route path="molds" element={<Molds />} />
        <Route path="molds/:id" element={<MoldPage />} />
        <Route path="materials" element={<Stock />} />
        <Route path="materials/:id" element={<MaterialPage />} />
        <Route path="decor" element={<Decor />} />
        <Route path="people" element={<People />} />
        <Route path="people/:id" element={<People />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="instructions" element={<Instructions />} />
        <Route path="settings" element={<Settings />} />
        <Route path="more" element={<More />} />
        <Route path="*" element={<NotFound home="/" homeLabel="В мастерскую" />} />
      </Route>
      </Route>
    </Routes>
    </>
  )
}
