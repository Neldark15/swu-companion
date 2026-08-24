/**
 * TALLER KYBER — armá tu sable de luz. `/sable`
 *
 * ── Abierto a la comunidad (2026-08-24) ───────────────────────────────
 *
 * Nació cerrado a una cuenta para probarlo. Nel: «que sea accesible para la
 * comunidad el poder editar el sable». La puerta ahora es tener sesión, y el
 * guardia sigue DENTRO de cada RPC (`sable_abierto()`), no acá — un gate de
 * cliente se salta con la consola, y esa lección ya costó una prueba en el
 * Centro de Temporada (§3i-bis).
 *
 * Lo que sigue cerrado son las piezas con `oculta`: los cinco legendarios,
 * guardados para su estreno, y el cristal rojo, que se gana sangrando. Abrir
 * el taller no fue estrenar el catálogo.
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

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, Lock, Power, Save, Package, RotateCw, Volume2, VolumeX,
} from 'lucide-react'
import { CreditoIcon } from '../../components/icons/CreditoIcon'
import { SableEscena, type Orientacion, type Vista } from './SableEscena'
import { PiezaTarjeta } from './PiezaTarjeta'
import { BarraStats } from './BarraStats'
import { ConsejoHuyang } from './ConsejoHuyang'
import { POR_DEFECTO, colorDeHoja, materialDe, type Diseno } from './partesSable'
import {
  arrancarZumbido, pararZumbido, afinarZumbido, sonarEncendido, sonarApagado,
  sonarPieza, alternarSilencioSable, sableEnSilencio,
} from './sonidoSable'
import {
  PASOS, RANURAS_MANGO, sumarStats, deltaDe, rarezaDe, pesoDeRareza, type Paso,
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
  const [silencio, setSilencio] = useState(sableEnSilencio)
  const [orientacion, setOrientacion] = useState<Orientacion>('diagonal')

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
          acabado: t.diseno.acabado,
          acabadoEmisor: t.diseno.acabadoEmisor, acabadoCuerpo: t.diseno.acabadoCuerpo,
          acabadoPomo: t.diseno.acabadoPomo, cristalVisto: t.diseno.cristalVisto,
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
  /* El ACABADO y el CRISTAL A LA VISTA quedan fuera a propósito: son color,
     no pieza, no cuestan créditos y no tocan los stats. Meterlos acá haría que
     cambiar de color recalculara todo y, peor, invitaría a que algún día
     sumaran potencia. */
  const puestas = useMemo(
    () => [diseno.emisor, diseno.cuerpo, diseno.pomo, diseno.color],
    [diseno.emisor, diseno.cuerpo, diseno.pomo, diseno.color],
  )
  const stats = useMemo(() => sumarStats(partes, puestas), [partes, puestas])

  /* La hoja se enciende SOLA en el paso de prueba y se apaga al volver a armar:
     encenderla mientras se cambian piezas tapa el mango, que es lo que se está
     mirando. Y el sable se abre en el paso de piezas por el mismo motivo
     invertido — abierto se ve QUÉ se está cambiando. */
  const encendido = paso === 'prueba'
  const explotado = paso === 'piezas'
  /* En el paso del cristal, la escena enseña EL CRISTAL: es lo que se está
     eligiendo, y hasta ahora era la única pieza que no se veía nunca. */
  const vista: Vista = paso === 'cristal' ? 'cristal' : 'sable'

  /* El tono del zumbido sale del CRISTAL: cada uno suena distinto, y eso es la
     mitad de por qué vale la pena cambiarlo. Se deriva del orden de la pieza para
     que sea estable y no un número inventado en la línea que lo usa. */
  const tonoCristal = useMemo(() => {
    const c = partes.find(p => p.id === diseno.color)
    return c ? 0.86 + (c.orden - 1) * 0.075 : 1
  }, [partes, diseno.color])

  /** Si ya sonó una vez: sin esto suena el apagado al ENTRAR a la pantalla. */
  const hubo = useRef(false)

  /* EL ZUMBIDO SE APAGA SIEMPRE AL SALIR. Un sable que sigue sonando después de
     cerrar la pantalla es el peor error posible acá: no hay botón que lo calle y
     la persona no sabe de dónde sale el ruido. Por eso el `return` de este efecto
     no tiene condición. */
  useEffect(() => {
    if (encendido && !silencio) {
      /* Si ya venía encendido y lo único que cambió es el cristal, se AFINA en
         vez de re-arrancar: cortar y volver a encender por cambiar de color se
         oye como un fallo. `arrancarZumbido` es idempotente, así que la primera
         vez arranca y las siguientes solo afinan. */
      if (hubo.current) afinarZumbido(tonoCristal)
      else sonarEncendido()
      arrancarZumbido(tonoCristal)
    }
    else { pararZumbido(); if (!silencio && hubo.current) sonarApagado() }
    hubo.current = encendido
    return () => { pararZumbido() }
  }, [encendido, silencio, tonoCristal])

  /* La tira va de COMÚN a LEGENDARIO, y dentro de cada rareza del más barato
     al más caro (pedido de Nel). Se ordena ACÁ y no con la columna `orden` de
     la base: `orden` se asigna al dar de alta cada tanda y las tandas nuevas
     quedaban al final aunque fueran épicas — un derivado no puede quedar viejo
     (§3c), y el orden correcto ES un derivado de rareza y precio. */
  const deLaRanura = useCallback(
    (tipo: ParteTaller['tipo']) =>
      partes.filter(p => p.tipo === tipo).sort((a, b) =>
        pesoDeRareza(a.rareza) - pesoDeRareza(b.rareza)
        || a.precio - b.precio
        || a.orden - b.orden),
    [partes],
  )

  const tocar = useCallback(async (p: ParteTaller) => {
    setAviso(null)
    if (p.tengo) {
      setDiseno(d => ({ ...d, [p.tipo]: p.id }))
      if (!silencio) sonarPieza()
      return
    }
    setOcupado(true)
    const r = await comprarParte(p.id)
    if (!r.ok) { setAviso(r.mensaje ?? 'No se pudo comprar'); setOcupado(false); return }
    // Se relee del servidor en vez de parchear: el saldo es derivado y el
    // servidor es el que sabe cuánto quedó.
    recargar()
    setDiseno(d => ({ ...d, [p.tipo]: p.id }))
    setAviso(`${p.nombre} es tuya`)
    setOcupado(false)
  }, [recargar, silencio])

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
        <p className="text-[15px] font-black text-swu-text">Entrá con tu cuenta</p>
        {/* El taller está abierto a toda la comunidad: si no carga, o no hay
            sesión o no hubo red. Decir «está cerrado» mandaba a la gente a
            esperar una apertura que ya ocurrió. */}
        <p className="mt-1 text-[12px] text-swu-muted">
          El Taller Kyber usa tus créditos y guarda tu sable, así que necesita
          saber quién sos. Si ya entraste, revisá tu conexión.
        </p>
        <Link to="/" className="mt-5 inline-block text-[13px] text-swu-cyan">Volver a Inicio</Link>
      </div>
    )
  }

  const cristales = deLaRanura('color')
  const cristalPuesto = cristales.find(c => c.id === diseno.color)

  /* En los pasos de COMPRA el visor cede altura: la tira de piezas tiene que
     caber en la misma pantalla que el sable — ese era exactamente el reclamo
     de Nel («escrolear hacia abajo y perder la visual»). En color y prueba,
     donde abajo casi no hay nada, el visor recupera su tamaño grande. */
  const tonoHoja = colorDeHoja(diseno.color).halo
  const comprando = paso === 'piezas' || paso === 'cristal'
  const altoVisor = comprando
    ? 'h-[40vh] min-h-[300px] max-h-[520px]'
    : 'h-[56vh] min-h-[380px] max-h-[680px]'

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
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSilencio(alternarSilencioSable())}
            className="rounded-lg p-1.5 text-swu-muted hover:text-swu-text"
            aria-label={silencio ? 'Activar sonido' : 'Silenciar'}
            aria-pressed={silencio}
          >
            {silencio ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <span className="flex items-center gap-1.5 rounded-lg border border-swu-amber/40 bg-swu-amber/10 px-2.5 py-1 text-[12px] font-black tabular-nums text-swu-amber">
            <CreditoIcon size={15} />
            {taller.saldo.toLocaleString('es-SV')}
          </span>
        </div>
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
        <div className={`flex ${altoVisor} items-center justify-center rounded-2xl border border-swu-border bg-swu-surface px-6 text-center text-[12px] text-swu-muted`}>
          Este navegador no puede dibujar en 3D. Las piezas se pueden comprar y
          equipar igual.
        </div>
      ) : (
        <div className="relative">
          <SableEscena
            diseno={diseno}
            encendido={encendido}
            explotado={explotado}
            orientacion={orientacion}
            vista={vista}
            onSinWebGL={() => setSinWebGL(true)}
            className={`${altoVisor} w-full rounded-2xl border border-swu-border bg-gradient-to-b from-[#0a0a14] to-[#151322]`}
          />
          {/* La pista del gesto. Va DENTRO del lienzo y abajo a la izquierda,
              donde no tapa el sable, y solo mientras no se está probando. */}
          {!encendido && (
            <span className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-swu-muted/80">
              <RotateCw size={11} /> Arrastralo en cualquier dirección
            </span>
          )}
        </div>
      )}

      {/* Las tres poses. El arrastre libre puede salirse de ellas cuando
          quiera: esto es un atajo, no un modo. */}
      {!sinWebGL && vista === 'sable' && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {([
            ['vertical', 'Vertical'],
            ['diagonal', 'Diagonal'],
            ['horizontal', 'Horizontal'],
          ] as const).map(([id, rotulo]) => (
            <button
              key={id}
              onClick={() => setOrientacion(id)}
              className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider
                          ${orientacion === id
                            ? 'border-swu-amber bg-swu-amber/15 text-swu-amber'
                            : 'border-swu-border bg-swu-surface text-swu-muted'}`}
            >{rotulo}</button>
          ))}
        </div>
      )}

      {/* ── Paso 1: las piezas del mango ──
          La tira es HORIZONTAL y se desliza: Nel probándolo — «las piezas me
          gustaría verlas en horizontal, deslizar de izquierda a derecha para no
          escrolear hacia abajo y perder la visual del sable». La tarjeta tiene
          ancho fijo para que asomen dos y media, que es lo que dice «esto
          sigue». El `-mx-4 px-4` deja que la tira sangre hasta el borde. */}
      {paso === 'piezas' && (
        <div className="mt-3">
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
          {/* ── EL COLOR, de la pieza que estás mirando ──
              Nel: «que empuñaduras puedan combinar colores, que los otros
              elementos también se puedan personalizar». La tira aplica a la
              RANURA ACTIVA — emisor, cuerpo o pomo, cada uno con su color — y
              por eso vive debajo de las pestañas: elegís la pieza, elegís su
              color. «ORIGINAL» devuelve esa pieza a su material de catálogo.

              El acabado GLOBAL viejo no se muestra pero tampoco se pierde: es
              lo que las PWA sin actualizar siguen guardando, y la cadena
              por-pieza → global → propio lo respeta (partesSable). Gratis,
              como todo color: el sumidero de créditos son las piezas. */}
          <div className="mb-2 flex items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-swu-muted">
              Color de {ranura === 'emisor' ? 'este emisor' : ranura === 'cuerpo' ? 'esta empuñadura' : 'este pomo'}
            </p>
          </div>
          <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
            {[{ id: null, nombre: 'ORIGINAL' }, ...(taller.acabados ?? [])].map(a => {
              const campo = ranura === 'emisor' ? 'acabadoEmisor'
                : ranura === 'cuerpo' ? 'acabadoCuerpo' : 'acabadoPomo'
              const puesto = (diseno[campo] ?? null) === a.id
              const m = a.id ? materialDe(a.id) : null
              return (
                <button
                  key={a.id ?? 'original'}
                  onClick={() => setDiseno(d => ({ ...d, [campo]: a.id }))}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5
                              text-[10px] font-black uppercase tracking-wider
                              ${puesto
                                ? 'border-swu-amber bg-swu-amber/15 text-swu-amber'
                                : 'border-swu-border bg-swu-surface text-swu-muted'}`}
                  aria-pressed={puesto}
                >
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border"
                    style={m
                      ? { background: m.plano, borderColor: m.borde }
                      : {
                          // «Original» no tiene un color: es volver al del
                          // catálogo. La muestra partida es eso.
                          background: 'linear-gradient(135deg,#aeb6c0 0 33%,#54382a 33% 66%,#c08c42 66%)',
                          borderColor: '#6b7280',
                        }}
                  />
                  {a.nombre}
                </button>
              )
            })}
          </div>
          {/* La tira va de común a legendario, y cada vez que cambia la
              rareza se planta un rótulo vertical. Sin él, treinta tarjetas
              ordenadas se leen como una lista larga y no como una escalera:
              el separador es lo que hace VER que la cosa sube. */}
          <div className="-mx-4 flex snap-x items-stretch gap-2 overflow-x-auto px-4 pb-1">
            {deLaRanura(ranura).map((p, i, lista) => {
              const abre = i === 0 || lista[i - 1].rareza !== p.rareza
              const r = rarezaDe(p.rareza)
              return (
                <Fragment key={p.id}>
                  {abre && (
                    <div className="flex shrink-0 items-center pl-1 pr-0.5">
                      <span
                        className={`text-[9px] font-black uppercase tracking-[0.25em] ${r.texto}`}
                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                      >{r.rotulo}</span>
                    </div>
                  )}
                  <div className="flex w-44 shrink-0 snap-start">
                    <PiezaTarjeta
                      parte={p}
                      colorHoja={tonoHoja}
                      puesta={diseno[ranura] === p.id}
                      delta={deltaDe(partes, puestas, p)}
                      ocupado={ocupado}
                      alElegir={() => void tocar(p)}
                    />
                  </div>
                </Fragment>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Paso 2: el cristal ── */}
      {paso === 'cristal' && (
        <div className="mt-3">
          <p className="mb-2 text-[11px] text-swu-muted">
            El cristal es el corazón del sable: decide el color de la hoja y es lo
            que más pesa en los stats.
          </p>
          {/* «Que el cristal pueda estar visto en medio de la empuñadura»
              (Nel). Dos ventanas al kyber en el centro del cuerpo, latiendo
              del color de tu hoja. Cosmético y gratis, como todo color. */}
          <button
            type="button"
            onClick={() => setDiseno(d => ({ ...d, cristalVisto: !d.cristalVisto }))}
            aria-pressed={!!diseno.cristalVisto}
            className={`mb-3 flex min-h-[48px] w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left
                        ${diseno.cristalVisto
                          ? 'border-swu-amber bg-swu-amber/10'
                          : 'border-swu-border bg-swu-surface'}`}
          >
            <span
              className="h-4 w-4 shrink-0 rotate-45 rounded-[3px] border"
              style={{
                background: diseno.cristalVisto ? tonoHoja : 'transparent',
                borderColor: tonoHoja,
                boxShadow: diseno.cristalVisto ? `0 0 8px ${tonoHoja}` : 'none',
              }}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-black uppercase tracking-wider text-swu-text">
                Cristal a la vista
              </span>
              <span className="block text-[11px] text-swu-muted">
                Dos ventanas al kyber en el centro de la empuñadura, latiendo con tu color.
              </span>
            </span>
            <span className={`text-[10px] font-black uppercase ${diseno.cristalVisto ? 'text-swu-amber' : 'text-swu-muted'}`}>
              {diseno.cristalVisto ? 'Puesto' : 'Apagado'}
            </span>
          </button>
          <div className="-mx-4 flex snap-x items-stretch gap-2 overflow-x-auto px-4 pb-1">
            {cristales.map(c => (
              <div key={c.id} className="flex w-44 shrink-0 snap-start">
                <PiezaTarjeta
                  parte={c}
                  puesta={diseno.color === c.id}
                  delta={deltaDe(partes, puestas, c)}
                  ocupado={ocupado}
                  alElegir={() => void tocar(c)}
                />
              </div>
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

      {aviso && (
        <p className="mt-2 rounded-xl border border-swu-border bg-swu-surface px-3 py-2 text-center text-[12px] text-swu-text">
          {aviso}
        </p>
      )}

      {/* Los stats y el consejo van DEBAJO de la tira de piezas, no encima:
          arriba empujaban las tarjetas fuera de la pantalla y obligaban al
          scroll que Nel pidió eliminar. La tira tiene que tocar el sable. */}
      <div className="mt-3">
        <BarraStats stats={stats} />
      </div>

      {/* El consejo del Arquitecto. `key={paso}` remonta el componente al
          cambiar de paso: así el consejo rota SIN setState en un efecto. */}
      <div className="mt-2">
        <ConsejoHuyang key={paso} paso={paso} />
      </div>

      {/* ── De dónde salen los créditos ──
          La lista dice LO QUE DE VERDAD SE PAGA (§3m): estos montos son los de
          sumar_xp / abrir_sobre / _repartir_premios / la trivia. Si se toca un
          monto en el servidor, se toca esta lista en el mismo commit. */}
      <div className="mt-8">
        <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-swu-muted">
          <CreditoIcon size={13} />
          Cómo se ganan créditos
        </h2>
        <div className="divide-y divide-swu-border rounded-2xl border border-swu-border bg-swu-surface">
          {[
            ['Abrir un sobre en Sobredosis', '50'],
            ['Cada acierto de la Trivia', '2'],
            ['Jugar un torneo', '500'],
            ['Misiones del día', 'según la misión'],
          ].map(([que, cuanto]) => (
            <div key={que} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[13px] text-swu-text">{que}</span>
              <span className="flex items-center gap-1 text-[12px] font-black text-swu-amber">
                {cuanto !== 'según la misión' && <CreditoIcon size={13} />}
                {cuanto}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-1.5 px-1 text-[11px] leading-snug text-swu-muted">
          Los créditos son tu experiencia: todo lo que da XP, da créditos. Y
          gastarlos acá nunca te baja de nivel.
        </p>
      </div>

      {/* Cuántas piezas llevás. Va abajo y chico: es progreso, no una tarea. */}
      <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-swu-muted">
        <Package size={12} />
        {taller.cuantasTengo} de {taller.cuantasHay} piezas conseguidas
      </p>
    </div>
  )
}
