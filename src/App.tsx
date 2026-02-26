import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { HomePage } from './features/home/HomePage'
import { PlayPage } from './features/play/PlayPage'
import { TrackerPage } from './features/play/TrackerPage'
import { EventsPage } from './features/events/EventsPage'
import { JoinEventPage } from './features/events/JoinEventPage'
import { CardsPage } from './features/cards/CardsPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { SettingsPage } from './features/settings/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/play" element={<PlayPage />} />
          <Route path="/play/tracker/:mode" element={<TrackerPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/join" element={<JoinEventPage />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/*" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
