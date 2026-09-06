/**
 * EL BOTÓN DE LA LIGA EN INICIO.
 *
 * La liga se anuncia en YouTube y se entra por un enlace, pero quien ya tiene
 * la app tenía que **teclear el URL**: no había entrada en ningún menú. Es la
 * misma forma del §3l —la capacidad existe y no hay puerta— y acá le tocaba al
 * creador de la liga, que es justamente quien más la abre.
 *
 * ── Va debajo de La Galaxia, en su propio botón ──────────────────────
 *
 * No entra a la cuadrícula de «módulos»: ahí es una casilla de 60 px entre
 * veinte, y una liga con fecha límite no es un módulo más. Va donde está la
 * acción principal.
 *
 * ── Solo lo ve quien puede entrar ────────────────────────────────────
 *
 * `liga_para_inicio()` devuelve `null` para quien no tiene liga —hoy, todos
 * menos Alejo, el staff y los probadores— y entonces **no se dibuja nada**. Ni
 * un esqueleto mientras carga: un hueco que casi siempre termina en nada es un
 * parpadeo en cada apertura de Inicio (§3h-quinquies).
 *
 * ── La segunda línea dice el PLAZO, no el estado ─────────────────────
 *
 * «En curso» no le pide nada a nadie. Lo que hace entrar es «cierra en 21
 * días»: la liga tiene fechas y son la única razón para abrirla hoy y no la
 * semana que viene. Cuando no hay plazo se cae al estado, que es lo único
 * cierto que queda.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { HudPanel, HudCorners } from '../../components/Hud'
import { ligaParaInicio, type LigaDeInicio } from '../../services/ligaService'
import { restanHasta } from './componentes/tiempo'
import { useAuth } from '../../hooks/useAuth'

/** Días enteros que faltan, con la MISMA cuenta que la cuenta atrás del lobby. */
function diasHasta(fecha: string | null): number | null {
  const r = restanHasta(fecha)
  return r && !r.vencido ? r.dias : null
}

function linea(l: LigaDeInicio): string {
  const t = l.temporada
  if (t?.estado === 'inscripcion') {
    const d = diasHasta(t.inscripcionCierra)
    if (d !== null && d > 0) return `Inscripción abierta · cierra en ${d} ${d === 1 ? 'día' : 'días'}`
    return 'Inscripción abierta'
  }
  if (t?.estado === 'en_curso') {
    const d = diasHasta(t.arranca)
    if (d !== null && d > 0) return `Arranca en ${d} ${d === 1 ? 'día' : 'días'}`
    return 'Temporada en curso'
  }
  if (l.esStaff) return 'Tu liga · todavía sin abrir'
  return 'Próximamente'
}

export function BotonLigaInicio() {
  const { currentProfileId } = useAuth()
  const [liga, setLiga] = useState<LigaDeInicio | null>(null)

  /* Al cambiar de cuenta (o al cerrar sesión) se olvida la liga anterior AQUÍ,
     durante el render, y no dentro del efecto: un `setState` síncrono en un
     efecto encadena un render de más y el linter lo marca como error. Es el
     mismo patrón que usa el contador de vida de las mesas. Sin esto, cerrar
     sesión dejaría el botón de la liga de la cuenta anterior en pantalla. */
  const [paraQuien, setParaQuien] = useState(currentProfileId)
  if (paraQuien !== currentProfileId) {
    setParaQuien(currentProfileId)
    setLiga(null)
  }

  useEffect(() => {
    if (!currentProfileId) return
    let vivo = true
    void ligaParaInicio().then(r => { if (vivo) setLiga(r) })
    return () => { vivo = false }
  }, [currentProfileId])

  if (!liga) return null
  return <BotonLiga liga={liga} />
}

/**
 * La parte que se DIBUJA, sin nada de red.
 *
 * Separada del contenedor para poder mirarla en el banco con sus tres estados:
 * el botón vive en Inicio, que exige sesión, así que si no se separa no hay
 * forma de verlo sin entrar con una cuenta de verdad.
 */
export function BotonLiga({ liga }: { liga: LigaDeInicio }) {
  const navigate = useNavigate()

  return (
    // `data-modulo="liga"` para que existan las variables de la paleta azul:
    // fuera del contenedor de la liga NO están definidas, y el botón saldría
    // con los bordes transparentes.
    <div data-modulo="liga" className="px-4 pt-3">
      <button
        onClick={() => navigate(`/liga/${liga.code}`)}
        className="w-full active:scale-[0.98] transition-transform"
      >
        <HudPanel tone="neutral" fill="bg-swu-surface">
          <div
            className="relative flex items-center gap-3 px-3 py-3"
            style={{ background: 'var(--liga-acento-suave)' }}
          >
            <HudCorners tone="neutral" />
            <img
              src="/liga/emblema.webp"
              alt=""
              aria-hidden
              className="h-10 w-10 flex-shrink-0 object-contain"
            />
            {/* `min-w-0` sin `nowrap`: un ítem flex arranca en `min-width:auto`
                y no se deja encoger bajo su contenido — el nombre impondría su
                ancho y la fila se pasaría del teléfono. */}
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-extrabold uppercase leading-tight tracking-wide text-white">
                {liga.nombre}
              </span>
              <span className="mt-0.5 block truncate text-[10px] font-bold leading-tight"
                    style={{ color: 'var(--liga-acento)' }}>
                {linea(liga)}
              </span>
            </span>
            <ChevronRight size={16} className="flex-shrink-0" style={{ color: 'var(--liga-acento)' }} aria-hidden />
          </div>
        </HudPanel>
      </button>
    </div>
  )
}
