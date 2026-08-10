import { lazy, Suspense } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { AuthGate } from './components/AuthGate'
import { HolocronLoader } from './components/PageTransition'
import { useRutaPersistente } from './hooks/useRutaPersistente'

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
const TournamentPlayerView = lazy(() => import('./features/events/TournamentPlayerView').then(m => ({ default: m.TournamentPlayerView })))
const BlogPage = lazy(() => import('./features/blog/BlogPage').then(m => ({ default: m.BlogPage })))
const BlogPostPage = lazy(() => import('./features/blog/BlogPostPage').then(m => ({ default: m.BlogPostPage })))
const BlogEditorPage = lazy(() => import('./features/blog/BlogEditorPage').then(m => ({ default: m.BlogEditorPage })))
const ManageNewsPage = lazy(() => import('./features/home/ManageNewsPage').then(m => ({ default: m.ManageNewsPage })))
const NewsPage = lazy(() => import('./features/home/NewsPage').then(m => ({ default: m.NewsPage })))
const SedesPage = lazy(() => import('./features/venues/SedesPage').then(m => ({ default: m.SedesPage })))
const SedePage = lazy(() => import('./features/venues/SedePage').then(m => ({ default: m.SedePage })))
const AdminVenuePage = lazy(() => import('./features/admin/AdminVenuePage').then(m => ({ default: m.AdminVenuePage })))
const ScanPage = lazy(() => import('./features/scan/ScanPage').then(m => ({ default: m.ScanPage })))
const MetaPage = lazy(() => import('./features/meta/MetaPage').then(m => ({ default: m.MetaPage })))
const ContadorPage = lazy(() => import('./features/contador/ContadorPage').then(m => ({ default: m.ContadorPage })))
const ProfilePage = lazy(() => import('./features/profile/ProfilePage').then(m => ({ default: m.ProfilePage })))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const RankingPage = lazy(() => import('./features/rank/RankingPage').then(m => ({ default: m.RankingPage })))
const CommunityPage = lazy(() => import('./features/community/CommunityPage').then(m => ({ default: m.CommunityPage })))
const CollectionPage = lazy(() => import('./features/collection/CollectionPage').then(m => ({ default: m.CollectionPage })))
const PublicProfilePage = lazy(() => import('./features/collection/PublicProfilePage').then(m => ({ default: m.PublicProfilePage })))
const ExplorePage = lazy(() => import('./features/collection/ExplorePage').then(m => ({ default: m.ExplorePage })))
const ArenaPage = lazy(() => import('./features/arena/ArenaPage').then(m => ({ default: m.ArenaPage })))
const ArenaLogPage = lazy(() => import('./features/arena/ArenaLogPage').then(m => ({ default: m.ArenaLogPage })))
const ArenaHistoryPage = lazy(() => import('./features/arena/ArenaHistoryPage').then(m => ({ default: m.ArenaHistoryPage })))
const ArenaStatsPage = lazy(() => import('./features/arena/ArenaStatsPage').then(m => ({ default: m.ArenaStatsPage })))
const ArenaFeedPage = lazy(() => import('./features/arena/ArenaFeedPage').then(m => ({ default: m.ArenaFeedPage })))
const MeleeHubPage = lazy(() => import('./features/events/melee/MeleeHubPage').then(m => ({ default: m.MeleeHubPage })))
const MeleeAddPage = lazy(() => import('./features/events/melee/MeleeAddPage').then(m => ({ default: m.MeleeAddPage })))
const MeleeDetailPage = lazy(() => import('./features/events/melee/MeleeDetailPage').then(m => ({ default: m.MeleeDetailPage })))
const EspionajePage = lazy(() => import('./features/espionaje/EspionajePage').then(m => ({ default: m.EspionajePage })))
const SpyProfilePage = lazy(() => import('./features/espionaje/SpyProfilePage').then(m => ({ default: m.SpyProfilePage })))
const MissionsPage = lazy(() => import('./features/missions/MissionsPage'))
const GalaxyPage = lazy(() => import('./features/galaxy/GalaxyPage').then(m => ({ default: m.GalaxyPage })))
const GalaxiaPage = lazy(() => import('./features/galaxia/GalaxiaPage').then(m => ({ default: m.GalaxiaPage })))
const LabPage = lazy(() => import('./features/lab/LabPage').then(m => ({ default: m.LabPage })))
const MesaPage = lazy(() => import('./features/mesa/MesaPage').then(m => ({ default: m.MesaPage })))
// Banco de pruebas de la mesa 3D. Solo en desarrollo: se cae del bundle de
// producción porque `import.meta.env.DEV` es literal y el árbol se poda.
// El ternario con `import.meta.env.DEV` es lo que PODA el chunk: la ruta de
// abajo ya estaba tras el mismo guardia, pero un `lazy(import(...))` suelto
// emite el archivo IGUAL aunque nadie lo cargue — medido: 99,5 KB (el fixture
// va adentro) que la PWA precachea para toda la comunidad. Con el import
// dentro de la rama muerta, el empaquetador no lo emite.
const BancoGalaxia = import.meta.env.DEV
  ? lazy(() => import('./features/galaxia/BancoGalaxia').then(m => ({ default: m.BancoGalaxia })))
  : () => null
