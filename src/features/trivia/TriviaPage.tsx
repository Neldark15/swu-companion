/**
 * ARCHIVOS JEDI — la trivia, en su propia pantalla. `/trivia`
 *
 * ── Por qué salió del Perfil ──────────────────────────────────────────
 *
 * La trivia era lo segundo más usado de la app —15 de 38 personas, 378
 * respuestas, 11 activas la última semana— y vivía ENTERRADA al fondo de
 * ProfilePage: había que entrar a Mi Perfil y bajar hasta encontrarla. Es el
 * patrón que este repo ya pagó varias veces: «faltaba puerta, no capacidad»
 * (§3l). Ahora tiene ruta propia y casilla en Mini Juegos de Inicio.
 *
 * ── Y el XP por fin LLEGA ─────────────────────────────────────────────
 *
 * Medido antes de mover nada: `recordTriviaAnswer` escribía `xp_earned` en
 * `trivia_progress` —una tabla que nadie lee para XP— y el `onXpGained` del
 * Perfil hacía `setPlayerStats({...})`, o sea ESTADO DE REACT: el número subía
 * en pantalla y se esfumaba al recargar. 644 XP prometidos en total y ni uno
 * llegó a `player_stats`. Es el §3m con otra cara.
 *
 * Acá `onXpGained` llama a `acreditarXp`, que suma EN EL SERVIDOR (con su tope
 * de 500 por llamada) y baja el total a Dexie. Son 2 XP por acierto: chico a
 * propósito — el servidor no puede verificar una respuesta de trivia (el banco
 * de preguntas vive en el cliente), así que el premio por respuesta se queda
 * pequeño y con tope diario natural (10 preguntas al día).
 */

import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth, acreditarXp } from '../../hooks/useAuth'
import { TriviaSection } from '../profile/components/TriviaSection'
import { PanelAspectos } from './PanelAspectos'
import { EmptyState } from '../../components/ui/EmptyState'
import { HolocronIcon } from '../../components/SWIcons'

export function TriviaPage() {
  const usuario = useAuth(s => s.supabaseUser)

  if (!usuario) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <EmptyState
          icon={<HolocronIcon size={26} />}
          title="La trivia es de tu cuenta"
          hint="Iniciá sesión para que tus respuestas, tu racha y tus medallas queden guardadas."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3 pb-24">
      <div className="mb-3">
        <Link
          to="/"
          className="-ml-1 flex w-fit items-center gap-1 p-1 text-sm text-swu-muted hover:text-swu-text"
        >
          <ChevronLeft size={18} />
          Inicio
        </Link>
      </div>

      <h1 className="text-center text-2xl font-black tracking-tight text-swu-text">
        ARCHIVOS JEDI
      </h1>
      <p className="mb-4 text-center text-[11px] text-swu-muted">
        10 preguntas al día · 2 XP por acierto, acreditados de verdad
      </p>

      <div className="rounded-2xl border border-swu-border bg-swu-surface p-4">
        <TriviaSection
          userId={usuario.id}
          /* El XP va al SERVIDOR y de vuelta a Dexie. El callback viejo del
             Perfil hacía setState y el pago se esfumaba al recargar. */
          onXpGained={(xp) => { void acreditarXp(xp, 'trivia') }}
        />
      </div>

      {/* Los aspectos van DEBAJO del juego, no en el perfil: se suben acá y un
          progreso que se muestra lejos de donde se gana es un progreso que
          nadie relaciona con lo que hizo (§3l). */}
      <PanelAspectos />
    </div>
  )
}
