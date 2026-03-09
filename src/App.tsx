import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { AuthGate } from './components/AuthGate'
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
const MissionsPage = lazy(() => import('./features/missions/MissionsPage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={28} className="text-swu-accent animate-spin" />
    </div>
  )
}

/** Wrap protected pages */
function P({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<AppLayout />}>
            {/* ── Public routes ── */}
            <Route path="/" element={<HomePage />} />
            <Route path="/cards" element={<CardsPage />} />
            <Route path="/cards/:id" element={<CardDetailPage />} />
            <Route path="/utilities" element={<UtilitiesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/*" element={<SettingsPage />} />
            <Route path="/events/live/:code" element={<TournamentPublicView />} />
            <Route path="/u/:userId" element={<PublicProfilePage />} />

            {/* ── Protected routes (require login) ── */}
            <Route path="/play" element={<P><PlayPage /></P>} />
            <Route path="/play/tracker/:mode" element={<P><TrackerPage /></P>} />
            <Route path="/play/saved" element={<P><SavedMatchesPage /></P>} />
            <Route path="/events" element={<P><EventsPage /></P>} />
            <Route path="/events/join" element={<P><JoinEventPage /></P>} />
            <Route path="/events/create" element={<P><CreateEventPage /></P>} />
            <Route path="/events/tournament" element={<P><TournamentListPage /></P>} />
            <Route path="/events/tournament/new" element={<P><TournamentSetupPage /></P>} />
            <Route path="/events/tournament/:id" element={<P><TournamentLivePage /></P>} />
            <Route path="/events/lobby/:code" element={<P><EventLobbyPage /></P>} />
            <Route path="/events/dashboard/:code" element={<P><TournamentDashboard /></P>} />
            <Route path="/arena" element={<P><ArenaPage /></P>} />
            <Route path="/arena/log" element={<P><ArenaLogPage /></P>} />
            <Route path="/arena/history" element={<P><ArenaHistoryPage /></P>} />
            <Route path="/arena/stats" element={<P><ArenaStatsPage /></P>} />
            <Route path="/arena/feed" element={<P><ArenaFeedPage /></P>} />
            <Route path="/melee" element={<P><MeleeHubPage /></P>} />
            <Route path="/melee/add" element={<P><MeleeAddPage /></P>} />
            <Route path="/melee/:id" element={<P><MeleeDetailPage /></P>} />
            <Route path="/decks" element={<P><DeckListPage /></P>} />
            <Route path="/decks/:id" element={<P><DeckBuilderPage /></P>} />
            <Route path="/collection" element={<P><CollectionPage /></P>} />
            <Route path="/explore" element={<P><ExplorePage /></P>} />
            <Route path="/espionaje" element={<P><EspionajePage /></P>} />
            <Route path="/espionaje/:userId" element={<P><SpyProfilePage /></P>} />
            <Route path="/misiones" element={<P><MissionsPage /></P>} />
            <Route path="/rank" element={<P><RankingPage /></P>} />
            <Route path="/news/manage" element={<P><ManageNewsPage /></P>} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
