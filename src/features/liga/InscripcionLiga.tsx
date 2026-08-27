/**
 * ENTRAR A LA LIGA — el formulario de inscripción.
 *
 * Para mucha gente esta va a ser la PRIMERA pantalla de la app: la liga
 * internacional se anuncia en YouTube y se entra por el enlace, así que hay
 * que contar con cuentas recién creadas que no saben nada del resto. Por eso
 * son cuatro campos y cada uno dice PARA QUÉ se pide; un formulario que pide
 * sin explicar se abandona, y acá abandonarlo es no jugar.
 *
 * ── Los dos consentimientos van SEPARADOS ─────────────────────────────
 *
 * Son dos decisiones distintas y una se puede decir que no sin la otra:
 *
 *   1. TRANSMISIÓN — obligatorio. Sin esto no hay liga, y no es una regla de
 *      esta pantalla: `liga_inscribirse` rechaza `p_consiente_transmision`
 *      distinto de true (§4l). Acá se dice con todas las letras y ANTES del
 *      botón, no en letra chica debajo.
 *   2. PERFIL PÚBLICO — opcional. Quien diga que no entra igual y sale con
 *      iniciales en la tabla.
 *
 * Juntarlos en una sola casilla sería cobrar el segundo con el precio del
 * primero. En esta comunidad hay MENORES y las partidas se publican en
 * YouTube: el que no quiere su nombre completo en pantalla tiene que poder
 * jugar igual.
 */

import { useState } from 'react'
import { Radio, Eye, CalendarClock, Swords } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { inscribirseLiga } from '../../services/ligaService'
import { RejillaDisponibilidad } from './RejillaDisponibilidad'

/**
 * La zona horaria del aparato, leída UNA vez al importar.
 *
 * Va fuera del componente por la regla de pureza —igual que `Date.now()`—: es
 * una lectura del entorno, no un valor que dependa del render. Y se lee del
 * navegador en vez de preguntarla porque un desplegable de 400 zonas es
 * exactamente el campo que hace abandonar el formulario.
 */
const ZONA = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
})()

/**
 * ¿La rejilla quedó sin marcar?
 *
 * El formato de `franjas` lo define la rejilla, no esta pantalla: acá solo se
 * distingue «vacío» de «algo», y se toleran las dos formas en que un vacío
 * puede llegar serializado para no acusar de vacío a algo que no lo está.
 */
function sinFranjas(f: string): boolean {
  const t = f.trim()
  return t === '' || t === '[]' || t === '{}'
}

/** «Nelson Darío» → «N. D.» — lo que sale en la tabla si no querés tu nombre. */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  if (partes.length === 0) return '—'
  return partes.map(p => `${p[0].toUpperCase()}.`).join(' ')
}