const BancoMesa = import.meta.env.DEV
  ? lazy(() => import('./features/mesa/BancoMesa').then(m => ({ default: m.BancoMesa })))
  : () => null
const RulingsPage = lazy(() => import('./features/rulings/RulingsPage').then(m => ({ default: m.RulingsPage })))

// Admin panel — separate layout, isAdmin guard inside AdminLayout
const AdminLayout = lazy(() => import('./features/admin/AdminLayout').then(m => ({ default: m.AdminLayout })))
const AdminDashboard = lazy(() => import('./features/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const AdminUsersPage = lazy(() => import('./features/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })))
const AdminNewsPage = lazy(() => import('./features/admin/AdminNewsPage').then(m => ({ default: m.AdminNewsPage })))
const AdminEventsPage = lazy(() => import('./features/admin/AdminEventsPage').then(m => ({ default: m.AdminEventsPage })))
const AdminEventCreatePage = lazy(() => import('./features/admin/AdminEventCreatePage').then(m => ({ default: m.AdminEventCreatePage })))
const AdminCardsPage = lazy(() => import('./features/admin/AdminCardsPage').then(m => ({ default: m.AdminCardsPage })))
const AdminPushPage = lazy(() => import('./features/admin/AdminPushPage').then(m => ({ default: m.AdminPushPage })))
const AdminAuditPage = lazy(() => import('./features/admin/AdminAuditPage').then(m => ({ default: m.AdminAuditPage })))
const AdminAnnouncementsPage = lazy(() => import('./features/admin/AdminAnnouncementsPage').then(m => ({ default: m.AdminAnnouncementsPage })))

function PageLoader() {
  return <HolocronLoader />
}

