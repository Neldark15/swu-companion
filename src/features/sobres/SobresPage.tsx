/**
 * SOBRES — la bóveda: dónde se guardan, se ganan y se abren.
 *
 * ── El estado de la apertura vive ACÁ y no en la caja ────────────────
 *
 * Porque la llamada al servidor y la animación van a distinta velocidad. En
 * cuanto se elige un sobre salen dos cosas a la vez: el sobre saliendo de la
 * caja (medio segundo, fijo) y `abrir_sobre()` viajando a Supabase (lo que
 * tarde la red). Si el estado viviera en la caja, cada una tendría su propia
 * verdad sobre si ya hay cartas.
 *
 * El sobre se COBRA en el servidor, en la misma transacción del sorteo. Si la
 * red se cae a mitad, no se cobró nada: no hay estado intermedio que reparar
 * de este lado.
 */

import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Package, Library, Volume2, VolumeX, Trophy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { useAuth } from '../../hooks/useAuth'
import { ensureCards } from '../../services/swuApi'
import {
  abrirSobre, misSobres, tamanoBinder, totalColeccionable,
  type CartaSacada,
} from '../../services/sobres'
import { CajaDeSobres } from './CajaDeSobres'
import { AperturaSobre } from './AperturaSobre'
import { alternarSilencio, estaEnSilencio } from './sonido'

/** De dónde salen los sobres. Se enseña siempre: un juego sin forma de ganar aburre. */
const FUENTES = [
  { que: 'Una amistosa confirmada', cuanto: '1 sobre para cada uno' },
  { que: 'Ganar un torneo', cuanto: '3 sobres' },
  { que: 'Jugar un torneo', cuanto: '1 sobre' },
]

