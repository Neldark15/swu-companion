/**
 * El emergente de «¿de dónde sos?», para las cuentas sin ubicación.
 *
 * ── Por qué ESTE sí es un emergente y el otro no ──────────────────────
 *
 * `AvisoPerfil` es una tarjeta a propósito, y su comentario explica bien por
 * qué: un modal al entrar enseña a cerrar avisos sin leerlos. Esto no lo
 * contradice, lo acota — son dos cosas distintas metidas en el mismo bulto:
 *
 * La bio, los aspectos y el nombre del planeta son ADORNO: sin ellos tu perfil
 * se ve más pelado y nada más. El país es FUNCIONAL: sin él quedás fuera del
 * ranking por país, fuera de la sala de chat de tu país y fuera de la pestaña
 * SV del meta. No es un perfil incompleto, es una persona que la app no puede
 * ubicar en las tres pantallas donde la ubicación es el eje.
 *
 * Por eso pregunta una sola cosa, se responde con dos toques y se puede
 * posponer. Lo que NO hace es tapar la app: hay «Después», y respetarlo.
 *
 * ── A quién le sale ───────────────────────────────────────────────────
 *
 * Medido: de 38 perfiles, **3** no tienen país (28 SV, 5 ES, 1 MX, 1 AR). O
 * sea que hoy son tres personas, y de acá en adelante cada cuenta nueva que se
 * salte el asistente. Con esos números un emergente no es invasivo: es el
 * único momento en que se le va a preguntar.
 *
 * ── Y no se pisa con el otro aviso ────────────────────────────────────
 *
 * `AvisoPerfil` tiene un «No me lo recuerdes» que lo calla PARA SIEMPRE. Si
 * este colgara de esa misma marca, quien la haya tocado alguna vez nunca vería
 * la pregunta. Lleva su propia llave en localStorage, y su posponer es de 3
 * días — no de 7 y no eterno: la ubicación se pide hasta que se conteste,
 * porque hasta que se conteste hay tres pantallas que no funcionan.
 */

import { useEffect, useState } from 'react'
import { MapPin, X } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { useAuth } from '../../hooks/useAuth'
import { CONTINENTS } from '../../data/regions'

const LLAVE_POSPUESTO = 'swu_ubicacion_pospuesta'
const DIAS_POSPUESTO = 3

function pospuesto(): boolean {
  try {
    const hasta = Number(localStorage.getItem(LLAVE_POSPUESTO) ?? 0)
    return Number.isFinite(hasta) && Date.now() < hasta
  } catch {
    // Sin localStorage (modo privado de algunos navegadores) se muestra. Un
    // aviso de más molesta menos que una cuenta que nunca puede ubicarse.
    return false
  }
}

function posponer(): void {
  try {
    localStorage.setItem(LLAVE_POSPUESTO, String(Date.now() + DIAS_POSPUESTO * 864e5))
  } catch { /* si no se puede guardar, vuelve a preguntar. Es lo correcto. */ }
}

export function AvisoUbicacion() {
  const auth = useAuth()
  const { currentProfile, supabaseUser } = auth

  const [abierto, setAbierto] = useState(false)
  const [continente, setContinente] = useState('')
  const [pais, setPais] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const faltaPais = !!supabaseUser && !!currentProfile && !currentProfile.country

  useEffect(() => {
    /* Se espera a que HAYA perfil antes de juzgar.
     *
     * `currentProfile` arranca en null en cada arranque en frío (gotcha 2v) y
     * se hidrata después. Sin esta guarda, el emergente saltaría un instante
     * en cada apertura de la app para TODO el mundo, incluida la gente que sí
     * tiene país — que es exactamente el comportamiento que hace que se
     * cierren los avisos sin leerlos. */
    if (!faltaPais || pospuesto()) return
    // Un respiro para no competir con la primera pintada.
    const t = setTimeout(() => setAbierto(true), 1200)
    return () => clearTimeout(t)
  }, [faltaPais])

  const guardar = async () => {
    if (!pais) { setError('Elegí tu país.'); return }
    setGuardando(true)
    setError(null)
    try {
      await auth.updateProfile({ country: pais, continent: continente || undefined })
      setAbierto(false)
    } catch {
      setError('No se pudo guardar. Probá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  const despues = () => { posponer(); setAbierto(false) }

  if (!faltaPais) return null

  return (
    <Sheet open={abierto} onClose={despues} title="Tu zona" bare>
      {/* `bare` quita la cabecera del Sheet y también su padding: el p-4 va
          acá o el contenido queda pegado a los bordes del panel. */}
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-swu-accent/15">
            <MapPin size={18} className="text-swu-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-swu-text">¿De qué zona sos?</h2>
            {/* Se dice PARA QUÉ. Un dato que se pide sin decir para qué se
                siente como un formulario; con el motivo, es un ajuste. */}
            <p className="mt-0.5 text-[12px] leading-snug text-swu-muted">
              Es para ubicarte en el ranking de tu país, en la sala de chat de
              tu zona y en el meta nacional. Nadie ve tu dirección: solo el país.
            </p>
          </div>
          <button
            onClick={despues}
            aria-label="Después"
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-swu-muted hover:text-swu-text"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CONTINENTS.map(c => (
            <button
              key={c.id}
              onClick={() => { setContinente(c.id); setPais('') }}
              className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold ${
                continente === c.id
                  ? 'border-swu-accent bg-swu-accent/15 text-swu-accent-texto'
                  : 'border-swu-border bg-swu-bg text-swu-muted'
              }`}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        {continente && (
          <div className="max-h-56 overflow-y-auto rounded-xl border border-swu-border bg-swu-bg p-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              {CONTINENTS.find(c => c.id === continente)?.countries.map(p => (
                <button
                  key={p.code}
                  onClick={() => { setPais(p.code); setError(null) }}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[12px] ${
                    pais === p.code
                      ? 'border-swu-accent bg-swu-accent/15 text-swu-accent-texto font-bold'
                      : 'border-transparent text-swu-text'
                  }`}
                >
                  <span>{p.flag}</span>
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-[12px] text-red-400">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={despues}
            className="rounded-xl px-3 py-2 text-[12px] font-semibold text-swu-muted"
          >
            Después
          </button>
          <button
            onClick={guardar}
            disabled={!pais || guardando}
            className="flex-1 rounded-xl bg-swu-accent px-3 py-2 text-[13px] font-bold text-white disabled:opacity-40"
          >
            {guardando ? 'Guardando…' : 'Listo'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
