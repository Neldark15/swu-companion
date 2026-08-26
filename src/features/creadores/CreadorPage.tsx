/**
 * LA CASA DEL CREADOR — `/c/:code` (demo: /c/puente3)
 *
 * ── Qué es ────────────────────────────────────────────────────────────
 *
 * La página pública de un creador de contenido: su logo, su canal y SU LIGA.
 * Es lo que Alejo pone en la descripción de su canal de YouTube. Si el que
 * mira es EL creador, la misma página enseña además el panel de mando: crear
 * la liga, abrir/cerrar inscripción, y subir su logo.
 *
 * ── El demo cerrado ───────────────────────────────────────────────────
 *
 * Las policies del servidor solo dejan ver esto a los creadores y a los
 * admins. Para cualquier otra cuenta las consultas vuelven VACÍAS, así que
 * esta pantalla dice «en pruebas» sin pedir permiso a nadie: la cerradura ya
 * actuó en Postgres (§3i-bis). Cuando el espacio se abra, cambia UNA función
 * en el servidor y esta página no se toca.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Youtube, Lock, Upload, Trophy, Users, PlayCircle } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  getCreador, getLigaDeCreador, getInscripciones, getPartidas, tablaDe,
  crearLiga, abrirInscripcion, cerrarInscripcion, cerrarLiga, subirLogo,
  type Creador, type Liga, type InscripcionLiga, type PartidaLiga,
} from '../../services/ligaService'

/** Mismo compresor que el avatar del perfil: canvas → JPEG data URI. */
async function comprimirLogo(file: File, maxLado = 512, calidad = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > height) { if (width > maxLado) { height *= maxLado / width; width = maxLado } }
      else if (height > maxLado) { width *= maxLado / height; height = maxLado }
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', calidad))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export function CreadorPage() {
  const { code } = useParams<{ code: string }>()
  const { supabaseUser } = useAuth()
  const [creador, setCreador] = useState<Creador | null>(null)
  const [liga, setLiga] = useState<Liga | null>(null)
  const [inscripciones, setInscripciones] = useState<InscripcionLiga[]>([])
  const [partidas, setPartidas] = useState<PartidaLiga[]>([])
  const [cargando, setCargando] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const archivoRef = useRef<HTMLInputElement>(null)

  const [recarga, setRecarga] = useState(0)
  const recargar = useCallback(() => setRecarga(n => n + 1), [])

  useEffect(() => {
    if (!code) return
    let vivo = true
    void (async () => {
      const c = await getCreador(code)
      if (!vivo) return
      setCreador(c)
      if (c) {
        const l = await getLigaDeCreador(c.userId)
        if (!vivo) return
        setLiga(l)
        if (l) {
          const [ins, par] = await Promise.all([getInscripciones(l.id), getPartidas(l.id)])
          if (!vivo) return
          setInscripciones(ins)
          setPartidas(par)
        }
      }
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [code, recarga])

  const soyElCreador = !!creador && supabaseUser?.id === creador.userId
  const tabla = useMemo(() => tablaDe(inscripciones, partidas), [inscripciones, partidas])
  const conVod = useMemo(() => partidas.filter(p => p.vodYoutubeId), [partidas])
  const porNombre = useMemo(
    () => new Map(inscripciones.map(i => [i.id, i.nombre])), [inscripciones])

  const elegirLogo = useCallback(async (file: File | undefined) => {
    if (!file) return
    setOcupado(true); setAviso(null)
    try {
      const dataUri = await comprimirLogo(file)
      const r = await subirLogo(dataUri)
      setAviso(r.ok ? 'Logo actualizado' : (r.mensaje ?? 'No se pudo subir'))
      if (r.ok) recargar()
    } catch {
      setAviso('Esa imagen no se pudo leer')
    }
    setOcupado(false)
  }, [recargar])

  if (cargando) {
    return <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-swu-muted">Abriendo el estudio…</div>
  }

  if (!creador) {
    /* O no existe, o el demo no te incluye: el servidor devuelve vacío en los
       dos casos y la pantalla no distingue a propósito — decir «existe pero no
       podés verlo» ya es contar algo. */
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Lock size={26} className="mx-auto mb-3 text-swu-muted" />
        <p className="text-[15px] font-black text-swu-text">El Espacio de Creadores está en pruebas</p>
        <p className="mt-1 text-[12px] text-swu-muted">Pronto va a estar abierto para toda la comunidad.</p>
        <Link to="/" className="mt-5 inline-block text-[13px] text-swu-cyan">Volver a Inicio</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3 pb-28">
      <div className="mb-3 flex items-center gap-2">
        <Link to="/" className="-ml-1 p-1 text-swu-muted hover:text-swu-text"><ChevronLeft size={18} /></Link>
        <span className="rounded-full border border-swu-amber/40 bg-swu-amber/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-swu-amber">
          Espacio de creadores · demo
        </span>
      </div>

      {/* ── La marca ── */}
      <div className="relative overflow-hidden rounded-2xl border border-swu-border bg-gradient-to-b from-[#101018] to-[#181422] p-5 text-center">
        {creador.logo ? (
          <img src={creador.logo} alt={creador.nombre} className="mx-auto mb-3 h-24 w-24 rounded-2xl object-cover" />
        ) : (
          <div className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-swu-border text-[10px] text-swu-muted">
            Sin logo
          </div>
        )}
        <h1 className="text-xl font-black tracking-tight text-swu-text">{creador.nombre}</h1>
        {creador.canalYoutube && (
          <a
            href={creador.canalYoutube} target="_blank" rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-bold text-swu-red-texto"
          >
            <Youtube size={14} /> Ver el canal
          </a>
        )}
        {soyElCreador && (
          <div className="mt-3">
            <input
              ref={archivoRef} type="file" accept="image/*" className="hidden"
              onChange={e => void elegirLogo(e.target.files?.[0])}
            />
            <button
              onClick={() => archivoRef.current?.click()}
              disabled={ocupado}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-swu-border px-3 text-[11px] font-bold text-swu-text disabled:opacity-60"
            >
              <Upload size={13} /> {creador.logo ? 'Cambiar logo' : 'Subir mi logo'}
            </button>
          </div>
        )}
      </div>

      {aviso && (
        <p className="mt-2 rounded-xl border border-swu-border bg-swu-surface px-3 py-2 text-center text-[12px] text-swu-text">{aviso}</p>
      )}

      {/* ── La liga ── */}
      {liga ? (
        <section className="mt-4 rounded-2xl border border-swu-border bg-swu-surface p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-black text-swu-text">{liga.nombre}</h2>
            <span className="text-[10px] font-black uppercase tracking-wider text-swu-amber">
              {liga.estado === 'borrador' ? 'En preparación'
                : liga.estado === 'inscripcion' ? 'Inscripción abierta'
                : liga.estado === 'activa' ? 'En juego' : 'Cerrada'}
            </span>
          </div>
          {liga.descripcion && <p className="mt-1 text-[12px] text-swu-muted">{liga.descripcion}</p>}
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-swu-muted">
            <Users size={12} /> {inscripciones.filter(i => !i.retirado).length} / {liga.cupo} inscritos
          </p>

          {/* Tabla resumida: el detalle vive en /liga/:code */}
          {tabla.length > 0 && liga.estado !== 'inscripcion' && (
            <div className="mt-3 divide-y divide-swu-border rounded-xl border border-swu-border">
              {tabla.slice(0, 5).map((f, i) => (
                <div key={f.inscId} className="flex items-center gap-2 px-3 py-2">
                  <span className={`w-5 text-center text-[11px] font-black ${i === 0 ? 'text-swu-amber' : 'text-swu-muted'}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-swu-text">{f.nombre}</span>
                  <span className="text-[11px] tabular-nums text-swu-muted">{f.ganadas}-{f.perdidas}</span>
                  <span className="w-8 text-right text-[12px] font-black tabular-nums text-swu-text">{f.puntos}</span>
                </div>
              ))}
            </div>
          )}

          <Link
            to={`/liga/${liga.code}`}
            className="mt-3 flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-swu-amber text-[13px] font-black uppercase tracking-wider text-swu-bg"
          >
            <Trophy size={15} /> Ver la liga completa
          </Link>

          {/* ── El mando del creador ── */}
          {soyElCreador && (
            <div className="mt-3 flex flex-wrap gap-2">
              {liga.estado === 'borrador' && (
                <BotonAccion rotulo="Abrir inscripción" alTocar={async () => {
                  const r = await abrirInscripcion(liga.id); setAviso(r.ok ? 'Inscripción abierta' : r.mensaje ?? null); recargar()
                }} />
              )}
              {liga.estado === 'inscripcion' && (
                <BotonAccion rotulo="Cerrar inscripción y sortear el calendario" alTocar={async () => {
                  const r = await cerrarInscripcion(liga.id)
                  setAviso(r.ok ? `Calendario listo: ${String(r.extra?.jornadas ?? '?')} jornadas` : r.mensaje ?? null)
                  recargar()
                }} />
              )}
              {liga.estado === 'activa' && (
                <BotonAccion rotulo="Cerrar la liga" alTocar={async () => {
                  const r = await cerrarLiga(liga.id); setAviso(r.ok ? 'Liga cerrada' : r.mensaje ?? null); recargar()
                }} />
              )}
            </div>
          )}
        </section>
      ) : soyElCreador ? (
        <FormularioNuevaLiga alCrear={recargar} alAvisar={setAviso} />
      ) : (
        <p className="mt-4 rounded-2xl border border-swu-border bg-swu-surface px-4 py-6 text-center text-[12px] text-swu-muted">
          {creador.nombre} todavía no tiene una liga en marcha.
        </p>
      )}

      {/* ── El estante de VODs ── */}
      {conVod.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-swu-muted">
            <PlayCircle size={13} /> Partidas grabadas
          </h2>
          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
            {conVod.map(p => (
              <a
                key={p.id}
                href={`https://www.youtube.com/watch?v=${p.vodYoutubeId}${p.vodT ? `&t=${p.vodT}` : ''}`}
                target="_blank" rel="noopener noreferrer"
                className="w-56 shrink-0 snap-start overflow-hidden rounded-xl border border-swu-border bg-swu-bg"
              >
                <img
                  src={`https://i.ytimg.com/vi/${p.vodYoutubeId}/mqdefault.jpg`}
                  alt="" className="aspect-video w-full object-cover"
                />
                <p className="truncate px-2.5 py-1.5 text-[11px] font-bold text-swu-text">
                  J{p.jornada} · {porNombre.get(p.localInsc)} vs {porNombre.get(p.visitaInsc)}
                </p>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function BotonAccion({ rotulo, alTocar }: { rotulo: string; alTocar: () => Promise<void> }) {
  const [ocupado, setOcupado] = useState(false)
  return (
    <button
      onClick={() => { setOcupado(true); void alTocar().finally(() => setOcupado(false)) }}
      disabled={ocupado}
      className="min-h-[40px] rounded-xl border border-swu-amber/50 bg-swu-amber/10 px-3 text-[11px] font-black uppercase tracking-wider text-swu-amber disabled:opacity-60"
    >{rotulo}</button>
  )
}

function FormularioNuevaLiga({ alCrear, alAvisar }: { alCrear: () => void; alAvisar: (m: string | null) => void }) {
  const [nombre, setNombre] = useState('')
  const [code, setCode] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [cupo, setCupo] = useState(8)
  const [ocupado, setOcupado] = useState(false)

  const crear = useCallback(async () => {
    setOcupado(true)
    const r = await crearLiga(code.trim().toLowerCase(), nombre.trim(), descripcion.trim(), cupo)
    alAvisar(r.ok ? 'Liga creada. Abrila a inscripción cuando quieras.' : r.mensaje ?? null)
    if (r.ok) alCrear()
    setOcupado(false)
  }, [code, nombre, descripcion, cupo, alCrear, alAvisar])

  return (
    <section className="mt-4 rounded-2xl border border-swu-border bg-swu-surface p-4">
      <h2 className="text-[13px] font-black uppercase tracking-wider text-swu-text">Armá tu liga</h2>
      <p className="mt-1 text-[11px] text-swu-muted">
        Round-robin: todos contra todos, una jornada por semana. Al cerrar la
        inscripción, el calendario completo se sortea de una vez — así podés
        anunciar los cruces con anticipación.
      </p>
      <div className="mt-3 space-y-2">
        <input
          value={nombre} onChange={e => setNombre(e.target.value.slice(0, 60))}
          placeholder="Nombre — ej. Liga PUENTE 3 · Temporada 1"
          className="w-full rounded-xl border border-swu-border bg-swu-bg px-3 py-2.5 text-[13px] text-swu-text outline-none focus:border-swu-accent"
        />
        <input
          value={code} onChange={e => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32))}
          placeholder="Código para el enlace — ej. puente3-t1"
          className="w-full rounded-xl border border-swu-border bg-swu-bg px-3 py-2.5 text-[13px] font-mono text-swu-text outline-none focus:border-swu-accent"
        />
        <textarea
          value={descripcion} onChange={e => setDescripcion(e.target.value.slice(0, 240))}
          placeholder="Descripción (opcional)"
          rows={2}
          className="w-full rounded-xl border border-swu-border bg-swu-bg px-3 py-2.5 text-[13px] text-swu-text outline-none focus:border-swu-accent"
        />
        <label className="flex items-center justify-between text-[12px] text-swu-muted">
          Cupo de jugadores
          <select
            value={cupo} onChange={e => setCupo(Number(e.target.value))}
            className="rounded-lg border border-swu-border bg-swu-bg px-2 py-1.5 text-swu-text"
          >
            {[4, 6, 8, 10, 12, 16].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button
          onClick={() => void crear()}
          disabled={ocupado || !nombre.trim() || code.length < 2}
          className="min-h-[46px] w-full rounded-xl bg-swu-amber text-[13px] font-black uppercase tracking-wider text-swu-bg disabled:opacity-50"
        >Crear la liga</button>
      </div>
    </section>
  )
}
