/**
 * ENTRAR A LA LIGA — el alta.
 *
 * Para mucha gente esta va a ser la PRIMERA pantalla de la app: la liga
 * internacional se anuncia en YouTube y se entra por el enlace, así que hay
 * que contar con cuentas recién creadas que no saben nada del resto. Cada
 * campo dice PARA QUÉ se pide; un formulario que pide sin explicar se
 * abandona, y acá abandonarlo es no jugar.
 *
 * ── Pasos, pero solo los que FALTAN ───────────────────────────────────
 *
 * El diseño pedía un asistente de cuatro pasos que se saltan solos cuando el
 * perfil ya los tiene. Medido: 42 de 42 perfiles tienen nombre y 39 de 42
 * tienen país, así que para casi todo el mundo ese asistente son cero pasos y
 * la pantalla de siempre. Por eso no hay paginado ni barra de progreso: se
 * pinta el primer dato que falte y nada más. Quien llega con la cuenta recién
 * hecha ve nombre → país → el resto, de a uno; quien ya tiene perfil no ve
 * ninguno de los dos.
 *
 * Menos ceremonia para los 39 y el mismo camino guiado para los 3.
 *
 * ── El país lo exige el SERVIDOR, y por eso el paso puede venir de él ──
 *
 * `liga_inscribirse` rechaza sin nombre y sin país, y devuelve una clave
 * `falta` diciendo cuál. Eso no es redundante con la comprobación de acá: el
 * perfil se puede haber quedado a medias en otro aparato, o cambiar entre que
 * se pinta esta pantalla y se toca el botón. Cuando el servidor manda `falta`,
 * la pantalla ABRE ese paso en vez de enseñar un error que no se puede
 * resolver sin salir de la liga.
 *
 * ── Los dos consentimientos van SEPARADOS ─────────────────────────────
 *
 *   1. TRANSMISIÓN — obligatorio. Sin esto no hay liga, y no es una regla de
 *      esta pantalla: `liga_inscribirse` rechaza `p_consiente_transmision`
 *      distinto de true (§4l). Acá se dice con todas las letras y ANTES del
 *      botón, no en letra chica debajo.
 *   2. PERFIL PÚBLICO — opcional. Quien diga que no entra igual y sale con
 *      iniciales en la tabla. **El servidor lo cumple**: hasta hoy guardaba el
 *      nombre real igual, y esta pantalla prometía lo contrario.
 *
 * Juntarlos en una sola casilla sería cobrar el segundo con el precio del
 * primero. En esta comunidad hay MENORES y las partidas se publican en
 * YouTube: el que no quiere su nombre completo en pantalla tiene que poder
 * jugar igual.
 */

import { useEffect, useState } from 'react'
import { Radio, Eye, CalendarClock, Swords, Globe2, User, ArrowRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { inscribirseLiga } from '../../services/ligaService'
import { misMazos, type MazoCompartible } from '../../services/galaxiaCompartir'
import { CONTINENTS, getContinentByCountryCode } from '../../data/regions'
import {
  RejillaDisponibilidad, FRANJAS_VACIAS, horasDe, zonaDelAparato,
} from './RejillaDisponibilidad'

/** Lo que el servidor exige por semana. Acá solo se informa; valida él. */
const MINIMO_HORAS = 6

/** «Nelson Darío» → «N. D.» — lo que sale en la tabla si no querés tu nombre. */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  if (partes.length === 0) return '—'
  return partes.map(p => `${p[0].toUpperCase()}.`).join(' ')
}

type Paso = 'nombre' | 'pais' | 'liga'

