/**
 * MeleeRecord — el historial de torneos de melee.gg dentro de un perfil.
 *
 * Se usa en el perfil propio, en el público y en Espionaje, así que no asume
 * que la persona que mira sea la dueña.
 *
 * ── Por qué el puesto nunca va solo ───────────────────────────────────
 *
 * Sacado de datos reales: un puesto 399 en el Galactic Open es 399 de 1022
 * —mejor que la mitad de la sala— y un puesto 3 en un Weekly Play puede ser
 * 3 de 4. Mostrar «399» y «3» uno debajo del otro haría ver al segundo mejor
 * que al primero, que es exactamente al revés. Por eso siempre va «399 de
 * 1022» y una barra de percentil, y cuando la fuente no dice cuántos jugaron,
 * NO se inventa un percentil: se deja el puesto y se calla.
 */

import { useState, useEffect } from 'react'
import { ExternalLink, Trophy, RefreshCw, ShieldCheck, ShieldAlert, Swords } from 'lucide-react'
import {
  traerResultadosMelee, agregar, percentil, urlPerfilMelee, urlTorneoMelee, urlMazoMelee,
  leerEnlaceMelee, MeleeNoExiste,
  type MeleePerfil, type MeleeResultado,
} from '../../services/meleeProfileService'
import { fechaCortaSinZona } from '../../services/horaSV'

interface Props {
  usuario: string
  /** Un admin confirmó que la cuenta es de esta persona. */
  verificado?: boolean
  /** Cambia el texto vacío: no es lo mismo «no jugaste» que «no jugó». */
  esPropio?: boolean
}

function Dato({ etiqueta, valor, tono = 'text-swu-text' }: {
  etiqueta: string; valor: string; tono?: string
}) {
  return (
    <div className="flex-1 min-w-0 text-center">
      <div className={`text-lg font-extrabold font-mono leading-none ${tono}`}>{valor}</div>
      <div className="text-[9px] uppercase tracking-wider text-swu-muted mt-1">{etiqueta}</div>
    </div>
  )
}

/** Barra de percentil. 100 = ganó el torneo, 0 = último. */
function Percentil({ p }: { p: number }) {
  const tono = p >= 90 ? 'bg-swu-amber' : p >= 60 ? 'bg-swu-green' : p >= 30 ? 'bg-swu-cyan' : 'bg-swu-muted'
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-12 rounded-full bg-swu-border overflow-hidden">
        <div className={`h-full ${tono}`} style={{ width: `${p}%` }} />
      </div>
      <span className="text-[9px] font-mono text-swu-muted tabular-nums">{p}%</span>
    </div>
  )
}