export function InscripcionLiga({ ligaId, onListo }: { ligaId: string; onListo: () => void }) {
  const { currentProfile } = useAuth()
  const [lider, setLider] = useState('')
  const [base, setBase] = useState('')
  const [franjas, setFranjas] = useState('')
  const [transmision, setTransmision] = useState(false)
  const [perfil, setPerfil] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nombre = currentProfile?.name?.trim() || 'Jugador'
  const comoSalgo = perfil ? nombre : iniciales(nombre)

  const enviar = () => {
    setOcupado(true)
    setError(null)
    void inscribirseLiga(ligaId, lider.trim(), base.trim(), ZONA, franjas, transmision, perfil)
      .then(r => {
        // El mensaje del servidor SE MUESTRA TAL CUAL: es el que sabe si la
        // liga está llena, si ya estás inscrito o si cerró la inscripción.
        // Un «no se pudo» genérico convierte tres problemas distintos —dos de
        // ellos con solución— en un botón que no anda (§4l).
        if (r.ok) onListo()
        else setError(r.mensaje ?? 'No se pudo completar la inscripción.')
        setOcupado(false)
      })
  }

  return (
    <section className="rounded-2xl border border-swu-amber/40 bg-swu-amber/5 p-4">
      <h2 className="text-[15px] font-black tracking-tight text-swu-text">Entrar a la liga</h2>
      <p className="mt-0.5 text-[11px] leading-snug text-swu-muted">
        Tres datos y dos permisos. Te decimos para qué sirve cada cosa.
      </p>

      {/* ── 1 · Con qué jugás ── */}
      <div className="mt-4">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-swu-muted">
          <Swords size={12} /> Con qué vas a jugar
        </p>
        <input
          value={lider}
          onChange={e => setLider(e.target.value.slice(0, 60))}
          placeholder="Tu líder — ej. Darth Vader"
          className="mt-1.5 w-full rounded-xl border border-swu-border bg-swu-bg px-3 py-2.5 text-[13px] text-swu-text outline-none focus:border-swu-accent"
        />
        <input
          value={base}
          onChange={e => setBase(e.target.value.slice(0, 60))}
          placeholder="Tu base — ej. Capital City"
          className="mt-2 w-full rounded-xl border border-swu-border bg-swu-bg px-3 py-2.5 text-[13px] text-swu-text outline-none focus:border-swu-accent"
        />
        <p className="mt-1.5 text-[10px] leading-snug text-swu-muted">
          Es lo que aparece junto a tu nombre en la tabla y cuando presentan tu
          partida al aire. Si todavía no lo decidís, dejalo vacío.
        </p>
      </div>

      {/* ── 2 · Cuándo podés ── */}
      <div className="mt-4">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-swu-muted">
          <CalendarClock size={12} /> Cuándo podés jugar
        </p>
        <p className="mt-1 text-[10px] leading-snug text-swu-muted">
          Los grupos se arman juntando a quienes coinciden en horario, así que
          esto decide contra quién te toca. En tu hora ({ZONA}).
        </p>
        <div className="mt-2">
          <RejillaDisponibilidad valor={franjas} onCambio={setFranjas} />
        </div>
      </div>

      {/* ── 3 · Los dos permisos, separados ──
          Cada uno en su propia caja y con su etiqueta de obligatorio/opcional:
          dos casillas pegadas se leen como una sola condición del paquete, y
          entonces el que solo quería negar el segundo termina negando los dos
          —o aceptando los dos sin querer—. */}
      <div className="mt-4 space-y-2">
        <label className="flex items-start gap-2.5 rounded-xl border border-swu-border bg-swu-bg p-3">
          <input
            type="checkbox"
            checked={transmision}
            onChange={e => setTransmision(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-amber-400"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-swu-amber">
              <Radio size={11} /> Transmisión · obligatorio
            </span>
            <span className="mt-1 block text-[12px] leading-snug text-swu-text">
              Acepto que mis partidas de esta liga se transmitan en vivo y queden
              publicadas en YouTube.
            </span>
            <span className="mt-1 block text-[10px] leading-snug text-swu-muted">
              Sin esto no se puede jugar la liga: es un torneo que se emite. Si
              sos menor de edad, decidilo con tu madre, padre o tutor — un video
              publicado no se puede sacar de internet después.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2.5 rounded-xl border border-swu-border bg-swu-bg p-3">
          <input
            type="checkbox"
            checked={perfil}
            onChange={e => setPerfil(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-swu-cyan">
              <Eye size={11} /> Nombre público · opcional
            </span>
            <span className="mt-1 block text-[12px] leading-snug text-swu-text">
              Que mi nombre de jugador salga completo en la tabla pública y en
              pantalla.
            </span>
            {/* La consecuencia se ve, no se explica: la casilla de arriba y esta
                dicen lo mismo en abstracto, y en abstracto nadie sabe qué está
                eligiendo. Acá se lee el resultado exacto de la decisión. */}
            <span className="mt-1 block text-[10px] leading-snug text-swu-muted">
              Si lo dejás sin marcar entrás igual: en la tabla vas a salir como{' '}
              <span className="font-black text-swu-text">{comoSalgo}</span>.
            </span>
          </span>
        </label>
      </div>

      {/* El error del servidor, entero. Va pegado al botón porque es donde se
          está mirando cuando algo falla. */}
      {error && (
        <p className="mt-3 rounded-xl border border-swu-red/40 bg-swu-red/10 px-3 py-2 text-[12px] leading-snug text-swu-red-texto">
          {error}
        </p>
      )}

      {/* El botón va DESPUÉS de las casillas, siempre. Y dice lo que va a pasar
          si la rejilla quedó vacía, en vez de dejar pasar en silencio la
          decisión que después se paga en el sorteo de grupos. */}
      <button
        onClick={enviar}
        disabled={ocupado || !transmision}
        className="mt-3 min-h-[48px] w-full rounded-xl bg-swu-amber text-[13px] font-black uppercase tracking-wider text-swu-bg disabled:opacity-50"
      >
        {ocupado ? 'Entrando…'
          : sinFranjas(franjas) ? 'Entrar sin marcar horarios'
          : 'Entrar a la liga'}
      </button>
      {!transmision && (
        <p className="mt-1.5 text-center text-[10px] text-swu-muted">
          Marcá el permiso de transmisión para poder entrar.
        </p>
      )}
    </section>
  )
}