export function InscripcionLiga({ ligaId, onListo }: { ligaId: string; onListo: () => void }) {
  const { currentProfile, updateProfile } = useAuth()
  const [lider, setLider] = useState('')
  const [base, setBase] = useState('')
  /** El mazo elegido, si tiene alguno cargado en la app. */
  const [deck, setDeck] = useState<string | null>(null)
  const [mazos, setMazos] = useState<MazoCompartible[] | null>(null)
  const [franjas, setFranjas] = useState(FRANJAS_VACIAS)

  /* LOS MAZOS QUE YA TIENE EN LA APP.
     Escribir «Darth Vader» y «Capital City» a mano es pedirle a alguien que
     copie algo que la app YA sabe — y el nombre tecleado no coincide con el del
     catálogo, así que la tabla y el overlay muestran variantes del mismo mazo.
     Si tiene mazos cargados, elegir uno llena los dos campos solo. */
  useEffect(() => {
    if (!currentProfile?.id) return
    let vivo = true
    void misMazos(currentProfile.id).then(m => { if (vivo) setMazos(m) })
    return () => { vivo = false }
  }, [currentProfile?.id])

  /**
   * Elegir un mazo llena líder y base con los NOMBRES, no con los ids.
   *
   * `misMazos` devuelve `cardId`, y lo que el resto del módulo guarda y muestra
   * son nombres: la tabla del grupo, la ficha del overlay y el padrón. Guardar
   * un id ahí pondría un uuid al lado del nombre de la persona, al aire.
   * Los campos quedan EDITABLES: quien tenga su lista fuera de la app sigue
   * pudiendo escribirlos.
   */
  const elegirMazo = async (m: MazoCompartible | null) => {
    setDeck(m?.id ?? null)
    if (!m) return
    const { db } = await import('../../services/db')
    const nombreDe = async (id: string | null) => {
      if (!id) return ''
      const c = await db.cards.get(id)
      return c?.name ?? ''
    }
    const [nl, nb] = await Promise.all([nombreDe(m.lider), nombreDe(m.base)])
    if (nl) setLider(nl)
    if (nb) setBase(nb)
  }
  /**
   * La zona sale de UN solo helper.
   *
   * Antes había dos detectores con fallbacks distintos: esta pantalla caía en
   * `'UTC'` y era la que GUARDABA, y la rejilla caía en `'America/El_Salvador'`
   * y era la que PINTABA. En un aparato donde `Intl` no resuelve, la misma
   * pantalla mostraba una zona y mandaba otra — seis horas de corrimiento sin
   * que nadie mienta, sobre el dato del que cuelga el armado de grupos.
   */
  const [zona, setZona] = useState(zonaDelAparato)
  const [transmision, setTransmision] = useState(false)
  const [perfil, setPerfil] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** El paso que pidió el SERVIDOR. Manda sobre lo que se deduce del perfil. */
  const [pedidoPorElServidor, setPedidoPorElServidor] = useState<Paso | null>(null)

  const nombre = currentProfile?.name?.trim() ?? ''
  const pais = currentProfile?.country?.trim() ?? ''

  const pasoNatural: Paso = !nombre ? 'nombre' : !pais ? 'pais' : 'liga'
  const paso: Paso = pedidoPorElServidor ?? pasoNatural

  const horas = horasDe(franjas)
  const faltanHoras = Math.max(0, MINIMO_HORAS - horas)
  const puedeEntrar = transmision && faltanHoras === 0

  const enviar = () => {
    setOcupado(true)
    setError(null)
    void inscribirseLiga(ligaId, lider.trim(), base.trim(), zona, franjas, transmision, perfil, deck)
      .then(r => {
        setOcupado(false)
        if (r.ok) { onListo(); return }
        /* La clave `falta` abre el paso que corresponde. Solo se obedece para
           los dos pasos que esta pantalla SABE resolver: un `falta` de cupo o
           de liga cerrada no tiene paso que abrir, y ahí el mensaje del
           servidor —que es el que sabe— se muestra tal cual. */
        if (r.falta === 'nombre' || r.falta === 'pais') setPedidoPorElServidor(r.falta)
        setError(r.mensaje ?? 'No se pudo completar la inscripción.')
      })
  }

  if (paso === 'nombre') {
    return (
      <PasoPerfil
        icono={User}
        titulo="¿Cómo te llamás?"
        ayuda="Es el nombre con el que vas a aparecer en la tabla de la liga y cuando presenten tu partida al aire. Podés cambiarlo después desde tu perfil."
        error={error}
        guardar={async v => {
          const r = await updateProfile({ name: v })
          if (r.ok) { setPedidoPorElServidor(null); setError(null) }
          else setError(r.mensaje ?? 'No se pudo guardar.')
          return r.ok
        }}
      />
    )
  }

  if (paso === 'pais') {
    return (
      <PasoPais
        error={error}
        guardar={async code => {
          const cont = getContinentByCountryCode(code)
          const r = await updateProfile({ country: code, continent: cont?.id })
          if (r.ok) { setPedidoPorElServidor(null); setError(null) }
          else setError(r.mensaje ?? 'No se pudo guardar.')
          return r.ok
        }}
      />
    )
  }

  const comoSalgo = perfil ? (nombre || 'Jugador') : iniciales(nombre || 'Jugador')

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
        {/* EL MAZO PRIMERO, si tiene alguno: elegirlo llena los dos campos de
            abajo. Si no tiene ninguno cargado, este selector no se dibuja y
            queda el formulario de siempre — no se le enseña a nadie una lista
            vacía con un «no tenés mazos». */}
        {mazos && mazos.length > 0 && (
          <>
            <select
              value={deck ?? ''}
              onChange={e => void elegirMazo(mazos.find(m => m.id === e.target.value) ?? null)}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-swu-border bg-swu-bg px-3 text-[13px] text-swu-text outline-none focus:border-swu-accent"
            >
              <option value="">Elegí tu mazo (opcional)</option>
              {mazos.map(m => (
                <option key={m.id} value={m.id}>
                  {m.nombre} · {m.cartas} cartas
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] leading-snug text-swu-muted">
              Lo ve quien organiza, para armar los grupos y presentar tu partida al aire.
              No se publica durante la inscripción.
            </p>
          </>
        )}
        <input
          value={lider}
          onChange={e => setLider(e.target.value.slice(0, 60))}
          placeholder="Tu líder — ej. Darth Vader"
          className="mt-2 w-full rounded-xl border border-swu-border bg-swu-bg px-3 py-2.5 text-[13px] text-swu-text outline-none focus:border-swu-accent"
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

      {/* ── 2 · Cuándo podés ──
          El texto dice lo que el sistema HACE HOY con este dato, no lo que va a
          hacer. Decía «los grupos se arman juntando a quienes coinciden en
          horario» y el armado todavía reparte por tier y orden de inscripción:
          prometerle a alguien que esto decide contra quién le toca, cuando no,
          es la clase de mentira que se descubre en la jornada 1. */}
      <div className="mt-4">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-swu-muted">
          <CalendarClock size={12} /> Cuándo podés jugar
        </p>
        <p className="mt-1 text-[10px] leading-snug text-swu-muted">
          Con esto el organizador arma el calendario y sabe a qué hora hay gente
          para transmitir. Marcá tus horas de verdad: es lo que va a usar tu
          rival para proponerte cuándo jugar.
        </p>
        <div className="mt-2">
          <RejillaDisponibilidad
            valor={franjas}
            onCambio={setFranjas}
            zona={zona}
            onZona={setZona}
          />
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
                eligiendo. Acá se lee el resultado exacto de la decisión — y el
                servidor guarda EXACTAMENTE esto, con las mismas iniciales. */}
            <span className="mt-1 block text-[10px] leading-snug text-swu-muted">
              Si lo dejás sin marcar entrás igual: en la tabla vas a salir como{' '}
              <span className="font-black text-swu-text">{comoSalgo}</span>. Lo
              podés cambiar cuando quieras.
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

      {/* EL BOTÓN NO OFRECE LO QUE EL SERVIDOR PROHÍBE.
          Decía «Entrar sin marcar horarios» y el servidor contestaba «marcá al
          menos 6 horas»: ofrecía exactamente lo único que no se puede hacer. Un
          botón que promete un camino cerrado es peor que uno deshabilitado,
          porque el rechazo llega DESPUÉS de haber llenado todo lo demás. */}
      <button
        onClick={enviar}
        disabled={ocupado || !puedeEntrar}
        className="mt-3 min-h-[48px] w-full rounded-xl bg-swu-amber text-[13px] font-black uppercase tracking-wider text-swu-bg disabled:opacity-50"
      >
        {ocupado ? 'Entrando…' : 'Entrar a la liga'}
      </button>
      {/* Lo que falta, en el orden en que se resuelve, y de a uno: dos avisos a
          la vez se leen como una lista de quejas. */}
      {!transmision ? (
        <p className="mt-1.5 text-center text-[10px] text-swu-muted">
          Marcá el permiso de transmisión para poder entrar.
        </p>
      ) : faltanHoras > 0 ? (
        <p className="mt-1.5 text-center text-[10px] text-swu-muted">
          {horas === 0
            ? `Marcá al menos ${MINIMO_HORAS} horas en las que puedas jugar.`
            : `Te faltan ${faltanHoras} h: la liga pide ${MINIMO_HORAS} por semana.`}
        </p>
      ) : null}
    </section>
  )
}