function Fila({ r }: { r: MeleeResultado }) {
  const p = percentil(r)
  /**
   * La fecha de melee NO se convierte a hora de El Salvador, y es a propósito.
   *
   * Viene como `2026-08-01T09:00:00` —sin desfase, medido en la ingesta— o
   * sea el reloj de pared de la sala donde se jugó, en un país que no sabemos.
   * `new Date()` le inventaría la zona del dispositivo; formatearla «en SV»
   * después le inventaría una segunda. Con el teléfono en Tokio, ese mismo
   * torneo caería el 31 de julio a las 18:00 de El Salvador y la fila diría
   * **31 jul** un torneo que melee publica el 1 de agosto.
   *
   * Un torneo ajeno tiene la fecha que publica su organizador. Se muestra esa.
   */
  const fecha = fechaCortaSinZona(r.fecha)
  return (
    <li className="py-2.5 border-b border-swu-border/60 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <a
            href={urlTorneoMelee(r.torneoId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-swu-text hover:text-swu-cyan truncate block"
          >
            {r.torneo}
          </a>
          <div className="text-[10px] text-swu-muted mt-0.5 flex flex-wrap items-center gap-x-2">
            {fecha && <span className="font-mono">{fecha}</span>}
            {r.organizador && <span className="truncate">{r.organizador}</span>}
            {r.formato && <span className="text-swu-cyan/70">{r.formato}</span>}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          {/* El puesto SIEMPRE con el tamaño de la sala al lado. */}
          <div className="text-sm font-bold font-mono text-swu-text tabular-nums leading-none">
            {r.puesto !== null ? (
              r.participantes
                ? <>{r.puesto}<span className="text-swu-muted font-normal"> de {r.participantes}</span></>
                : <>{r.puesto}.º</>
            ) : '—'}
          </div>
          {r.record && (
            <div className="text-[10px] font-mono text-swu-muted mt-0.5">{r.record}</div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-1.5">
        {p !== null ? <Percentil p={p} /> : <span className="text-[9px] text-swu-muted/60">sin datos de la sala</span>}
        {/* Al mazo se ENLAZA, nunca se descarga: su robots.txt lo prohíbe. */}
        {r.decklistId && (
          <a
            href={urlMazoMelee(r.decklistId)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-swu-cyan hover:underline flex items-center gap-1"
          >
            {r.decklistNombre || 'Mazo'} <ExternalLink size={9} aria-hidden />
          </a>
        )}
      </div>
    </li>
  )
}

export function MeleeRecord({ usuario, verificado = false, esPropio = false }: Props) {
  const [perfil, setPerfil] = useState<MeleePerfil | null>(null)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error' | 'no-existe'>('cargando')
  const [refrescando, setRefrescando] = useState(false)

  useEffect(() => {
    let vivo = true
    setEstado('cargando')
    traerResultadosMelee(usuario)
      .then(p => { if (vivo) { setPerfil(p); setEstado('listo') } })
      .catch((e: unknown) => {
        if (!vivo) return
        setEstado(e instanceof MeleeNoExiste ? 'no-existe' : 'error')
      })
    return () => { vivo = false }
  }, [usuario])

  const refrescar = async () => {
    setRefrescando(true)
    try {
      const p = await traerResultadosMelee(usuario, { forzar: true })
      setPerfil(p)
      setEstado('listo')
    } catch {
      // Se conserva lo que ya estaba: mejor datos viejos que una pantalla vacía.
    } finally {
      setRefrescando(false)
    }
  }

  const ag = perfil ? agregar(perfil.resultados) : null

  return (
    <div className="bg-swu-surface rounded-xl border border-swu-border overflow-hidden">
      <div className="px-3 py-2.5 flex items-center gap-2 border-b border-swu-border">
        <Swords size={15} className="text-swu-cyan flex-shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-swu-text leading-tight">Circuito Melee</h3>
          <a
            href={urlPerfilMelee(usuario)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-swu-muted hover:text-swu-cyan flex items-center gap-1"
          >
            @{usuario} <ExternalLink size={9} aria-hidden />
          </a>
        </div>

        {/* Melee no expone ningún campo editable en el perfil público, así que
            no hay forma técnica de probar de quién es la cuenta. Se dice. */}
        {verificado ? (
          <span
            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-swu-green"
            title="Un administrador confirmó que esta cuenta de melee es de esta persona"
          >
            <ShieldCheck size={12} aria-hidden /> Verificado
          </span>
        ) : (
          <span
            className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-swu-muted"
            title="Nadie confirmó todavía que esta cuenta de melee sea de esta persona"
          >
            <ShieldAlert size={12} aria-hidden /> Sin verificar
          </span>
        )}

        <button
          onClick={() => void refrescar()}
          disabled={refrescando}
          aria-label="Actualizar desde melee.gg"
          className="p-1 text-swu-muted hover:text-swu-cyan disabled:opacity-40"
        >
          <RefreshCw size={13} className={refrescando ? 'animate-spin' : ''} aria-hidden />
        </button>
      </div>

      {estado === 'cargando' && (
        <div className="p-4 space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-9 rounded carta-esqueleto" />
          ))}
        </div>
      )}

      {estado === 'no-existe' && (
        <p className="p-4 text-xs text-swu-red-texto">
          melee.gg no tiene un perfil «{usuario}».
          {esPropio && ' Revisá cómo lo escribiste en tu perfil.'}
        </p>
      )}

      {estado === 'error' && (
        <p className="p-4 text-xs text-swu-muted">
          No se pudo consultar melee.gg ahora. Probá con el botón de actualizar.
        </p>
      )}

      {estado === 'listo' && perfil && ag && (
        <>
          {perfil.resultados.length === 0 ? (
            <p className="p-4 text-xs text-swu-muted">
              {esPropio
                ? 'Todavía no tenés torneos de Star Wars: Unlimited registrados en melee.'
                : 'Sin torneos de Star Wars: Unlimited en melee.'}
              {perfil.totalEnMelee > 0 && (
                <> Tiene {perfil.totalEnMelee} de otros juegos, que no se cuentan acá.</>
              )}
            </p>
          ) : (
            <>
              <div className="flex items-stretch gap-1 px-3 py-3 bg-swu-bg/40">
                <Dato etiqueta="Torneos" valor={String(ag.torneos)} />
                <div className="w-px bg-swu-border" />
                <Dato
                  etiqueta="Récord"
                  valor={`${ag.victorias}-${ag.derrotas}${ag.empates ? `-${ag.empates}` : ''}`}
                />
                <div className="w-px bg-swu-border" />
                <Dato
                  etiqueta="Victorias"
                  valor={ag.porcentajeVictorias !== null ? `${ag.porcentajeVictorias}%` : '—'}
                  tono={
                    ag.porcentajeVictorias !== null && ag.porcentajeVictorias >= 50
                      ? 'text-swu-green' : 'text-swu-text'
                  }
                />
                {ag.mejorPercentil !== null && (
                  <>
                    <div className="w-px bg-swu-border" />
                    <Dato etiqueta="Mejor" valor={`${ag.mejorPercentil}%`} tono="text-swu-amber" />
                  </>
                )}
              </div>

              {ag.mejorTorneo && ag.mejorPercentil !== null && (
                <p className="px-3 pb-2 text-[10px] text-swu-muted flex items-center gap-1">
                  <Trophy size={10} className="text-swu-amber flex-shrink-0" aria-hidden />
                  <span className="truncate">
                    Mejor: {ag.mejorTorneo.puesto} de {ag.mejorTorneo.participantes} en {ag.mejorTorneo.torneo}
                  </span>
                </p>
              )}

              <ul className="px-3 pb-2">
                {perfil.resultados.map(r => <Fila key={`${r.torneoId}-${r.fecha}`} r={r} />)}
              </ul>
            </>
          )}

          {/* Atribución: los datos son de ellos y se enlaza de vuelta. */}
          <p className="px-3 py-2 text-[9px] text-swu-muted/70 border-t border-swu-border">
            Datos de{' '}
            <a
              href={perfil.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-swu-cyan/70 hover:underline"
            >
              {perfil.source.nombre}
            </a>
          </p>
        </>
      )}
    </div>
  )
}

/**
 * La misma sección pero resolviendo el enlace a partir del id de usuario.
 *
 * Existe para poder montarla en el perfil público y en Espionaje sin tocar
 * cómo cada una de esas pantallas carga sus datos: si la persona no enlazó
 * ninguna cuenta, no se dibuja NADA —ni un recuadro vacío ni un «no tiene»—,
 * porque no enlazar es lo normal y no es una carencia que haya que anunciar.
 */
export function MeleeRecordDeUsuario({ userId }: { userId: string }) {
  const [enlace, setEnlace] = useState<{ usuario: string | null; verificado: boolean } | null>(null)

  useEffect(() => {
    let vivo = true
    void leerEnlaceMelee(userId).then(r => { if (vivo) setEnlace(r) })
    return () => { vivo = false }
  }, [userId])

  if (!enlace?.usuario) return null
  return <MeleeRecord usuario={enlace.usuario} verificado={enlace.verificado} />
}
