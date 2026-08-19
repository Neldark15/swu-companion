/**
 * InsertorCarta — incrustar `[[carta:Nombre|SET-NUM]]` sin escribirlo.
 *
 * Tres cosas que el textarea no puede dar:
 *  1. El código de impresión se ELIGE viendo el arte, no se busca en otra
 *     pantalla y se transcribe.
 *  2. El viaje de ida y vuelta: la referencia que se va a escribir se resuelve
 *     con la MISMA cadena del renderizador y se comprueba que devuelva la
 *     carta elegida. Es el único modo de cazar la corrupción silenciosa —el
 *     bloque parsea, pero dibuja otra carta— porque ahí el parser dice que sí.
 *  3. Editar la ficha que está bajo el cursor en vez de borrarla y rehacerla.
 */

import { useEffect, useState } from 'react'
import { Loader2, Check, AlertTriangle, ArrowLeft } from 'lucide-react'
import { Sheet } from '../../../components/ui/Sheet'
import { Button } from '../../../components/ui/Button'
import { CardImage } from '../../../components/CardImage'
import { listFaceUrl, listFaceIsLandscape } from '../../../services/cardArt'
import { BuscadorCartas, ElegirImpresion } from './SelectorCarta'
import { elegirImpresion, traerPorNombre, verificarReferencias, type Desvio } from './resolucionCarta'
import { codigoImpresion, fichaCarta } from './sintaxisSalida'
import type { Card } from '../../../types'

export interface InsertorCartaProps {
  onCerrar: () => void
  onAplicar: (texto: string) => void
  /** Ficha que ya está escrita bajo el cursor, para editarla. */
  inicial?: { nombre: string; set: string | null } | null
}

