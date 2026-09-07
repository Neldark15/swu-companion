/**
 * LA TIENDA — lo que sobra se vuelve créditos, y los créditos vuelven sobres.
 *
 * Dos mitades de la misma idea, en este orden a propósito: primero lo que YA
 * tenés y no sabías que valía, después en qué gastarlo. Al revés, la tienda
 * pide plata antes de decirte que la tenés.
 *
 * ── Lo que se anuncia es lo que se paga (§4a) ────────────────────────
 *
 * Ni la tarifa de cada repetida ni el total salen de una cuenta hecha acá:
 * llegan calculados por `tienda_sobres()`, con la MISMA expresión que después
 * cobra `canjear_repetidas()`. Si esta pantalla los sumara por su cuenta,
 * bastaría con que alguien editara `sobres_tarifas` para que anunciara un
 * precio y pagara otro — que es exactamente cómo `FUENTES` terminó mintiendo
 * sobre los premios de torneo.
 *
 * ── El canje se CONFIRMA, y dice qué NO toca ─────────────────────────
 *
 * Saca copias del álbum y no se deshace. Pero la primera copia de cada carta se
 * queda SIEMPRE —lo garantiza el servidor con `cantidad - 1` como techo— y eso
 * hay que decirlo antes del botón, no después: sin esa frase, «cambiá lo que te
 * sobra» se lee como que se va tu Showcase.
 *
 * ── Y no se vende una ilusión ────────────────────────────────────────
 *
 * Medido sobre la comunidad: 15 personas tienen repetidas, 211 copias en total,
 * y lo que valen de promedio son 144 créditos — menos de UN sobre, que cuesta
 * 250. Por eso debajo del total va lo que de verdad alcanza, con el número que
 * falta cuando no alcanza. Un «¡canjeá y seguí abriendo!» encima de 144
 * créditos es una promesa que la pantalla siguiente desmiente.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Store, Package, Recycle, Minus, Plus, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { CardImage } from '../../components/CardImage'
import { CreditoIcon } from '../../components/icons/CreditoIcon'
import { esApaisada, RAREZA, NOMBRE_RAREZA, type Variante } from '../../services/sobres'
import {
  verTienda, canjearRepetidas, comprarSobres,
  type EstadoTienda, type RepetidaFila,
  type ResultadoCanje, type ResultadoCompra,
} from '../../services/tiendaSobres'

/** Cuántas repetidas se enseñan en el detalle antes de cortar. */
const DETALLE_TOPE = 24

const num = (n: number) => n.toLocaleString('es-SV')

/**
 * El nombre de una impresión, con el MISMO vocabulario que el álbum.
 *
 * El servidor manda la variante cruda (`Serialized Prestige`) porque es la
 * clave con la que busca la tarifa; la app la enseña en castellano en todas
 * las demás pantallas. Sin este paso, la tienda decía «Serialized Prestige» al
 * lado de un álbum que dice «Serializada» — la misma carta con dos nombres, y
 * eso se lee como dos cosas distintas (§4q).
 *
 * `'?'` es la carta cuya fila del pool ya no existe: una impresión retirada. Se
 * dice así, no se le inventa un nombre.
 */
function nombreDeVariante(v: string): string {
  if (v === '?') return 'impresión retirada'
  const r = RAREZA[v as Variante]
  return r ? NOMBRE_RAREZA[r] : v
}

/** Una repetida en el detalle: la lámina, cuántas sobran y cuánto pagan. */
function FilaRepetida({ f }: { f: RepetidaFila }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <div className="h-11 w-8 shrink-0 overflow-hidden rounded-[3px] bg-swu-bg">
        <CardImage
          src={f.arte || f.carta?.imageUrl}
          alt=""
          orientacion={esApaisada(f.carta) ? 'apaisada' : 'vertical'}
          className="h-full w-full"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-swu-text">
          {f.carta?.name ?? 'Carta desconocida'}
        </p>
        <p className="truncate text-[11px] text-swu-muted">
          {nombreDeVariante(f.variante)}
          {' · '}
          <span className="tabular-nums">×{f.repetidas}</span>
          {' de más'}
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-[12px] font-black tabular-nums text-swu-amber">
        <CreditoIcon size={12} />
        {num(f.creditos)}
      </span>
    </div>
  )
}

/**
 * Las tres cosas que la tienda le pide al servidor.
 *
 * Van INYECTADAS y no importadas dentro del panel para que el banco pueda
 * mirarlo sin sesión: esta pantalla vive detrás de una cuenta Y de tener
 * repetidas, o sea que sin este costurón la única forma de revisarla sería
 * abrir sobres hasta que una carta se repita. Es el mismo seam con el que
 * `/banco-lobby-liga` mira el botón de actualizar (§5f).
 */