/** Wrap protected pages */
function P({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>
}

/** Conserva el id del torneo al mandar /melee/:id a su ruta nueva. */
function RedirigirMelee() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/events/melee/${id ?? ''}`} replace />
}

/** Recuerda dónde estabas si el sistema mata la PWA en segundo plano.
 *  Tiene que colgar DENTRO de BrowserRouter para poder usar los hooks del
 *  router, y por eso vive en su propio componente y no en App. */
function MemoriaDeRuta() {
  useRutaPersistente()
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <MemoriaDeRuta />
      {/* Sin esto, cualquier error de render deja la pantalla en blanco, sin
          mensaje ni salida — y en la PWA instalada no hay ni barra de
          direcciones para escapar. */}
      <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ── Admin panel — own layout, isAdmin guard inside ── */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="sede" element={<AdminVenuePage />} />
            <Route path="news" element={<AdminNewsPage />} />
            <Route path="events" element={<AdminEventsPage />} />
            <Route path="events/new" element={<AdminEventCreatePage />} />
            <Route path="cards" element={<AdminCardsPage />} />
            <Route path="push" element={<AdminPushPage />} />
            <Route path="audit" element={<AdminAuditPage />} />
            <Route path="announcements" element={<AdminAnnouncementsPage />} />
          </Route>

          <Route element={<AppLayout />}>
            {/* ── Public routes ── */}
            <Route path="/" element={<HomePage />} />
            <Route path="/cards" element={<CardsPage />} />
            <Route path="/cards/:id" element={<CardDetailPage />} />
            <Route path="/contador" element={<ContadorPage />} />
            {/* Utilidades se retiró: el dado vive dentro del Contador y la moneda
                ya no se usa. La ruta vieja redirige para no romper marcadores. */}
            <Route path="/utilities" element={<Navigate to="/contador" replace />} />
            {/* Las reglas son PÚBLICAS a propósito: un juez en mesa de torneo
                no tiene por qué loguearse para leer una cita del reglamento,
                y el deep-link /rulings?regla=7.4.2 se comparte por WhatsApp. */}
            <Route path="/rulings" element={<RulingsPage />} />
            <Route path="/sedes" element={<SedesPage />} />
            <Route path="/sede/:id" element={<SedePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/*" element={<SettingsPage />} />
            <Route path="/events/live/:code" element={<TournamentPublicView />} />
            <Route path="/u/:userId" element={<PublicProfilePage />} />

            {/* ── Protected routes (require login) ── */}
            <Route path="/play" element={<P><PlayPage /></P>} />
            <Route path="/laboratorio" element={<P><LabPage /></P>} />
            {/* Pegada al Laboratorio porque es su continuación: allí se MIDE un
                emparejamiento y aquí se VE una partida de esa misma medición. */}
            <Route path="/mesa" element={<P><MesaPage /></P>} />
            {import.meta.env.DEV && <Route path="/banco-mesa" element={<BancoMesa />} />}
            {import.meta.env.DEV && <Route path="/banco-galaxia" element={<BancoGalaxia />} />}
            <Route path="/play/tracker/:mode" element={<P><TrackerPage /></P>} />
            <Route path="/play/saved" element={<P><SavedMatchesPage /></P>} />
            <Route path="/events" element={<P><EventsPage /></P>} />
            <Route path="/events/join" element={<P><JoinEventPage /></P>} />
            <Route path="/events/create" element={<P><CreateEventPage /></P>} />
            <Route path="/events/tournament" element={<P><TournamentListPage /></P>} />
            <Route path="/events/tournament/new" element={<P><TournamentSetupPage /></P>} />
            <Route path="/events/tournament/:id" element={<P><TournamentLivePage /></P>} />
            <Route path="/events/lobby/:code" element={<P><EventLobbyPage /></P>} />
            <Route path="/events/play/:code" element={<P><TournamentPlayerView /></P>} />
            <Route path="/events/dashboard/:code" element={<P><TournamentDashboard /></P>} />
            <Route path="/arena" element={<P><ArenaPage /></P>} />
            <Route path="/arena/log" element={<P><ArenaLogPage /></P>} />
            <Route path="/arena/history" element={<P><ArenaHistoryPage /></P>} />
            <Route path="/arena/stats" element={<P><ArenaStatsPage /></P>} />
            <Route path="/arena/feed" element={<P><ArenaFeedPage /></P>} />
            {/* Registro manual de torneos de melee. Vive DENTRO de Eventos:
                es una forma más de anotar un torneo, y las estadísticas del
                circuito ya salen solas en el perfil desde la cuenta enlazada. */}
            <Route path="/events/melee" element={<P><MeleeHubPage /></P>} />
            <Route path="/events/melee/add" element={<P><MeleeAddPage /></P>} />
            <Route path="/events/melee/:id" element={<P><MeleeDetailPage /></P>} />
            {/* Las rutas viejas siguen funcionando: hay enlaces compartidos y
                pestañas abiertas por ahí, y un 404 no explica nada. */}
            <Route path="/melee" element={<Navigate to="/events/melee" replace />} />
            <Route path="/melee/add" element={<Navigate to="/events/melee/add" replace />} />
            <Route path="/melee/:id" element={<RedirigirMelee />} />
            <Route path="/decks" element={<P><DeckListPage /></P>} />
            <Route path="/decks/:id" element={<P><DeckBuilderPage /></P>} />
            <Route path="/scan" element={<P><ScanPage /></P>} />
            <Route path="/collection" element={<P><CollectionPage /></P>} />
            <Route path="/explore" element={<P><ExplorePage /></P>} />
            <Route path="/espionaje" element={<P><EspionajePage /></P>} />
            <Route path="/espionaje/:userId" element={<P><SpyProfilePage /></P>} />
            <Route path="/misiones" element={<P><MissionsPage /></P>} />
            <Route path="/rank" element={<P><RankingPage /></P>} />
            <Route path="/community" element={<P><CommunityPage /></P>} />
            <Route path="/galaxy" element={<P><GalaxyPage /></P>} />
            {/* La misma comunidad en 3D. Va tras `<P>` igual que el explorador:
                `profiles` exige sesión salvo perfiles públicos, y la escena
                necesita saber cuál planeta es el de quien mira. */}
            <Route path="/galaxia" element={<P><GalaxiaPage /></P>} />
            {/* La agenda es pública: sirve para que alguien sin cuenta vea
                cuándo es el próximo torneo. */}
            <Route path="/news" element={<NewsPage />} />
            {/* El meta es público: sirve para prepararse antes de un torneo. */}
            <Route path="/meta" element={<MetaPage />} />
            {/* El blog se lee SIN cuenta: es lo primero que ve quien llega
                desde un enlace compartido. Solo el editor exige sesión. */}
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/nuevo" element={<P><BlogEditorPage /></P>} />
            <Route path="/blog/editar/:id" element={<P><BlogEditorPage /></P>} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/news/manage" element={<P><ManageNewsPage /></P>} />
            {/* Cualquier ruta que no exista cae en Inicio.

                Sin esto NO se renderizaba nada: ni cabecera, ni barra de abajo,
                ni siquiera el AppLayout —o sea que `initAuth()` tampoco corría—.
                Pantalla negra y punto. Y como `vercel.json` reescribe todo lo
                que no sea /api/ a index.html, un enlace viejo de WhatsApp o un
                marcador a una ruta que cambió de nombre moría así; en la PWA
                instalada no hay barra de direcciones para escapar.

                Va al final a propósito: React Router ordena por especificidad,
                pero dejarlo último también lo deja claro al leer. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
