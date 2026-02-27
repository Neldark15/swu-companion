import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { HomePage } from './features/home/HomePage'
import { PlayPage } from './features/play/PlayPage'
import { TrackerPage } from './features/play/TrackerPage'
import { SavedMatchesPage } from './features/play/SavedMatchesPage'
import { EventsPage } from './features/events/EventsPage'
import { JoinEventPage } from './features/events/JoinEventPage'
import { TournamentListPage } from './features/events/TournamentListPage'
import { TournamentSetupPage } from './features/events/TournamentSetupPage'
import { TournamentLivePage } from './features/events/TournamentLivePage'
import { CardsPage } from './features/cards/CardsPage'
import { CardDetailPage } from './features/cards/CardDetailPage'
import { DeckListPage } from './features/decks/DeckListPage'
import { DeckBuilderPage } from './features/decks/DeckBuilderPage'
import { EventLobbyPage } from './features/events/EventLobbyPage'
import { CreateEventPage } from './features/events/CreateEventPage'
import { ManageNewsPage } from './features/home/ManageNewsPage'
import { UtilitiesPage } from './features/utilities/UtilitiesPage'
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
          <Route path="/play/saved" element={<SavedMatchesPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/join" element={<JoinEventPage />} />
          <Route path="/events/create" element={<CreateEventPage />} />
          <Route path="/events/tournament" element={<TournamentListPage />} />
          <Route path="/events/tournament/new" element={<TournamentSetupPage />} />
          <Route path="/events/tournament/:id" element={<TournamentLivePage />} />
          <Route path="/events/lobby/:code" element={<EventLobbyPage />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/cards/:id" element={<CardDetailPage />} />
          <Route path="/decks" element={<DeckListPage />} />
          <Route path="/decks/:id" element={<DeckBuilderPage />} />
          <Route path="/news/manage" element={<ManageNewsPage />} />
          <Route path="/utilities" element={<UtilitiesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/*" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
