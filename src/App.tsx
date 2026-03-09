import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { Loader2 } from 'lucide-react'

// Lazy-loaded pages — each becomes its own chunk
const HomePage = lazy(() => import('./features/home/HomePage').then(m => ({ default: m.HomePage })))
const PlayPage = lazy(() => import('./features/play/PlayPage').then(m => ({ default: m.PlayPage })))
const TrackerPage = lazy(() => import('./features/play/TrackerPage').then(m => ({ default: m.TrackerPage })))
const SavedMatchesPage = lazy(() => import('./features/play/SavedMatchesPage').then(m => ({ default: m.SavedMatchesPage })))
const EventsPage = lazy(() => import('./features/events/EventsPage').then(m => ({ default: m.EventsPage })))
const JoinEventPage = lazy(() => import('./features/events/JoinEventPage').then(m => ({ default: m.JoinEventPage })))
const TournamentListPage = lazy(() => import('./features/events/TournamentListPage').then(m => ({ default: m.TournamentListPage })))
const TournamentSetupPage = lazy(() => import('./features/events/TournamentSetupPage').then(m => ({ default: m.TournamentSetupPage })))
const TournamentLivePage = lazy(() => import('./features/events/TournamentLivePage').then(m => ({ default: m.TournamentLivePage })))
const CardsPage = lazy(() => import('./features/cards/CardsPage').then(m => ({ default: m.CardsPage })))
const CardDetailPage = lazy(() => import('./features/cards/CardDetailPage').then(m => ({ default: m.CardDetailPage })))
const DeckListPage = lazy(() => import('./features/decks/DeckListPage').then(m => ({ default: m.DeckListPage })))
const DeckBuilderPage = lazy(() => import('./features/decks/DeckBuilderPage').then(m => ({ default: m.DeckBuilderPage })))
const EventLobbyPage = lazy(() => import('./features/events/EventLobbyPage').then(m => ({ default: m.EventLobbyPage })))
const CreateEventPage = lazy(() => import('./features/events/CreateEventPage').then(m => ({ default: m.CreateEventPage })))
const TournamentDashboard = lazy(() => import('./features/events/TournamentDashboard'))
const TournamentPublicView = lazy(() => import('./features/events/TournamentPublicView'))
const ManageNewsPage = lazy(() => import('./features/home/ManageNewsPage').then(m => ({ default: m.ManageNewsPage })))
const UtilitiesPage = lazy(() => import('./features/utilities/UtilitiesPage').then(m => ({ default: m.UtilitiesPage })))
const ProfilePage = lazy(() => import('./features/profile/ProfilePage').then(m => ({ default: m.ProfilePage })))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const RankingPage = lazy(() => import('./features/rank/RankingPage').then(m => ({ default: m.RankingPage })))
const CollectionPage = lazy(() => import('./features/collection/CollectionPage').then(m => ({ default: m.CollectionPage })))
const PublicProfilePage = lazy(() => import('./features/collection/PublicProfilePage').then(m => ({ default: m.PublicProfilePage })))
const ExplorePage = lazy(() => import('./features/collection/ExplorePage').then(m => ({ default: m.ExplorePage })))
const ArenaPage = lazy(() => import('./features/arena/ArenaPage').then(m => ({ default: m.ArenaPage })))
const ArenaLogPage = lazy(() => import('./features/arena/ArenaLogPage').then(m => ({ default: m.ArenaLogPage })))
const ArenaHistoryPage = lazy(() => import('./features/arena/ArenaHistoryPage').then(m => ({ default: m.ArenaHistoryPage })))
const ArenaStatsPage = lazy(() => import('./features/arena/ArenaStatsPage').then(m => ({ default: m.ArenaStatsPage })))
const ArenaFeedPage = lazy(() => import('./features/arena/ArenaFeedPage').then(m => ({ default: m.ArenaFeedPage })))
const MeleeHubPage = lazy(() => import('./features/melee/MeleeHubPage').then(m => ({ default: m.MeleeHubPage })))
const MeleeAddPage = lazy(() => import('./features/melee/MeleeAddPage').then(m => ({ default: m.MeleeAddPage })))
const MeleeDetailPage = lazy(() => import('./features/melee/MeleeDetailPage').then(m => ({ default: m.MeleeDetailPage })))
const EspionajePage = lazy(() => import('./features/espionaje/EspionajePage').then(m => ({ default: m.EspionajePage })))
const SpyProfilePage = lazy(() => import('./features/espionaje/SpyProfilePage').then(m => ({ default: m.SpyProfilePage })))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={28} className="text-swu-accent animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
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
            <Route path="/events/dashboard/:code" element={<TournamentDashboard />} />
            <Route path="/events/live/:code" element={<TournamentPublicView />} />
            <Route path="/cards" element={<CardsPage />} />
            <Route path="/cards/:id" element={<CardDetailPage />} />
            <Route path="/decks" element={<DeckListPage />} />
            <Route path="/decks/:id" element={<DeckBuilderPage />} />
            <Route path="/arena" element={<ArenaPage />} />
            <Route path="/arena/log" element={<ArenaLogPage />} />
            <Route path="/arena/history" element={<ArenaHistoryPage />} />
            <Route path="/arena/stats" element={<ArenaStatsPage />} />
            <Route path="/arena/feed" element={<ArenaFeedPage />} />
            <Route path="/melee" element={<MeleeHubPage />} />
            <Route path="/melee/add" element={<MeleeAddPage />} />
            <Route path="/melee/:id" element={<MeleeDetailPage />} />
            <Route path="/espionaje" element={<EspionajePage />} />
            <Route path="/espionaje/:userId" element={<SpyProfilePage />} />
            <Route path="/collection" element={<CollectionPage />} />
            <Route path="/u/:userId" element={<PublicProfilePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/news/manage" element={<ManageNewsPage />} />
            <Route path="/utilities" element={<UtilitiesPage />} />
            <Route path="/rank" element={<RankingPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/*" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
