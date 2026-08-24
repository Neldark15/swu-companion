/**
 * La franja de Inicio: «hay un directo, y empieza en tanto».
 *
 * ── Por qué no alcanza con el push ────────────────────────────────────
 *
 * Medido el día que se armó esto: 13 de 39 cuentas tienen avisos activados. Un
 * aviso que solo viaja por push le llega a un tercio de la comunidad, y los
 * otros dos tercios se enteran de la transmisión cuando ya terminó. La franja
 * es el otro canal — el mismo criterio que el sobre diario, donde el push
 * tampoco puede ser el único camino porque por definición solo alcanza a quien
 * ya lo tiene puesto.
 *
 * Se esconde sola cuando no hay nada a la vista: una franja permanente que
 * dice «no hay transmisiones» es ruido en una portada que ya tiene veinte
 * casillas.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Radio, ChevronRight } from 'lucide-react'
import {
  transmisionDestacada, momentoDe, faltaTexto, horaLocal, type Transmision,
} from '../../services/transmisiones'

/** Con más de un día por delante deja de ser una noticia y pasa a ser agenda. */
const ANTELACION_MAX_MS = 24 * 60 * 60_000

export function AvisoTransmision() {
  const [t, setT] = useState<Transmision | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    let vivo = true
    void transmisionDestacada().then(r => { if (vivo) setT(r) })
    return () => { vivo = false }
  }, [])

  useEffect(() => {
    if (!t) return
    // Un tick por segundo solo si hay cuenta atrás que mover.
    const id = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [t])

  if (!t) return null
  const momento = momentoDe(t, ahora)
  if (momento === 'termino') return null

  const inicio = new Date(t.empiezaEn).getTime()
  const falta = inicio - ahora
  if (momento === 'falta' && falta > ANTELACION_MAX_MS) return null

  const enVivo = momento === 'envivo'

  return (
    <Link
      to="/envivo"
      className={`flex min-h-[56px] items-center gap-3 rounded-2xl border px-3.5 py-2.5
                  ${enVivo
                    ? 'border-swu-red/50 bg-swu-red/10'
                    : 'border-swu-amber/40 bg-swu-amber/10'}`}
    >
      <Radio
        size={18}
        className={enVivo ? 'shrink-0 animate-pulse text-swu-red-texto' : 'shrink-0 text-swu-amber'}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-[10px] font-black uppercase tracking-widest
                       ${enVivo ? 'text-swu-red-texto' : 'text-swu-amber'}`}>
          {enVivo ? 'Transmitiendo ahora' : `Empieza en ${faltaTexto(falta)}`}
        </p>
        <p className="truncate text-[13px] font-bold text-swu-text">{t.titulo}</p>
        <p className="truncate text-[11px] text-swu-muted">
          {t.canal}{!enVivo && ` · ${horaLocal(t.empiezaEn)}`}
        </p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-swu-muted" />
    </Link>
  )
}
