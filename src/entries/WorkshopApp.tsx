import { lazy, Suspense } from 'react'
import { PageLoading } from '../components/PageLoading'
import type { ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthGate } from '../components/AuthGate'
import { InviteTaker } from '../components/Invites'
import { NotFound } from '../components/NotFound'
import Layout from '../components/Layout'
const CandlePage = lazy(() => import('../pages/CandlePage'))
import Candles from '../pages/Candles'
const Decor = lazy(() => import('../pages/Decor'))
const HolderPage = lazy(() => import('../pages/HolderPage'))
import Holders from '../pages/Holders'
import Home from '../pages/Home'
const Instructions = lazy(() => import('../pages/Instructions'))
const MaterialPage = lazy(() => import('../pages/MaterialPage'))
const MoldPage = lazy(() => import('../pages/MoldPage'))
import { AddCandles, AddHolders, EditCandle, EditHolder } from '../pages/ItemForms'
const Molds = lazy(() => import('../pages/Molds'))
const More = lazy(() => import('../pages/More'))
const NewMix = lazy(() => import('../pages/NewMix'))
const NewPour = lazy(() => import('../pages/NewPour'))
const People = lazy(() => import('../pages/People'))
const PrintQr = lazy(() => import('../pages/PrintQr'))
const Reviews = lazy(() => import('../pages/Reviews'))
const Settings = lazy(() => import('../pages/Settings'))
const Stock = lazy(() => import('../pages/Stock'))
const UiKit = lazy(() => import('../pages/UiKit'))
import { useWorkshopSync, WorkshopRunner } from '../components/grimoire/WorkshopRun'
import { useIsAdmin } from '../store'
import { GoApp } from '../lib/apps'

// The workshop at /workshop/: the candle journal, for the master role.
export default function WorkshopApp() {
  useWorkshopSync()
  return (
    <>
      <WorkshopRunner />
      <Suspense fallback={<PageLoading />}>
      <Routes>
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
          <Route path="/apps" element={<GoApp app="showcase" to="/projects" />} />
          <Route path="/dev/components" element={<AdminOnly><UiKit /></AdminOnly>} />
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
      </Suspense>
    </>
  )
}

/** The component showcase is a tool for the one who builds the apps. */
function AdminOnly({ children }: { children: ReactNode }) {
  return useIsAdmin() ? children : <NotFound home="/" homeLabel="В мастерскую" />
}