/* ── Los pasos que solo ven las cuentas recién creadas ──────────────── */

/** Un dato del PERFIL que la liga necesita. Se guarda en el perfil, no en la liga. */
export function PasoPerfil({ icono: Icono, titulo, ayuda, error, guardar }: {
  icono: typeof User
  titulo: string
  ayuda: string
  error: string | null
  guardar: (valor: string) => Promise<boolean>
}) {
  const [valor, setValor] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const listo = valor.trim().length >= 2

  return (
    <section className="rounded-2xl border border-swu-amber/40 bg-swu-amber/5 p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-swu-muted">
        <Icono size={12} /> Falta un dato
      </p>
      <h2 className="mt-1 text-[15px] font-black tracking-tight text-swu-text">{titulo}</h2>
      <p className="mt-1 text-[11px] leading-snug text-swu-muted">{ayuda}</p>
      <input
        value={valor}
        onChange={e => setValor(e.target.value.slice(0, 40))}
        placeholder="Tu nombre de jugador"
        className="mt-3 w-full rounded-xl border border-swu-border bg-swu-bg px-3 py-2.5 text-[13px] text-swu-text outline-none focus:border-swu-accent"
      />
      {error && (
        <p className="mt-2 rounded-xl border border-swu-red/40 bg-swu-red/10 px-3 py-2 text-[12px] leading-snug text-swu-red-texto">
          {error}
        </p>
      )}
      <button
        disabled={!listo || ocupado}
        onClick={() => { setOcupado(true); void guardar(valor.trim()).finally(() => setOcupado(false)) }}
        className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-swu-amber text-[13px] font-black uppercase tracking-wider text-swu-bg disabled:opacity-50"
      >
        {ocupado ? 'Guardando…' : 'Seguir'} <ArrowRight size={14} />
      </button>
    </section>
  )
}