export function SobresPage() {
  const usuario = useAuth(s => s.supabaseUser)
  const [saldo, setSaldo] = useState<number | null>(null)
  const [piezas, setPiezas] = useState(0)
  const [total, setTotal] = useState(0)
  const [silencio, setSilencio] = useState(estaEnSilencio)

  // Lo de la apertura en curso
  const [abriendo, setAbriendo] = useState<number | null>(null)
  const [cartas, setCartas] = useState<CartaSacada[] | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)

  /* Se sube para volver a consultar: al cerrar una apertura, o al tocar
   * «revisá otra vez». Es una dependencia real del efecto, que es como el
   * resto de la app hace las recargas — un `useCallback` llamado DESDE el
   * efecto cuenta como escritura síncrona de estado y además se queda sin la
   * guarda `vivo`. */
  const [recarga, setRecarga] = useState(0)
  const recargar = useCallback(() => setRecarga(n => n + 1), [])

  const miId = usuario?.id ?? ''

  useEffect(() => {
    if (!miId) return
    let vivo = true
    void (async () => {
      const [s, p, t] = await Promise.all([
        misSobres(miId),
        tamanoBinder(miId),
        totalColeccionable(),
      ])
      if (!vivo) return
      setSaldo(s)
      setPiezas(p)
      setTotal(t)
    })()
    return () => {
      vivo = false
    }
  }, [miId, recarga])

  useEffect(() => {
    // El catálogo tiene que estar en el teléfono ANTES de abrir: el servidor
    // manda uuid pelados y sin catálogo no habría ni nombre ni arte que
    // enseñar. Se pide al entrar, no al abrir, para que la espera no caiga
    // justo en el momento emocionante.
    void ensureCards()
  }, [])

  const elegir = useCallback(
    (indice: number) => {
      setAbriendo(indice)
      setCartas(null)
      setFallo(null)
      abrirSobre()
        .then(r => {
          setCartas(r.cartas)
          setSaldo(r.saldo)
        })
        .catch((e: unknown) => {
          setFallo(e instanceof Error ? e.message : 'No se pudo abrir el sobre')
        })
    },
    [],
  )

  const cerrar = useCallback(() => {
    setAbriendo(null)
    setCartas(null)
    setFallo(null)
    void recargar()
  }, [recargar])

  const otroMas = useCallback(() => {
    // Vuelve a la caja para que vuelva a ELEGIR: abrir el siguiente sin pasar
    // por la caja convertiría el módulo en un botón de máquina tragamonedas,
    // que es justo lo que no es.
    cerrar()
  }, [cerrar])

  if (!usuario) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <EmptyState
          icon={<Package size={26} />}
          title="Los sobres son de tu cuenta"
          hint="Iniciá sesión para guardar lo que abrís: las cartas quedan en tu binder, y las serializadas son de una sola persona en toda la comunidad."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3 pb-24">
      {/* Cabecera */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/"
          className="-ml-1 flex items-center gap-1 p-1 text-sm text-swu-muted hover:text-swu-text"
        >
          <ChevronLeft size={18} />
          Inicio
        </Link>
        <button
          type="button"
          onClick={() => setSilencio(alternarSilencio())}
          className="rounded-lg p-2 text-swu-muted hover:text-swu-text"
          aria-label={silencio ? 'Activar sonido' : 'Silenciar'}
          aria-pressed={silencio}
        >
          {silencio ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {abriendo !== null ? (
        <AperturaSobre
          indiceSobre={abriendo}
          cartas={cartas}
          fallo={fallo}
          alCerrar={cerrar}
          alRepetir={saldo && saldo > 0 ? otroMas : undefined}
        />
      ) : (
        <>
          <h1 className="text-center text-2xl font-black tracking-tight text-swu-text">
            LA BÓVEDA
          </h1>
          <p className="mt-1 mb-6 text-center text-sm text-swu-muted">
            Hiperespacio, foils, Prestige y Showcase. Nada de esto se compra en la tienda.
          </p>

          {/* Saldo y colección */}
          <div className="mb-7 grid grid-cols-2 gap-2.5">
            <div className="clip-hud bg-swu-surface p-3.5 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-swu-muted">
                Sobres
              </p>
              <p className="mt-0.5 text-3xl font-black text-swu-amber">{saldo ?? '—'}</p>
            </div>
            <Link to="/binder-digital" className="clip-hud block bg-swu-surface p-3.5 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-swu-muted">
                Tu binder
              </p>
              <p className="mt-0.5 text-3xl font-black text-swu-cyan">{piezas}</p>
              <p className="text-[10px] text-swu-muted">de {total || '—'}</p>
            </Link>
          </div>

          {saldo === null ? (
            <p className="py-12 text-center text-sm text-swu-muted">Abriendo la bóveda…</p>
          ) : saldo > 0 ? (
            <CajaDeSobres alElegir={elegir} />
          ) : (
            <div className="clip-hud bg-swu-surface/60 px-5 py-9 text-center">
              <Package size={30} className="mx-auto mb-3 text-swu-muted" />
              <p className="font-bold text-swu-text">No te quedan sobres</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-swu-muted">
                Se ganan jugando. Cada amistosa que tu rival confirme les da uno a los dos.
              </p>
              <Button variant="secondary" className="mt-4" onClick={() => void recargar()}>
                Ya jugué, revisá otra vez
              </Button>
            </div>
          )}

          {/* Cómo se ganan */}
          <div className="mt-8">
            <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-swu-muted">
              <Trophy size={13} />
              Cómo se ganan
            </h2>
            <div className="clip-hud divide-y divide-swu-border bg-swu-surface">
              {FUENTES.map(f => (
                <div key={f.que} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-swu-text">{f.que}</span>
                  <span className="text-xs font-bold text-swu-amber">{f.cuanto}</span>
                </div>
              ))}
            </div>
          </div>

          <Link
            to="/binder-digital"
            className="mt-4 flex items-center justify-center gap-2 py-3 text-sm text-swu-cyan"
          >
            <Library size={16} />
            Ver todo lo que llevás
          </Link>
        </>
      )}
    </div>
  )
}
