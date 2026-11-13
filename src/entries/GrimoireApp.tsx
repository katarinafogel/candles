import { lazy, Suspense } from 'react'
import { PageLoading } from '../components/PageLoading'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthGate } from '../components/AuthGate'
import { InviteTaker } from '../components/Invites'
import { NotFound } from '../components/NotFound'
import GrimoireLayout from '../components/grimoire/GrimoireLayout'
import Book from '../pages/grimoire/Book'
const Mirror = lazy(() => import('../pages/grimoire/Mirror'))
const MirrorEntry = lazy(() => import('../pages/grimoire/MirrorEntry'))
import Bestiary, { BestiaryCard } from '../pages/grimoire/Bestiary'
const ProjectBook = lazy(() => import('../pages/grimoire/ProjectBook'))
const Projects = lazy(() => import('../pages/grimoire/Projects'))
const GrimoireMore = lazy(() => import('../pages/grimoire/More'))
const Rituals = lazy(() => import('../pages/grimoire/Rituals'))
import Scroll from '../pages/grimoire/Scroll'
const Wheel = lazy(() => import('../pages/grimoire/Wheel'))
const GrimoireCalendar = lazy(() => import('../pages/grimoire/Calendar'))
const Wishes = lazy(() => import('../pages/grimoire/Wishes'))
const Jars = lazy(() => import('../pages/grimoire/Jars'))
const Events = lazy(() => import('../pages/grimoire/Events'))
const Tarot = lazy(() => import('../pages/grimoire/Tarot'))
const Goals = lazy(() => import('../pages/grimoire/Goals'))
const Notes = lazy(() => import('../pages/grimoire/Notes'))
const SpellsPage = lazy(() => import('../pages/grimoire/SpellsPage'))
import { useWorkshopSync, WorkshopRunner } from '../components/grimoire/WorkshopRun'
import { GoApp } from '../lib/apps'

// The grimoire at /grimoire/: deeds, rituals, the wheel and the rest, for the witch role.
export default function GrimoireApp() {
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
          <Route path="/invite/:token" element={<Navigate to="/" replace />} />
          <Route path="/apps" element={<GoApp app="showcase" to="/projects" />} />
          {/* Only for the witch role: GrimoireLayout sends everyone else to the workshop or says no. */}
          <Route element={<GrimoireLayout />}>
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
            <Route path="*" element={<NotFound home="/" homeLabel="В гримуар" />} />
          </Route>
        </Route>
      </Routes>
      </Suspense>
    </>
  )
}
