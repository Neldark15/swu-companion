/**
 * TALLER KYBER — armá tu sable de luz. `/sable`
 *
 * ── Está cerrado, y la cerradura NO está acá ──────────────────────────
 *
 * La pantalla se rinde si `sable_taller()` no devuelve `ok`, pero eso es una
 * CORTINA, no una cerradura: los roles viven en localStorage y un gate de
 * cliente se salta con la consola. Lo que cierra de verdad es el
 * `if not es_probador_sable()` que está DENTRO de cada RPC — la misma lección
 * que costó una prueba en el Centro de Temporada (§3i-bis), donde un admin no
 * curador leía la temporada entera porque el guardia estaba solo en la UI.
 *
 * Y a propósito no hay entrada en ningún menú: se entra tecleando `/sable`.
 *
 * ── Se paga con CRÉDITOS, que son tu XP ───────────────────────────────
 *
 * Medido: el XP no tenía sumidero en toda la app. Solo entraba —misiones,
 * torneos, 50 por sobre abierto— y lo único que hacía era subir el nivel. Acá
 * sirve para algo. Se llama «créditos» en pantalla porque en una tienda del
 * universo la moneda no se llama «puntos de experiencia», pero es el MISMO
 * número: no hay dos economías.
 *
 * Y pagar con SOBRES estaba descartado: competiría con abrirlos, y con 333
 * sobres sin abrir eso es lo último que hace falta.
 *
 * ── Gastar NO baja de nivel ───────────────────────────────────────────
 *
 * `player_stats.level` se deriva de `xp`, así que restar de ahí degradaría al
 * que compra. El saldo es `total − gastado`, derivado en el servidor de los
 * recibos del inventario; `xp` nunca baja.
 *
 * ── Cuatro pasos, y el orden importa ──────────────────────────────────
 *
 * Piezas → Cristal → Color → Prueba. El cristal va ANTES del color porque el
 * cristal decide de qué colores se puede elegir; al revés, uno elige un color y
 * después descubre que no tiene el cristal.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Lock, Power, Save, Package, RotateCw } from 'lucide-react'
import { CreditoIcon } from '../../components/icons/CreditoIcon'
import { SableEscena } from './SableEscena'
import { PiezaTarjeta } from './PiezaTarjeta'
import { BarraStats } from './BarraStats'
import { POR_DEFECTO, type Diseno } from './partesSable'
import {
  PASOS, RANURAS_MANGO, sumarStats, deltaDe, rarezaDe, type Paso,
} from './kyber'
import {
  abrirTaller, comprarParte, guardarSable,
  type ParteTaller, type Taller,
} from '../../services/sableService'

export function SablePage() {
  const [taller, setTaller] = useState<Taller | null>(null)
  const [cargando, setCargando] = useState(true)
  const [diseno, setDiseno] = useState<Diseno>(POR_DEFECTO)
  const [nombre, setNombre] = useState('')
  const [paso, setPaso] = useState<Paso>('piezas')
  const [ranura, setRanura] = useState<ParteTaller['tipo']>('emisor')
  const [aviso, setAviso] = useState<string | null>(null)
  const [sinWebGL, setSinWebGL] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  /* Se sube para volver a consultar. Es una dependencia real del efecto, que es
     como el resto de la app hace las recargas — un `useCallback` llamado DESDE
     el efecto cuenta como escritura síncrona de estado. */
  const [recarga, setRecarga] = useState(0)
  const recargar = useCallback(() => setRecarga(n => n + 1), [])

  useEffect(() => {
    let vivo = true
    void (async () => {
      const t = await abrirTaller()
      if (!vivo) return
      setTaller(t)
      if (t?.diseno) {
        setDiseno({
          emisor: t.diseno.emisor, cuerpo: t.diseno.cuerpo,
          pomo: t.diseno.pomo, color: t.diseno.color,
        })
        setNombre(t.diseno.nombre ?? '')
      }
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [recarga])

  /* Memoizado y no `taller?.partes ?? []` a secas: ese `??` devuelve un arreglo
     NUEVO en cada render cuando `taller` es null, y con eso las dependencias de
     los `useMemo`/`useCallback` de abajo cambiarían siempre — o sea, memoización
     que no memoiza nada. */
  const partes = useMemo(() => taller?.partes ?? [], [taller])
  const puestas = useMemo(
    () => [diseno.emisor, diseno.cuerpo, diseno.pomo, diseno.color],
    [diseno],
  )
  const stats = useMemo(() => sumarStats(partes, puestas), [partes, puestas])

  /* La hoja se enciende SOLA en el paso de prueba y se apaga al volver a armar:
     encenderla mientras se cambian piezas tapa el mango, que es lo que se está
     mirando. Y el sable se abre en el paso de piezas por el mismo motivo
     invertido — abierto se ve QUÉ se está cambiando. */
  const encendido = paso === 'prueba'
  const explotado = paso === 'piezas'

  const deLaRanura = useCallback(
    (tipo: ParteTaller['tipo']) =>
      partes.filter(p => p.tipo === tipo).sort((a, b) => a.orden - b.orden),
    [partes],
  )

  const tocar = useCallback(async (p: ParteTaller) => {
    setAviso(null)
    if (p.tengo) { setDiseno(d => ({ ...d, [p.tipo]: p.id })); return }
    setOcupado(true)
    const r = await comprarParte(p.id)
    if (!r.ok) { setAviso(r.mensaje ?? 'No se pudo comprar'); setOcupado(false); return }
    // Se relee del servidor en vez de parchear: el saldo es derivado y el
    // servidor es el que sabe cuánto quedó.
    recargar()
    setDiseno(d => ({ ...d, [p.tipo]: p.id }))
    setAviso(`${p.nombre} es tuya`)
    setOcupado(false)
  }, [recargar])

  const guardar = useCallback(async () => {
    setOcupado(true); setAviso(null)
    const r = await guardarSable(diseno, nombre)
    setAviso(r.ok ? 'Sable forjado' : (r.mensaje ?? 'No se pudo guardar'))
    setOcupado(false)
  }, [diseno, nombre])

  if (cargando) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-swu-muted">
        Encendiendo la forja…
      </div>
    )
  }

  if (!taller) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Lock size={26} className="mx-auto mb-3 text-swu-muted" />
        <p className="text-[15px] font-black text-swu-text">El Taller Kyber está cerrado</p>
        <p className="mt-1 text-[12px] text-swu-muted">
          Está en pruebas y lo ve una sola cuenta.
        </p>
        <Link to="/" className="mt-5 inline-block text-[13px] text-swu-cyan">Volver a Inicio</Link>
      </div>
    )
  }

  const cristales = deLaRanura('color')
  const cristalPuesto = cristales.find(c => c.id === diseno.color)

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3 pb-28">
      {/* ── Cabecera ── */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <Link to="/" className="-ml-1 flex items-center gap-1 p-1 text-sm text-swu-muted hover:text-swu-text">
          <ChevronLeft size={18} />
        </Link>
        <div className="min-w-0 text-center">
          <h1 className="truncate text-[17px] font-black tracking-[0.14em] text-swu-text">
            TALLER KYBER
          </h1>
          <p className="text-[10px] font-bold tracking-wider text-swu-amber">
            NIVEL {taller.nivel}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-swu-amber/40 bg-swu-amber/10 px-2.5 py-1 text-[12px] font-black tabular-nums text-swu-amber">
          <CreditoIcon size={15} />
          {taller.saldo.toLocaleString('es-SV')}
        </span>
      </div>

      {/* ── Los cuatro pasos ── */}
      <div className="mb-3 flex items-center gap-1">
        {PASOS.map((p, i) => {
          const activo = p.id === paso
          return (
            <div key={p.id} className="flex min-w-0 flex-1 items-center gap-1">
              <button
                onClick={() => { setPaso(p.id); setAviso(null) }}
                className="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1"
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-black
                              ${activo
                                ? 'border-swu-amber bg-swu-amber text-swu-bg'
                                : 'border-swu-border bg-swu-surface text-swu-muted'}`}
                >{p.n}</span>
                <span className={`truncate text-[9px] font-black uppercase tracking-wider
                                  ${activo ? 'text-swu-amber' : 'text-swu-muted'}`}>
                  {p.rotulo}
                </span>
              </button>
              {i < PASOS.length - 1 && <span className="h-px w-2 shrink-0 bg-swu-border" />}
            </div>
          )
        })}
      </div>

      {/* ── La forja ── */}
      {sinWebGL ? (
        <div className="flex h-[38vh] min-h-[240px] items-center justify-center rounded-2xl border border-swu-border bg-swu-surface px-6 text-center text-[12px] text-swu-muted">
          Este navegador no puede dibujar en 3D. Las piezas se pueden comprar y
          equipar igual.
        </div>
      ) : (
        <div className="relative">
          <SableEscena
            diseno={diseno}
            encendido={encendido}
            explotado={explotado}
            onSinWebGL={() => setSinWebGL(true)}
            className="h-[38vh] min-h-[240px] max-h-[440px] w-full rounded-2xl border border-swu-border bg-gradient-to-b from-[#100c07] to-[#1d1408]"
          />
          {/* La pista del gesto. Va DENTRO del lienzo y abajo a la izquierda,
              donde no tapa el sable, y solo mientras no se está probando. */}
          {!encendido && (
            <span className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-swu-muted/80">
              <RotateCw size={11} /> Arrastrá para rotar
            </span>
          )}
        </div>
      )}

      <div className="mt-2">
        <BarraStats stats={stats} />
      </div>

      {aviso && (
        <p className="mt-2 rounded-xl border border-swu-border bg-swu-surface px-3 py-2 text-center text-[12px] text-swu-text">
          {aviso}
        </p>
      )}

      {/* ── Paso 1: las piezas del mango ── */}
      {paso === 'piezas' && (
        <div className="mt-4">
          <div className="mb-2 flex gap-1.5">
            {RANURAS_MANGO.map(({ tipo, rotulo }) => (
              <button
                key={tipo}
                onClick={() => setRanura(tipo)}
                className={`flex-1 rounded-xl border px-2 py-2 text-[11px] font-black uppercase tracking-wider
                            ${ranura === tipo
                              ? 'border-swu-amber bg-swu-amber/15 text-swu-amber'
                              : 'border-swu-border bg-swu-surface text-swu-muted'}`}
              >{rotulo}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {deLaRanura(ranura).map(p => (
              <PiezaTarjeta
                key={p.id}
                parte={p}
                puesta={diseno[ranura] === p.id}
                delta={deltaDe(partes, puestas, p)}
                ocupado={ocupado}
                alElegir={() => void tocar(p)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Paso 2: el cristal ── */}
      {paso === 'cristal' && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] text-swu-muted">
            El cristal es el corazón del sable: decide el color de la hoja y es lo
            que más pesa en los stats.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {cristales.map(c => (
              <PiezaTarjeta
                key={c.id}
                parte={c}
                puesta={diseno.color === c.id}
                delta={deltaDe(partes, puestas, c)}
                ocupado={ocupado}
                alElegir={() => void tocar(c)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Paso 3: el color ──
          Solo se ofrecen los cristales que YA son tuyos. Enseñar los demás acá
          sería ofrecer un color que no se puede poner: la compra vive en el paso
          del cristal, y mezclar las dos cosas es cómo alguien toca un color y
          recibe un cobro que no esperaba. */}
      {paso === 'color' && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] text-swu-muted">
            Estos son los cristales que ya tenés. Para más, volvé al paso 2.
          </p>
          <div className="flex flex-wrap gap-2">
            {cristales.filter(c => c.tengo).map(c => {
              const r = rarezaDe(c.rareza)
              const puesto = diseno.color === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => setDiseno(d => ({ ...d, color: c.id }))}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 ${r.borde}
                              ${puesto ? 'bg-swu-accent/15' : 'bg-swu-surface'}`}
                >
                  <span className="text-[12px] font-black text-swu-text">{c.nombre}</span>
                  {puesto && <span className="text-[10px] font-bold text-swu-accent-texto">puesto</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Paso 4: la prueba ── */}
      {paso === 'prueba' && (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-swu-border bg-swu-surface p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-swu-muted">
              <Power size={12} /> Hoja encendida
            </p>
            <p className="mt-1 text-[12px] text-swu-text">
              {cristalPuesto?.nombre ?? 'Cristal'} · Potencia {stats.potencia} ·
              Control {stats.control} · Energía {stats.energia}
            </p>
            <p className="mt-1 text-[11px] text-swu-muted">
              Arrastrá para mirarlo desde cualquier lado. Los stats describen tu
              sable — no cambian nada en las partidas ni en el ranking.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.2em] text-swu-muted">
              Nombre del sable
            </label>
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
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-swu-amber px-4 text-[14px] font-black uppercase tracking-wider text-swu-bg disabled:opacity-60"
          >
            <Save size={17} />
            Forjar mi sable
          </button>
        </div>
      )}

      {/* Cuántas piezas llevás. Va abajo y chico: es progreso, no una tarea. */}
      <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-swu-muted">
        <Package size={12} />
        {taller.cuantasTengo} de {taller.cuantasHay} piezas conseguidas
      </p>
    </div>
  )
}
