import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthGate } from '../components/AuthGate'
import { InviteTaker } from '../components/Invites'
import { NotFound } from '../components/NotFound'
import GrimoireLayout from '../components/grimoire/GrimoireLayout'
import Book from '../pages/grimoire/Book'
import Mirror from '../pages/grimoire/Mirror'
import MirrorEntry from '../pages/grimoire/MirrorEntry'
import Bestiary, { BestiaryCard } from '../pages/grimoire/Bestiary'
import ProjectBook from '../pages/grimoire/ProjectBook'
import Projects from '../pages/grimoire/Projects'
import GrimoireMore from '../pages/grimoire/More'
import Rituals from '../pages/grimoire/Rituals'
import Scroll from '../pages/grimoire/Scroll'
import Wheel from '../pages/grimoire/Wheel'
import GrimoireCalendar from '../pages/grimoire/Calendar'
import Wishes from '../pages/grimoire/Wishes'
import Jars from '../pages/grimoire/Jars'
import Events from '../pages/grimoire/Events'
import Tarot from '../pages/grimoire/Tarot'
import Goals from '../pages/grimoire/Goals'
import Notes from '../pages/grimoire/Notes'
import SpellsPage from '../pages/grimoire/SpellsPage'
import { useWorkshopSync, WorkshopRunner } from '../components/grimoire/WorkshopRun'
import { GoApp } from '../lib/apps'

// The grimoire at /grimoire/: deeds, rituals, the wheel and the rest, for the witch role.
export default function GrimoireApp() {
  useWorkshopSync()
  return (
    <>
      <WorkshopRunner />
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
    </>
  )
}