export function InsertorCarta({ onCerrar, onAplicar, inicial = null }: InsertorCartaProps) {
  const [elegida, setElegida] = useState<Card | null>(null)
  const [cambiando, setCambiando] = useState(false)
  const [fijar, setFijar] = useState(true)
  const [cargando, setCargando] = useState(inicial !== null)
  const [chequeo, setChequeo] = useState<{ clave: string; desvio: Desvio | null } | null>(null)

  // Al abrir para EDITAR se resuelve la referencia escrita y se preselecciona.
  const nombreInicial = inicial?.nombre ?? null
  const setInicial = inicial?.set ?? null
  useEffect(() => {
    if (nombreInicial === null) return
    let vivo = true
    void traerPorNombre([nombreInicial])
      .then(mapa => {
        if (!vivo) return
        setElegida(elegirImpresion(mapa.get(nombreInicial.toLowerCase()) ?? [], setInicial) ?? null)
        setFijar(setInicial !== null)
      })
      .catch(() => { if (vivo) setElegida(null) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [nombreInicial, setInicial])

  /*
   * Viaje de ida y vuelta: ¿lo que voy a escribir devuelve la carta elegida?
   *
   * El resultado se guarda CON LA CLAVE de lo que se comprobó y se compara al
   * pintar. Así no hace falta vaciarlo con un setState dentro del efecto —que
   * el lint prohíbe— y nunca se muestra el aviso de la carta anterior mientras
   * la nueva comprobación está en vuelo.
   */
  const clave = elegida ? `${elegida.id}|${fijar}` : ''
  useEffect(() => {
    if (!elegida) return
    let vivo = true
    const set = fijar ? codigoImpresion(elegida) : null
    void verificarReferencias([{ nombre: elegida.name, set, esperada: elegida }])
      .then(d => { if (vivo) setChequeo({ clave, desvio: d[0] ?? null }) })
      .catch(() => { /* sin base local no se puede comprobar: no se afirma nada */ })
    return () => { vivo = false }
  }, [elegida, fijar, clave])

  const desvio = chequeo && chequeo.clave === clave ? chequeo.desvio : null

  const salida = elegida ? fichaCarta(elegida, fijar) : null

  const cerrar = () => { setElegida(null); setCambiando(false); setChequeo(null); onCerrar() }

  const insertar = () => {
    if (!salida?.ok) return
    onAplicar(salida.salida.texto)
    cerrar()
  }

  return (
    <Sheet open onClose={cerrar} title={inicial ? 'Editar la carta' : 'Incrustar una carta'}>
      <div className="space-y-3 p-4">
        {cargando && (
          <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-swu-muted" aria-hidden /></div>
        )}

        {!cargando && !elegida && (
          <BuscadorCartas onElegir={c => { setElegida(c); setCambiando(false) }} />
        )}

        {!cargando && elegida && cambiando && (
          <>
            <button onClick={() => setCambiando(false)} className="flex items-center gap-1.5 text-[12px] text-swu-muted">
              <ArrowLeft size={13} aria-hidden /> Volver
            </button>
            <ElegirImpresion carta={elegida} onElegir={c => { setElegida(c); setCambiando(false) }} />
          </>
        )}

        {!cargando && elegida && !cambiando && (
          <>
            <div className="flex gap-3">
              <div className={listFaceIsLandscape(elegida) ? 'w-40 flex-shrink-0' : 'w-24 flex-shrink-0'}>
                <CardImage
                  src={listFaceUrl(elegida)}
                  orientacion={listFaceIsLandscape(elegida) ? 'apaisada' : 'vertical'}
                  alt={elegida.name}
                  className="w-full"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-swu-text">{elegida.name}</p>
                {elegida.subtitle && <p className="truncate text-[11px] text-swu-muted">{elegida.subtitle}</p>}
                <p className="mt-1 font-mono text-[11px] text-swu-cyan">
                  {codigoImpresion(elegida) ?? 'sin código de impresión'} · {elegida.variantType ?? '—'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="xs" variant="ghost" onClick={() => setCambiando(true)}>Otra impresión</Button>
                  <Button size="xs" variant="ghost" onClick={() => setElegida(null)}>Otra carta</Button>
                </div>
              </div>
            </div>

            <label className="flex items-start gap-2 text-[12px] text-swu-text/85">
              <input
                type="checkbox"
                checked={fijar}
                onChange={e => setFijar(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Fijar esta impresión.
                <span className="block text-[11px] text-swu-muted">
                  Sin fijarla, el nombre solo puede resolver a otra carta: «Cad Bane» son cinco.
                </span>
              </span>
            </label>

            <pre className="overflow-x-auto rounded-lg border border-swu-border bg-swu-bg px-3 py-2 font-mono text-[11px] text-swu-text">
              {salida?.ok ? salida.salida.texto : ''}
            </pre>

            {salida && !salida.ok && (
              <p className="flex items-start gap-1.5 text-[12px] text-swu-red-texto">
                <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" aria-hidden /> {salida.error}
              </p>
            )}
            {salida?.ok && salida.salida.aviso && (
              <p className="flex items-start gap-1.5 text-[12px] text-swu-amber">
                <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" aria-hidden /> {salida.salida.aviso}
              </p>
            )}
            {desvio && (
              <p className="flex items-start gap-1.5 text-[12px] text-swu-amber">
                <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" aria-hidden />
                {desvio.obtenida
                  ? `Ojo: el artículo va a dibujar «${desvio.obtenida.name}${desvio.obtenida.subtitle ? `, ${desvio.obtenida.subtitle}` : ''}» (${desvio.obtenida.setCode}-${desvio.obtenida.setNumber}), no la que elegiste. Probá con otra impresión.`
                  : 'Ojo: con esa referencia el artículo no encuentra ninguna carta y va a mostrar solo el nombre.'}
              </p>
            )}

            <Button block size="sm" onClick={insertar} disabled={!salida?.ok}>
              <Check size={14} aria-hidden /> {inicial ? 'Reemplazar' : 'Insertar'}
            </Button>
          </>
        )}
      </div>
    </Sheet>
  )
}
