/**
 * TERRAFORMAR — ponerle vida a tu mundo. `/terraformar`
 *
 * ── Por qué el planeta y no otra cosa ─────────────────────────────────
 *
 * Medido antes de construirlo: 19 de 39 cuentas ya habían tocado su planeta,
 * o sea casi la mitad de la comunidad. Es la personalización MÁS usada de la
 * app. Ampliar lo que la gente ya usa vale más que estrenar un módulo nuevo y
 * esperar que prenda — que es justo lo que le pasó a la Trivia y a los sobres
 * antes de que se les abriera la puerta (§3l).
 *
 * ── La línea entre lo gratis y lo pago no es el precio: es el relato ──
 *
 * GEOLOGÍA (gratis, en Mi Perfil): familia, mares, cráteres, anillos, lunas.
 *   Es lo que tu mundo ES. Salió de la semilla de tu id y siempre fue tuyo.
 * TERRAFORMACIÓN (se paga, acá): ciudades, nubes, auroras. Es lo que le HACÉS.
 *
 * Nada que ya era gratis pasó a costar. Eso sería quitarle a alguien lo suyo, y
 * es la misma regla que dejó visibles las piezas legendarias que ya se habían
 * comprado el día que se ocultaron las demás.
 *
 * ── Comprar y poner son dos cosas ─────────────────────────────────────
 *
 * Se compra una vez y después se prende y se apaga gratis, igual que las piezas
 * del sable. Y el guardia de verdad no está en esta pantalla: es un trigger que
 * BAJA `planet_cities` al grado que de verdad se posee. Un gate de cliente se
 * salta con la consola (§3i-bis).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Lock, Check, Sparkles } from 'lucide-react'
import { CreditoIcon } from '../../components/icons/CreditoIcon'
import { useAuth } from '../../hooks/useAuth'
import { PlanetaEscena } from './PlanetaEscena'
import { rasgosDe } from './semilla'
import { rarezaDe } from '../sable/kyber'
import {
  abrirTallerPlaneta, comprarMejora,
  type MejoraPlaneta, type TallerPlaneta,
} from '../../services/planetaService'
import {
  getPersonalizacion, guardarPersonalizacion, type Personalizacion,
} from '../../services/profileCustomService'

/** Las capas, en el orden en que se leen mirando el planeta de afuera hacia adentro. */
const CAPAS = [
  { tipo: 'anillos' as const, titulo: 'Anillos', pie: 'Lo primero que se ve de un mundo, desde lejos.' },
  { tipo: 'ciudades' as const, titulo: 'Ciudades', pie: 'Se encienden en la cara nocturna.' },
  { tipo: 'nubes' as const, titulo: 'Nubes', pie: 'Corren más rápido que el suelo.' },
  { tipo: 'auroras' as const, titulo: 'Auroras', pie: 'En los polos, del color de tu atmósfera.' },
]

/** La columna del perfil donde vive el grado puesto de cada capa. */
const CAMPO = {
  anillos: 'planet_rings',
  ciudades: 'planet_cities',
  nubes: 'planet_clouds',
  auroras: 'planet_auroras',
} as const