/**
 * El país.
 *
 * Va como UN desplegable agrupado por continente y no como dos pasos
 * (continente → país): el nativo del teléfono ya deja escribir para buscar, y
 * partirlo en dos es un toque más para un dato que casi todos resuelven de
 * memoria. La lista sale de `CONTINENTS`, que es la misma que usa el resto de
 * la app — una lista propia acá se quedaría vieja sola.
 */
export function PasoPais({ error, guardar }: {
  error: string | null
  guardar: (code: string) => Promise<boolean>
}) {
  const [code, setCode] = useState('')
  const [ocupado, setOcupado] = useState(false)

  return (
    <section className="rounded-2xl border border-swu-amber/40 bg-swu-amber/5 p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-swu-muted">
        <Globe2 size={12} /> Falta un dato
      </p>
      <h2 className="mt-1 text-[15px] font-black tracking-tight text-swu-text">¿De dónde sos?</h2>
      <p className="mt-1 text-[11px] leading-snug text-swu-muted">
        Es una liga internacional: tu país sale con tu bandera en la tabla y es
        lo que arma el ranking por países. Queda en tu perfil, así que lo
        elegís una sola vez.
      </p>
      <select
        value={code}
        onChange={e => setCode(e.target.value)}
        className="mt-3 w-full rounded-xl border border-swu-border bg-swu-bg px-3 py-3 text-[13px] text-swu-text outline-none focus:border-swu-accent"
      >
        <option value="">Elegí tu país…</option>
        {CONTINENTS.map(c => (
          <optgroup key={c.id} label={`${c.icon} ${c.name}`}>
            {c.countries.map(p => (
              <option key={p.code} value={p.code}>{p.flag} {p.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
      {error && (
        <p className="mt-2 rounded-xl border border-swu-red/40 bg-swu-red/10 px-3 py-2 text-[12px] leading-snug text-swu-red-texto">
          {error}
        </p>
      )}
      <button
        disabled={!code || ocupado}
        onClick={() => { setOcupado(true); void guardar(code).finally(() => setOcupado(false)) }}
        className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-swu-amber text-[13px] font-black uppercase tracking-wider text-swu-bg disabled:opacity-50"
      >
        {ocupado ? 'Guardando…' : 'Seguir'} <ArrowRight size={14} />
      </button>
    </section>
  )
}
