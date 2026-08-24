/**
 * EL TALLER — armá tu sable, comprá piezas con XP. `/sable`
 *
 * ── Está cerrado, y la cerradura NO está acá ──────────────────────────
 *
 * La pantalla se rinde si `sable_taller()` no devuelve `ok`, pero eso es una
 * CORTINA, no una cerradura: `isAdmin` y los roles viven en localStorage y el
 * gate de cliente se salta con la consola. Lo que cierra de verdad es el
 * `if not es_probador_sable()` que está DENTRO de cada RPC — la misma lección
 * que costó una prueba en el Centro de Temporada (§3i-bis), donde un admin no
 * curador leía la temporada entera porque el guardia estaba solo en la UI.
 *
 * Y a propósito no hay entrada en ningún menú: se entra tecleando `/sable`,
 * igual que `/temporada`.
 *
 * ── Se paga con XP porque el XP no tenía para qué servir ──────────────
 *
 * Medido: el XP no tiene sumidero en toda la app. Solo entra —misiones,
 * torneos, y 50 por sobre abierto— y lo único que hace es subir el nivel.
 * Pagar con sobres competiría con abrirlos, y con 333 sobres sin abrir eso es
 * lo último que hace falta.
 *
 * ── El nivel NO baja al comprar ───────────────────────────────────────
 *
 * El saldo es `xp total − lo gastado`, derivado en el servidor. `player_stats.xp`
 * nunca baja, así que gastar no te degrada.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Check, Lock, Power, Save, Coins } from 'lucide-react'
import { SableEscena } from './SableEscena'
import { POR_DEFECTO, type Diseno } from './partesSable'
import {
  abrirTaller, comprarParte, guardarSable,
  type ParteTaller, type Taller,
} from '../../services/sableService'

const RANURAS: { tipo: ParteTaller['tipo']; rotulo: string }[] = [
  { tipo: 'emisor', rotulo: 'Emisor' },
  { tipo: 'cuerpo', rotulo: 'Empuñadura' },
  { tipo: 'pomo', rotulo: 'Pomo' },
  { tipo: 'color', rotulo: 'Cristal' },
]

export function SablePage() {
  const [taller, setTaller] = useState<Taller | null>(null)
  const [cargando, setCargando] = useState(true)
  const [diseno, setDiseno] = useState<Diseno>(POR_DEFECTO)
  const [nombre, setNombre] = useState('')
  const [encendido, setEncendido] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [sinWebGL, setSinWebGL] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  /* Se sube para volver a consultar (tras comprar). Es una dependencia real del
     efecto, que es como el resto de la app hace las recargas — un `useCallback`
     llamado DESDE el efecto cuenta como escritura síncrona de estado. */
  const [recarga, setRecarga] = useState(0)
  const cargar = useCallback(() => setRecarga(n => n + 1), [])

  useEffect(() => {
    let vivo = true
    void (async () => {
      const t = await abrirTaller()
      if (!vivo) return
      setTaller(t)
      if (t?.diseno) {
        setDiseno({ emisor: t.diseno.emisor, cuerpo: t.diseno.cuerpo, pomo: t.diseno.pomo, color: t.diseno.color })
        setNombre(t.diseno.nombre ?? '')
      }
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [recarga])

  const porTipo = useMemo(() => {
    const m = new Map<string, ParteTaller[]>()
    for (const p of taller?.partes ?? []) {
      const l = m.get(p.tipo) ?? []
      l.push(p); m.set(p.tipo, l)
    }
    return m
  }, [taller])

  const elegir = useCallback((tipo: ParteTaller['tipo'], p: ParteTaller) => {
    if (!p.tengo) return
    setDiseno(d => ({ ...d, [tipo]: p.id }))
    setAviso(null)
  }, [])

  const comprar = useCallback(async (p: ParteTaller) => {
    setOcupado(true); setAviso(null)
    const r = await comprarParte(p.id)
    if (!r.ok) { setAviso(r.mensaje ?? 'No se pudo comprar'); setOcupado(false); return }
    // Se relee del servidor en vez de parchear el estado: el saldo es derivado
    // y el servidor es el que sabe cuánto quedó.
    cargar()
    setDiseno(d => ({ ...d, [p.tipo]: p.id }))
    setAviso(`Comprada: ${p.nombre}`)
    setOcupado(false)
  }, [cargar])

  const guardar = useCallback(async () => {
    setOcupado(true); setAviso(null)
    const r = await guardarSable(diseno, nombre)
    setAviso(r.ok ? 'Guardado' : (r.mensaje ?? 'No se pudo guardar'))
    setOcupado(false)
  }, [diseno, nombre])

  if (cargando) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-swu-muted">
        Abriendo el taller…
      </div>
    )
  }

  if (!taller) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Lock size={26} className="mx-auto mb-3 text-swu-muted" />
        <p className="text-[15px] font-black text-swu-text">El taller todavía no está abierto</p>
        <p className="mt-1 text-[12px] text-swu-muted">
          Está en pruebas. Si tenés que entrar, se reparte a mano desde la base.
        </p>
        <Link to="/" className="mt-5 inline-block text-[13px] text-swu-cyan">Volver a Inicio</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3 pb-24">
      <div className="mb-3 flex items-center justify-between">
        <Link to="/" className="-ml-1 flex items-center gap-1 p-1 text-sm text-swu-muted hover:text-swu-text">
          <ChevronLeft size={18} /> Inicio
        </Link>
        <span className="flex items-center gap-1.5 rounded-lg border border-swu-amber/40 bg-swu-amber/10 px-2.5 py-1 text-[12px] font-bold text-swu-amber">
          <Coins size={13} />
          {taller.saldo.toLocaleString('es-SV')} XP
        </span>
      </div>

      <h1 className="text-center text-2xl font-black tracking-tight text-swu-text">EL TALLER</h1>
      <p className="mb-1 text-center text-[11px] text-swu-muted">
        Armá tu sable. Las piezas se pagan con XP y tu nivel no baja al gastarlo.
      </p>

      {/* ── El sable ── */}
      {sinWebGL ? (
        <div className="mt-3 flex h-[46vh] min-h-[280px] items-center justify-center rounded-2xl border border-swu-border bg-swu-surface px-6 text-center text-[12px] text-swu-muted">
          Este navegador no puede dibujar en 3D. Las piezas se pueden comprar y guardar igual.
        </div>
      ) : (
        <SableEscena
          diseno={diseno}
          encendido={encendido}
          onSinWebGL={() => setSinWebGL(true)}
          className="mt-3 h-[46vh] min-h-[280px] max-h-[520px] w-full rounded-2xl border border-swu-border bg-gradient-to-b from-[#0d1018] to-[#141a26]"
        />
      )}

      <div className="mt-2 flex items-center justify-center gap-2">
        <button
          onClick={() => setEncendido(v => !v)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-bold transition-colors ${
            encendido
              ? 'border-swu-accent bg-swu-accent/15 text-swu-accent-texto'
              : 'border-swu-border bg-swu-surface text-swu-muted'
          }`}
        >
          <Power size={14} />
          {encendido ? 'Apagar' : 'Encender'}
        </button>
        <span className="text-[10px] text-swu-muted">Arrastrá para girarlo</span>
      </div>

      {aviso && (
        <p className="mt-3 rounded-xl border border-swu-border bg-swu-surface px-3 py-2 text-center text-[12px] text-swu-text">
          {aviso}
        </p>
      )}

      {/* ── Las ranuras ── */}
      {RANURAS.map(({ tipo, rotulo }) => (
        <div key={tipo} className="mt-5">
          <h2 className="mb-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-swu-muted">{rotulo}</h2>
          <div className="grid grid-cols-2 gap-2">
            {(porTipo.get(tipo) ?? []).map(p => {
              const puesta = diseno[tipo] === p.id
              return (
                <button
                  key={p.id}
                  disabled={ocupado}
                  onClick={() => (p.tengo ? elegir(tipo, p) : void comprar(p))}
                  className={`flex min-h-[56px] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-60 ${
                    puesta
                      ? 'border-swu-accent bg-swu-accent/15'
                      : p.tengo
                        ? 'border-swu-border bg-swu-surface'
                        : 'border-swu-amber/30 bg-swu-amber/5'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-bold text-swu-text">{p.nombre}</span>
                    <span className="block text-[10px] text-swu-muted">
                      {p.tengo
                        ? (puesta ? 'Puesta' : 'La tenés')
                        // El precio se enseña SIEMPRE en la pieza que no tenés:
                        // un botón que cobra sin decir cuánto se toca una vez y
                        // no se vuelve a tocar nunca.
                        : `${p.precio.toLocaleString('es-SV')} XP`}
                    </span>
                  </span>
                  {puesta
                    ? <Check size={15} className="shrink-0 text-swu-accent-texto" />
                    : !p.tengo && <Coins size={14} className="shrink-0 text-swu-amber" />}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* ── Nombre y guardado ── */}
      <div className="mt-6">
        <h2 className="mb-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-swu-muted">Nombre</h2>
        <input
          value={nombre}
          onChange={e => setNombre(e.target.value.slice(0, 40))}
          placeholder="Sin nombre"
          className="w-full rounded-xl border border-swu-border bg-swu-bg px-3 py-2.5 text-[13px] text-swu-text outline-none focus:border-swu-accent"
        />
      </div>

      <button
        onClick={() => void guardar()}
        disabled={ocupado}
        className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-swu-accent px-4 text-[14px] font-bold text-swu-accent-fg disabled:opacity-60"
      >
        <Save size={16} />
        Guardar mi sable
      </button>
    </div>
  )
}
