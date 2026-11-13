import { Navigate, Route, Routes } from 'react-router-dom'
import { NotFound } from '../components/NotFound'
import PublicCandle from '../pages/PublicCandle'
import ProjectsPage from '../pages/showcase/Projects'
import ShortLink from '../pages/showcase/ShortLink'

// The showcase at the site's root: open to everyone, no sign-in, nothing personal in its code.
export default function ShowcaseApp() {
  return (
    <Routes>
      <Route index element={<Navigate to="/projects" replace />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/candles-review/:slug/:id" element={<PublicCandle />} />
      <Route path="/candles-review/:slug/:id/:token" element={<PublicCandle />} />
      <Route path="/r/:code" element={<ShortLink />} />
      <Route path="*" element={<NotFound home="/projects" homeLabel="К проектам" />} />
    </Routes>
  )
}