export function TerraformarPage() {
  const { currentProfileId } = useAuth()
  const [taller, setTaller] = useState<TallerPlaneta | null>(null)
  const [perfil, setPerfil] = useState<Personalizacion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [deNoche, setDeNoche] = useState(true)

  /* Se sube para volver a consultar. Llamar una función async DESDE el efecto
     cuenta como escritura síncrona de estado y es error de lint en este repo. */
  const [recarga, setRecarga] = useState(0)
  const recargar = useCallback(() => setRecarga(n => n + 1), [])

  useEffect(() => {
    let vivo = true
    if (!currentProfileId) {
      /* La bandera se apaga en una microtarea y no aquí mismo: escribir estado
         SÍNCRONO dentro de un efecto dispara renders en cascada y es error de
         lint en este repo. Mismo patrón que ya hubo que corregir tres veces en
         el Taller. */
      void Promise.resolve().then(() => { if (vivo) setCargando(false) })
      return () => { vivo = false }
    }
    void (async () => {
      const [t, p] = await Promise.all([
        abrirTallerPlaneta(),
        getPersonalizacion(currentProfileId),
      ])
      if (!vivo) return
      setTaller(t)
      setPerfil(p)
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [currentProfileId, recarga])

  /* El mundo que se ve es el TUYO con lo que tenés puesto ahora mismo: tocar
     una capa lo cambia en el acto. Una tienda que no enseña lo que vende
     obliga a comprar a ciegas. */
  const rasgos = useMemo(
    () => rasgosDe(currentProfileId ?? '', {
      familia: perfil?.planet_family ?? null,
      mares: perfil?.planet_seas ?? null,
      crateres: perfil?.planet_craters ?? null,
      anillos: perfil?.planet_rings ?? null,
      lunas: perfil?.planet_moons ?? null,
      ciudades: perfil?.planet_cities ?? 0,
      nubes: perfil?.planet_clouds ?? 0,
      auroras: perfil?.planet_auroras ?? 0,
      /* `acento`, no `accent`. Iba mal escrito detrás de un `as`, y el `as`
         lo tapaba: la vista previa ignoraba el acento del perfil y elegía la
         familia por semilla. Un cast que calla un campo mal escrito es peor
         que no tener tipos. */
      acento: perfil?.accent ?? null,
    }),
    [currentProfileId, perfil],
  )

  /* `null` solo tiene sentido en anillos, y significa «los que me tocaron por
     semilla» — que es distinto de 0 («ninguno») y sigue siendo gratis. Las
     otras tres capas no tienen ese estado: o están puestas o están apagadas. */
  const poner = useCallback(async (tipo: keyof typeof CAMPO, grado: number | null) => {
    if (!perfil || !currentProfileId) return
    const campo = CAMPO[tipo]
    const antes = perfil[campo]
    // Optimista: la vista previa tiene que responder al toque. Si el servidor
    // lo baja (no la tenés comprada), la relectura lo devuelve a su sitio.
    setPerfil({ ...perfil, [campo]: grado })
    const r = await guardarPersonalizacion(currentProfileId, { [campo]: grado })
    if (!r.ok) {
      setPerfil(p => (p ? { ...p, [campo]: antes } : p))
      setAviso('No se pudo guardar')
    }
  }, [perfil, currentProfileId])

  const comprar = useCallback(async (m: MejoraPlaneta) => {
    setOcupado(true); setAviso(null)
    const r = await comprarMejora(m.id)
    if (!r.ok) { setAviso(r.mensaje ?? 'No se pudo comprar'); setOcupado(false); return }
    setAviso(`${m.nombre} es tuya`)
    recargar()
    // Se pone sola al comprarla: nadie compra una mejora para no usarla.
    await poner(m.tipo, m.grado)
    setOcupado(false)
  }, [recargar, poner])

  if (cargando) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-swu-muted">
        Midiendo la atmósfera…
      </div>
    )
  }

  if (!taller || !perfil) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Lock size={26} className="mx-auto mb-3 text-swu-muted" />
        <p className="text-[15px] font-black text-swu-text">Entrá con tu cuenta</p>
        <p className="mt-1 text-[12px] text-swu-muted">
          Terraformar usa tus créditos y cambia TU mundo, así que necesita saber
          quién sos.
        </p>
        <Link to="/" className="mt-5 inline-block text-[13px] text-swu-cyan">Volver a Inicio</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3 pb-28">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Link to="/" className="-ml-1 p-1 text-swu-muted hover:text-swu-text">
          <ChevronLeft size={18} />
        </Link>
        <div className="min-w-0 text-center">
          <h1 className="truncate text-[17px] font-black tracking-[0.14em] text-swu-text">
            TERRAFORMAR
          </h1>
          <p className="text-[10px] font-bold tracking-wider text-swu-amber">
            {perfil.planet_name || 'TU MUNDO'}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-swu-amber/40 bg-swu-amber/10 px-2.5 py-1 text-[12px] font-black tabular-nums text-swu-amber">
          <CreditoIcon size={15} />
          {taller.saldo.toLocaleString('es-SV')}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-swu-border">
        <PlanetaEscena rasgos={rasgos} deNoche={deNoche} className="h-[42vh] min-h-[300px] w-full" />
        {/* Sin este botón, comprar ciudades sería comprar a ciegas: viven en la
            cara que no se ve. Arranca de NOCHE porque es donde está lo que
            esta pantalla vende. */}
        <button
          onClick={() => setDeNoche(v => !v)}
          className="absolute bottom-2 right-2 rounded-lg border border-swu-border bg-swu-bg/80 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-swu-text backdrop-blur"
        >
          {deNoche ? 'Ver de día' : 'Ver de noche'}
        </button>
      </div>

      <p className="mt-2 px-1 text-[11px] leading-snug text-swu-muted">
        La forma de tu mundo —familia, mares, cráteres, anillos y lunas— es tuya
        y sigue siendo gratis, en Mi Perfil. Acá se compra lo que le ponés
        encima.
      </p>

      {aviso && (
        <p className="mt-2 rounded-xl border border-swu-border bg-swu-surface px-3 py-2 text-center text-[12px] text-swu-text">
          {aviso}
        </p>
      )}

      {CAPAS.map(capa => {
        const mias = taller.mejoras
          .filter(m => m.tipo === capa.tipo)
          .sort((a, b) => a.grado - b.grado)
        const puesto = perfil[CAMPO[capa.tipo]]
        const tengoAlgo = mias.some(m => m.tengo)
        return (
          <section key={capa.tipo} className="mt-5">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-swu-text">
                {capa.titulo}
              </h2>
              {tengoAlgo && (
                <button
                  onClick={() => void poner(capa.tipo, 0)}
                  className={`text-[10px] font-bold uppercase tracking-wider
                              ${puesto === 0 ? 'text-swu-amber' : 'text-swu-muted'}`}
                >Apagar</button>
              )}
            </div>
            <p className="mb-2 text-[11px] text-swu-muted">{capa.pie}</p>

            <div className="-mx-4 flex snap-x items-stretch gap-2 overflow-x-auto px-4 pb-1">
              {/* Los anillos llevan una tarjeta de más: LOS DE TU SEMILLA. Es
                  gratis y es el valor de fábrica —lo que tu mundo ya tenía—, y
                  sin ella comprar un estilo sería una puerta de una sola
                  dirección: no habría forma de volver a los propios. */}
              {capa.tipo === 'anillos' && (
                <button
                  onClick={() => void poner('anillos', null)}
                  className={`flex w-40 shrink-0 snap-start flex-col gap-1.5 rounded-xl border-2 border-swu-border p-2.5 text-left
                              ${puesto == null ? 'bg-swu-accent/12' : 'bg-swu-surface'}`}
                >
                  <span className="rounded bg-swu-border/40 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-swu-muted">
                    De fábrica
                  </span>
                  <span className="truncate text-[13px] font-black tracking-tight text-swu-text">
                    LOS DE TU SEMILLA
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-swu-muted">
                    {puesto == null ? 'Puestos' : 'Gratis · siempre tuyos'}
                  </span>
                </button>
              )}
              {mias.map(m => {
                const r = rarezaDe(m.rareza)
                const activa = m.tengo && puesto === m.grado
                return (
                  <button
                    key={m.id}
                    disabled={ocupado}
                    onClick={() => (m.tengo ? void poner(capa.tipo, m.grado) : void comprar(m))}
                    className={`flex w-40 shrink-0 snap-start flex-col gap-1.5 rounded-xl border-2 p-2.5 text-left
                                transition-transform active:scale-[0.99] disabled:opacity-60
                                ${r.borde} ${activa ? 'bg-swu-accent/12' : m.tengo ? 'bg-swu-surface' : 'bg-swu-bg'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${r.ficha} ${r.texto}`}>
                        {r.rotulo}
                      </span>
                      {activa
                        ? <Check size={15} className="shrink-0 text-swu-accent-texto" />
                        : !m.tengo && <Lock size={13} className="shrink-0 text-swu-muted" />}
                    </div>
                    <span className="truncate text-[13px] font-black tracking-tight text-swu-text">
                      {m.nombre}
                    </span>
                    {activa ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-swu-accent-texto">
                        Puesta
                      </span>
                    ) : m.tengo ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-swu-muted">
                        La tenés · tocá para poner
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-black text-swu-amber">
                        <CreditoIcon size={13} />
                        {m.precio.toLocaleString('es-SV')}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}

      <p className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-swu-muted">
        <Sparkles size={12} />
        Los créditos son los mismos del Taller Kyber: una sola bolsa.
      </p>
    </div>
  )
}