export interface AccionesTienda {
  recargar: () => Promise<EstadoTienda | null>
  canjear: () => Promise<ResultadoCanje>
  comprar: (cantidad: number) => Promise<ResultadoCompra>
}

const ACCIONES_REALES: AccionesTienda = {
  recargar: verTienda,
  canjear: canjearRepetidas,
  comprar: comprarSobres,
}

export function TiendaSobres(
  { alCambiarSobres, acciones = ACCIONES_REALES }:
  { alCambiarSobres?: (n: number) => void; acciones?: AccionesTienda },
) {
  const [estado, setEstado] = useState<EstadoTienda | null>(null)
  const [cargando, setCargando] = useState(true)

  const [confirmando, setConfirmando] = useState(false)
  const [canjeando, setCanjeando] = useState(false)
  const [detalle, setDetalle] = useState(false)

  const [cantidad, setCantidad] = useState(1)
  const [comprando, setComprando] = useState(false)

  const [aviso, setAviso] = useState<{ tono: 'bien' | 'mal'; texto: string } | null>(null)

  const cargar = useCallback(async () => {
    const t = await acciones.recargar()
    setEstado(t)
    setCargando(false)
    return t
  }, [acciones])

  useEffect(() => {
    let vivo = true
    void (async () => {
      const t = await acciones.recargar()
      if (!vivo) return
      setEstado(t)
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [acciones])

  const canjear = useCallback(async () => {
    setCanjeando(true)
    setAviso(null)
    const r = await acciones.canjear()
    setCanjeando(false)
    setConfirmando(false)
    if (!r.ok) {
      setAviso({ tono: 'mal', texto: r.mensaje ?? 'No se pudo canjear' })
      return
    }
    setAviso({
      tono: 'bien',
      texto: `${num(r.cartas ?? 0)} ${r.cartas === 1 ? 'copia cambiada' : 'copias cambiadas'} por ${num(r.creditos ?? 0)} créditos.`,
    })
    setDetalle(false)
    await cargar()
  }, [cargar, acciones])

  const comprar = useCallback(async () => {
    setComprando(true)
    setAviso(null)
    const r = await acciones.comprar(cantidad)
    setComprando(false)
    if (!r.ok) {
      setAviso({ tono: 'mal', texto: r.mensaje ?? 'No se pudo comprar' })
      /* Igual se recarga: el rechazo casi siempre es «ya no te alcanza» o «ya
         llegaste al tope», y los dos son estados del servidor que la pantalla
         tiene desactualizados. Dejarla como está la haría insistir. */
      await cargar()
      return
    }
    setAviso({
      tono: 'bien',
      texto: `${r.sobres === 1 ? 'Un sobre' : `${r.sobres} sobres`} a la bóveda. Te quedan ${num(r.saldo ?? 0)} créditos.`,
    })
    if (r.disponibles != null) alCambiarSobres?.(r.disponibles)
    setCantidad(1)
    await cargar()
  }, [cantidad, cargar, alCambiarSobres, acciones])

  if (cargando) {
    return (
      <div className="mt-8">
        <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-swu-muted">
          <Store size={13} />
          Tienda
        </h2>
        <p className="clip-hud bg-swu-surface/60 px-4 py-6 text-center text-sm text-swu-muted">
          Abriendo la tienda…
        </p>
      </div>
    )
  }

  /* Sin estado no se dibuja NADA. Una tienda que no sabe el precio no puede
     decir nada cierto, y un bloque con guiones se lee como que está rota. */
  if (!estado) return null

  const { saldo, precio, tope, hoy, tarifas, repetidas, repetidasCartas, repetidasCreditos } = estado

  const quedanHoy = tope != null ? Math.max(0, tope - hoy) : 20
  const alcanzan = precio > 0 ? Math.floor(saldo / precio) : 0
  const maximo = Math.max(0, Math.min(20, quedanHoy, alcanzan))
  const costo = precio * cantidad

  /* La tarifa que se enseña sale del servidor, ordenada de más a menos. El
     comodín no se lista: nombra «todo lo demás», y en el pool de hoy no
     sobra ninguna variante — listarlo sugeriría una sexta impresión. */
  const escala = Object.entries(tarifas)
    .filter(([v]) => v !== '*' && v !== '?')
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="mt-8">
      <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-swu-muted">
        <Store size={13} />
        Tienda
      </h2>

      {/* ── Los créditos, y de dónde salen ──────────────────────────── */}
      <div className="clip-hud bg-swu-surface px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-swu-muted">
              Tus créditos
            </p>
            {/* Que los créditos SEAN el XP no es un detalle interno: es lo que
                explica por qué alguien que nunca compró nada ya tiene saldo. */}
            <p className="mt-0.5 text-[11px] leading-snug text-swu-muted">
              Son tu XP. También compran{' '}
              <Link to="/sable" className="text-swu-cyan underline-offset-2 hover:underline">
                piezas del sable
              </Link>{' '}
              y{' '}
              <Link to="/terraformar" className="text-swu-cyan underline-offset-2 hover:underline">
                tu planeta
              </Link>
              .
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 text-2xl font-black tabular-nums text-swu-amber">
            <CreditoIcon size={20} />
            {num(saldo)}
          </span>
        </div>
      </div>

      {aviso && (
        <p
          role="status"
          className={`mt-2 clip-hud px-4 py-2.5 text-[13px] font-bold ${
            aviso.tono === 'bien'
              ? 'bg-swu-green/10 text-swu-green'
              : 'bg-swu-red/10 text-swu-red-texto'
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {/* ── Lo que te sobra ─────────────────────────────────────────── */}
      {repetidasCartas > 0 && (
        <div className="mt-3">
          <h3 className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-black uppercase tracking-[0.15em] text-swu-muted">
            <Recycle size={12} />
            Lo que te sobra
          </h3>

          <div className="clip-hud bg-swu-surface">
            <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5">
              <p className="text-sm text-swu-text">
                <span className="font-black tabular-nums">{num(repetidasCartas)}</span>{' '}
                {repetidasCartas === 1 ? 'copia repetida' : 'copias repetidas'}
              </p>
              <span className="flex items-center gap-1 text-lg font-black tabular-nums text-swu-amber">
                <CreditoIcon size={15} />
                {num(repetidasCreditos)}
              </span>
            </div>

            {/* Lo que de verdad alcanza. Con 144 créditos y sobres de 250, un
                «canjeá y seguí abriendo» sería una promesa que la mitad de
                abajo desmiente en el acto. */}
            <p className="px-4 pt-1 text-[11px] leading-snug text-swu-muted">
              {precio > 0 && repetidasCreditos >= precio
                ? `Alcanza para ${Math.floor(repetidasCreditos / precio)} ${
                    Math.floor(repetidasCreditos / precio) === 1 ? 'sobre' : 'sobres'
                  }.`
                : precio > 0
                  ? `Te faltan ${num(precio - repetidasCreditos)} para un sobre, pero sirven igual en el taller del sable.`
                  : ''}
            </p>

            <p className="mt-2 flex items-start gap-1.5 px-4 text-[11px] leading-snug text-swu-muted">
              <Info size={13} className="mt-px shrink-0" aria-hidden />
              {/* UN solo hijo de texto. Con el `<strong>` suelto como hermano
                  del ícono, el flex lo trataba como una columna aparte y las
                  dos palabras en negrita se apilaban partiendo la frase. */}
              <span>
                La <strong className="font-bold text-swu-text">primera copia</strong> de cada
                carta se queda en tu álbum. Solo se cambia lo que tenés de más.
              </span>
            </p>

            <div className="px-4 pb-3.5 pt-3">
              {confirmando ? (
                <div className="rounded-xl border border-swu-amber/40 bg-swu-amber/5 p-3">
                  <p className="text-[13px] leading-snug text-swu-text">
                    Se sacan <span className="font-black tabular-nums">{num(repetidasCartas)}</span>{' '}
                    copias de tu álbum y entran{' '}
                    <span className="font-black tabular-nums text-swu-amber">
                      {num(repetidasCreditos)}
                    </span>{' '}
                    créditos. No se puede deshacer.
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      loading={canjeando}
                      onClick={() => void canjear()}
                    >
                      Sí, cambiarlas
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmando(false)}>
                      Mejor no
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="secondary" block onClick={() => setConfirmando(true)}>
                  <Recycle size={15} />
                  Cambiar por {num(repetidasCreditos)} créditos
                </Button>
              )}
            </div>

            {/* El detalle: qué cartas son y cuánto paga cada una. Plegado,
                porque la decisión se toma con el total — pero disponible,
                porque «confiá en el número» no es una respuesta. */}
            <button
              type="button"
              onClick={() => setDetalle(d => !d)}
              className="flex min-h-11 w-full items-center justify-center gap-1.5 border-t border-swu-border
                         text-[12px] font-bold text-swu-muted hover:text-swu-text"
              aria-expanded={detalle}
            >
              {detalle ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {detalle ? 'Ocultar el detalle' : `Ver las ${num(repetidas.length)} cartas`}
            </button>

            {detalle && (
              <div className="divide-y divide-swu-border border-t border-swu-border">
                {repetidas.slice(0, DETALLE_TOPE).map(f => (
                  <FilaRepetida key={f.cardId} f={f} />
                ))}
                {repetidas.length > DETALLE_TOPE && (
                  <p className="px-4 py-2.5 text-center text-[11px] text-swu-muted">
                    y {num(repetidas.length - DETALLE_TOPE)} cartas más
                  </p>
                )}
              </div>
            )}
          </div>

          {escala.length > 0 && (
            <p className="mt-1.5 px-1 text-[11px] leading-snug text-swu-muted">
              Cuánto paga cada impresión:{' '}
              {escala.map(([v, c], i) => (
                <span key={v}>
                  {i > 0 && ' · '}
                  {nombreDeVariante(v)}{' '}
                  <span className="font-bold text-swu-amber tabular-nums">{c}</span>
                </span>
              ))}
            </p>
          )}
        </div>
      )}

      {/* ── Comprar sobres ──────────────────────────────────────────── */}
      <div className="mt-3">
        <h3 className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-black uppercase tracking-[0.15em] text-swu-muted">
          {/* El mismo ícono arriba y acá hace que los dos niveles se lean
              como uno solo. */}
          <Package size={12} />
          Comprar sobres
        </h3>

        <div className="clip-hud bg-swu-surface px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-swu-text">
              Un sobre ={' '}
              <span className="font-black tabular-nums text-swu-amber">{num(precio)}</span> créditos
            </p>
            {tope != null && (
              <span className="shrink-0 text-[11px] font-bold tabular-nums text-swu-muted">
                hoy {hoy}/{tope}
              </span>
            )}
          </div>

          {maximo > 0 ? (
            <>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-xl border border-swu-border bg-swu-bg p-1">
                  <button
                    type="button"
                    onClick={() => setCantidad(c => Math.max(1, c - 1))}
                    disabled={cantidad <= 1}
                    aria-label="Uno menos"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-swu-text
                               disabled:opacity-30 hover:bg-swu-surface"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-8 text-center text-lg font-black tabular-nums text-swu-text">
                    {cantidad}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCantidad(c => Math.min(maximo, c + 1))}
                    disabled={cantidad >= maximo}
                    aria-label="Uno más"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-swu-text
                               disabled:opacity-30 hover:bg-swu-surface"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <Button
                  variant="primary"
                  className="flex-1"
                  loading={comprando}
                  onClick={() => void comprar()}
                >
                  Comprar por {num(costo)}
                </Button>
              </div>
              {/* Por qué el «+» se apaga donde se apaga. Un tope sin motivo se
                  lee como que la app está rota — y son DOS motivos distintos,
                  así que se dice cuál manda. «Hasta 5 más» con cero comprados
                  además hacía creer que ya se habían llevado unos. */}
              <p className="mt-2 text-[11px] leading-snug text-swu-muted">
                {maximo === quedanHoy && tope != null
                  ? hoy > 0
                    ? `Te ${maximo === 1 ? 'queda' : 'quedan'} ${maximo} para el tope de hoy. Se repone mañana.`
                    : `Podés llevar hasta ${maximo} ${maximo === 1 ? 'sobre' : 'sobres'} por día.`
                  : `Con lo que tenés ${alcanzan === 1 ? 'alcanza para 1 sobre' : `alcanzan ${alcanzan} sobres`}.`}
              </p>
            </>
          ) : (
            <p className="mt-2.5 text-[13px] leading-snug text-swu-muted">
              {quedanHoy === 0
                ? `Ya llevaste los ${tope} sobres de hoy. Se repone a la medianoche de El Salvador.`
                : `Te faltan ${num(precio - saldo)} créditos para un sobre.${
                    repetidasCartas === 0
                      ? ' Se ganan jugando, y cuando te salga una carta repetida vas a poder cambiarla acá.'
                      : ''
                  }`}
            </p>
          )}
        </div>

        {/* El tope diario se DICE, y se dice por qué. */}
        {tope != null && (
          <p className="mt-1.5 px-1 text-[11px] leading-snug text-swu-muted">
            Hay un tope de {tope} sobres por día. Los sobres no se compran con dinero:
            la única moneda es el XP que ganás jugando.
          </p>
        )}
      </div>
    </div>
  )
}
