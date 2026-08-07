/**
 * CardPreviewSheet — ver una carta en grande sin salir de donde estás.
 *
 * Nació porque dentro de un mazo las cartas solo tenían botones de + y −: se
 * podía cambiar la cantidad pero no LEER la carta, que es justo lo que hace
 * falta mientras se arma. Salir al detalle y volver perdía el hilo.
 *
 * Muestra el arte grande y además el texto de reglas transcrito: en una foto
 * de carta a 300 px el texto no se lee, y el objetivo es revisar efectos.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, RotateCcw, Check, Minus, Gavel, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { Sheet } from './ui/Sheet'
import { CardImage } from './CardImage'
import { Carta3D } from './Carta3D'
import { isLandscapeFace } from '../services/cardArt'
import { getCardQuantity } from '../services/collectionService'
import { PLAYSET_SIZE } from '../services/swuApi'
import { rulingsDeCarta, type AclaracionesDeCarta } from '../services/rulingsService'
import { db } from '../services/db'
import type { Card } from '../types'

/** Color de cada aspecto, el mismo que usa el resto de la app. */
const ASPECTO_COLOR: Record<string, string> = {
  Vigilance: 'text-blue-400 border-blue-400/40',
  Command: 'text-green-400 border-green-400/40',
  Aggression: 'text-red-400 border-red-400/40',
  Cunning: 'text-yellow-400 border-yellow-400/40',
  Heroism: 'text-slate-200 border-slate-200/40',
  Villainy: 'text-zinc-400 border-zinc-400/40',
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | number | null | undefined }) {
  if (valor === null || valor === undefined || valor === '') return null
  return (
    <div className="text-center">
      <p className="text-[9px] font-mono uppercase tracking-wider text-swu-muted/60">{etiqueta}</p>
      <p className="text-sm font-bold text-swu-text font-mono">{valor}</p>
    </div>
  )
}

function Bloque({ titulo, texto }: { titulo: string; texto: string | null | undefined }) {
  if (!texto) return null
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-swu-muted/60 mb-0.5">{titulo}</p>
      <p className="text-xs text-swu-text leading-relaxed whitespace-pre-line">{texto}</p>
    </div>
  )
}

/**
 * «Aclaraciones oficiales» — los rulings que FFG publica POR CARTA.
 *
 * Se dibuja SOLO cuando la carta tiene algo oficial que decir. De las 9.057
 * impresiones, 978 cartas tienen aclaraciones: poner un «sin aclaraciones» en
 * las otras ocho mil sería ruido en el 90% de las aperturas, y entrenaría a
 * ignorar la sección justo en las cartas donde importa. Por eso
 * `rulingsDeCarta` devuelve `null` cuando no hay nada y acá se sale sin pintar.
 *
 * El texto va EN INGLÉS a propósito: es el normativo, igual que en /rulings.
 * Traducirlo sería inventar una versión que ningún juez puede citar. La nota
 * transicional y la suspensión sí vienen en español porque son avisos
 * nuestros sobre el estado de la carta, no texto de regla.
 *
 * Vive acá y no en un archivo propio porque la comparten la hoja rápida y la
 * ficha completa, que son las dos formas de «leer una carta» en la app.
 */
export function AclaracionesOficiales({ carta }: { carta: Card }) {
  // Las aclaraciones viajan CON el id de la carta a la que pertenecen, por la
  // misma razón que la cantidad del binder: al pasar de una carta con rulings
  // a otra sin ellos, mostrar los viejos un instante es afirmar algo falso
  // sobre la carta que está a la vista.
  const [datos, setDatos] = useState<{ id: string; info: AclaracionesDeCarta | null } | null>(null)
  /** De qué carta está desplegada la sección (mismo patrón que el dorso): al
   *  abrir otra vuelve sola a plegarse, sin efecto que la reinicie. */
  const [abiertaDe, setAbiertaDe] = useState<string | null>(null)

  const { id, setCode, setNumber } = carta

  useEffect(() => {
    let vivo = true
    void rulingsDeCarta(id, { setCode, setNumber })
      .then(info => { if (vivo) setDatos({ id, info }) })
    return () => { vivo = false }
  }, [id, setCode, setNumber])

  const info = datos && datos.id === id ? datos.info : null
  if (!info) return null

  const abierta = abiertaDe === id
  const n = info.rulings.length

  return (
    <div className="rounded-xl border border-swu-cyan/30 bg-swu-cyan/5 overflow-hidden">
      <button
        onClick={() => setAbiertaDe(a => (a === id ? null : id))}
        aria-expanded={abierta}
        aria-controls={`aclaraciones-${id}`}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-swu-cyan/10 transition-colors
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent"
      >
        <Gavel size={14} className="text-swu-cyan flex-shrink-0" aria-hidden />
        <span className="text-[12px] font-bold text-swu-cyan flex-1">Aclaraciones oficiales</span>
        {n > 0 && (
          <span className="text-[10px] font-mono text-swu-cyan/80 flex-shrink-0">{n}</span>
        )}
        {abierta
          ? <ChevronDown size={14} className="text-swu-cyan flex-shrink-0" aria-hidden />
          : <ChevronRight size={14} className="text-swu-cyan/70 flex-shrink-0" aria-hidden />}
      </button>

      {abierta && (
        <div id={`aclaraciones-${id}`} className="border-t border-swu-cyan/20 px-3 py-2.5 space-y-2.5">
          {/* Una carta suspendida se juega distinto: va ARRIBA de todo. */}
          {info.suspendida && (
            <div className="flex items-start gap-2 rounded-lg border border-swu-red/35 bg-swu-red/10 px-2.5 py-2">
              <AlertTriangle size={13} className="text-swu-red flex-shrink-0 mt-0.5" aria-hidden />
              <p className="text-[11px] text-swu-red leading-snug">
                <span className="font-bold">Suspendida en {info.suspendida.formato}.</span>{' '}
                No se puede jugar en ese formato.
              </p>
            </div>
          )}

          {info.transicion && (
            <div className="rounded-lg border border-swu-amber/35 bg-swu-amber/10 px-2.5 py-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-swu-amber mb-0.5">
                {info.transicion.titulo}
              </p>
              <p className="text-[11px] text-swu-text leading-snug">{info.transicion.texto}</p>
            </div>
          )}

          {info.rulings.length > 0 && (
            <ul className="space-y-2">
              {info.rulings.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-[10px] font-mono text-swu-cyan/60 flex-shrink-0 mt-0.5">{i + 1}</span>
                  {/* `lang="en"` para que un lector de pantalla en español no
                      lea el inglés con fonética castellana. */}
                  <p lang="en" className="text-[11px] text-swu-text leading-relaxed">{r}</p>
                </li>
              ))}
            </ul>
          )}

          <p className="text-[10px] text-swu-muted/70 leading-snug border-t border-swu-cyan/15 pt-2">
            {info.rulings.length > 0 && 'Texto oficial en inglés (es el normativo). '}
            Fuente: {info.meta.fuente} · Fantasy Flight Games · descargado{' '}
            <span className="font-mono">{info.meta.descargado}</span>.
          </p>
        </div>
      )}
    </div>
  )
}

export function CardPreviewSheet({
  cardId, onClose,
}: {
  /** Carta a mostrar. `null` cierra la hoja. */
  cardId: string | null
  onClose: () => void
}) {
  const [carta, setCarta] = useState<Card | null>(null)
  /** De qué carta se está mirando el dorso. Se guarda el id y no un booleano
   *  para que al abrir otra carta vuelva sola al frente, sin tener que
   *  reiniciar el estado dentro del efecto. */
  const [dorsoDe, setDorsoDe] = useState<string | null>(null)
  const dorso = dorsoDe !== null && dorsoDe === cardId

  useEffect(() => {
    if (!cardId) return
    let vivo = true
    void db.cards.get(cardId).then(c => { if (vivo) setCarta(c ?? null) })
    return () => { vivo = false }
  }, [cardId])

  /**
   * Cuántas copias tiene quien está mirando.
   *
   * Es el dato que convierte un análisis en algo accionable: leyendo una
   * receta, lo primero que uno quiere saber es qué le falta para armarla. Sin
   * esto hay que salir a Mi Botín y buscar carta por carta.
   */
  // La cantidad viaja CON el id de la carta a la que pertenece. Guardar solo
  // el número haría que al pasar de una carta que tenés a una que no, se
  // viera «3 copias» sobre la segunda hasta que resolviera la consulta —o
  // sea, un dato falso durante un instante, que es peor que ninguno.
  const [enBinder, setEnBinder] = useState<{ id: string; qty: number } | null>(null)

  useEffect(() => {
    if (!cardId) return
    let vivo = true
    void getCardQuantity(cardId).then(qty => { if (vivo) setEnBinder({ id: cardId, qty }) })
    return () => { vivo = false }
  }, [cardId])

  const cantidad = enBinder && enBinder.id === cardId ? enBinder.qty : null

  const abierta = cardId !== null
  // La orientación sale de la CARA que se está mostrando, no del tipo de
  // carta. El reverso de un líder es su lado de unidad, que es VERTICAL: con
  // la caja fijada por el tipo, al tocar «Dorso» esa cara quedaba metida en un
  // marco apaisado con dos franjas grises ocupando la mitad del ancho, y
  // encima se veía más chica que cualquier carta normal. `isLandscapeFace` ya
  // existía para exactamente esto.
  const apaisada = carta ? isLandscapeFace(carta, dorso) : false
  const src = dorso && carta?.backImageUrl ? carta.backImageUrl : carta?.imageUrl
  // Showcase, Prestige y las foil son las que cambian de color según el
  // ángulo; una Standard no, y ponerle el halo sería inventarle un acabado.
  const especial = /showcase|prestige|foil/i.test(carta?.variantType ?? '')

  return (
    <Sheet open={abierta} onClose={onClose} title={carta?.name ?? 'Carta'}>
      {carta && (
        <div className="p-4 space-y-3">
          <div className="relative">
            {/* Un LÍDER es dos cartas: el lado de líder, con la habilidad
                que se usa cada ronda, y el de unidad desplegada. Enseñar solo
                una y esconder la otra tras un botón obliga a recordar qué
                decía la que no se ve, que es justo lo que uno necesita
                comparar al leer un análisis. Se muestran las dos. */}
            {carta.isLeader && carta.backImageUrl ? (
              <div className="space-y-2">
                <div className="mx-auto max-w-sm">
                  <p className="text-[9px] uppercase tracking-widest text-swu-amber mb-1">Líder</p>
                  <Carta3D brillo iridiscente={especial}>
                    <CardImage
                      src={carta.imageUrl}
                      alt={`${carta.name}, lado de líder`}
                      orientacion="apaisada"
                      fit="cover"
                      elevacion="realce"
                      className="w-full aspect-[400/286]"
                    />
                  </Carta3D>
                </div>
                <div className="mx-auto max-w-[200px]">
                  <p className="text-[9px] uppercase tracking-widest text-swu-cyan mb-1">Desplegado</p>
                  <Carta3D brillo iridiscente={especial}>
                    <CardImage
                      src={carta.backImageUrl}
                      alt={`${carta.name}, lado de unidad`}
                      orientacion="vertical"
                      fit="cover"
                      elevacion="realce"
                      className="w-full aspect-[286/400]"
                    />
                  </Carta3D>
                </div>
              </div>
            ) : (
              <>
                <Carta3D
                  brillo
                  iridiscente={especial}
                  className={`mx-auto ${apaisada ? 'max-w-sm' : 'max-w-[220px]'}`}
                >
                  <CardImage
                    src={src}
                    alt={carta.name}
                    orientacion={apaisada ? 'apaisada' : 'vertical'}
                    fit="cover"
                    elevacion="realce"
                    className={`w-full ${apaisada ? 'aspect-[400/286]' : 'aspect-[286/400]'}`}
                  />
                </Carta3D>
                {carta.backImageUrl && (
                  <button
                    onClick={() => setDorsoDe(d => (d === cardId ? null : cardId))}
                    className="absolute top-1 right-1 flex items-center gap-1 text-[10px] text-swu-cyan bg-swu-bg/85 border border-swu-border rounded-lg px-2 py-1"
                  >
                    <RotateCcw size={11} aria-hidden /> {dorso ? 'Frente' : 'Dorso'}
                  </button>
                )}
              </>
            )}
          </div>

          <div>
            <p className="text-base font-bold text-swu-text leading-tight">{carta.name}</p>
            {carta.subtitle && <p className="text-xs text-swu-muted">{carta.subtitle}</p>}
            <p className="text-[10px] font-mono text-swu-muted mt-0.5">
              {carta.type}{carta.arena ? ` · ${carta.arena}` : ''} · {carta.setCode} {carta.setNumber} · {carta.rarity}
            </p>
          </div>

          {carta.aspects.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {carta.aspects.map((a, i) => (
                <span key={`${a}-${i}`}
                  className={`text-[10px] font-mono uppercase tracking-wider border rounded-full px-2 py-0.5 ${ASPECTO_COLOR[a] ?? 'text-swu-muted border-swu-border'}`}>
                  {a}
                </span>
              ))}
            </div>
          )}

          {/* Lo tenés o no. Va ARRIBA de las estadísticas porque, leyendo una
              receta, es la pregunta que se hace primero. */}
          {cantidad !== null && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                cantidad > 0
                  ? 'bg-swu-green/10 border-swu-green/35'
                  : 'bg-swu-surface border-swu-border'
              }`}
            >
              {cantidad > 0
                ? <Check size={15} className="text-swu-green flex-shrink-0" aria-hidden />
                : <Minus size={15} className="text-swu-muted flex-shrink-0" aria-hidden />}
              <p className={`text-[12px] font-semibold flex-1 ${cantidad > 0 ? 'text-swu-green' : 'text-swu-muted'}`}>
                {cantidad === 0
                  ? 'No la tenés en tu binder'
                  : `La tenés · ${cantidad} ${cantidad === 1 ? 'copia' : 'copias'}`}
              </p>
              {/* El playset son 3: decirlo evita la cuenta mental de «¿me
                  alcanza para el mazo?». */}
              {cantidad > 0 && cantidad < PLAYSET_SIZE && (
                <span className="text-[10px] font-mono text-swu-muted">
                  te faltan {PLAYSET_SIZE - cantidad}
                </span>
              )}
            </div>
          )}

          <div className="flex justify-around bg-swu-bg rounded-lg border border-swu-border py-2">
            <Dato etiqueta="Coste" valor={carta.cost} />
            <Dato etiqueta="Poder" valor={carta.power} />
            <Dato etiqueta="PV" valor={carta.hp} />
          </div>

          <Bloque titulo="Texto" texto={carta.text} />
          <Bloque titulo="Al desplegar" texto={carta.deployBox} />
          <Bloque titulo="Acción épica" texto={carta.epicAction} />

          {/* Va pegada al texto que aclara, no al pie: quien abre la hoja en
              medio de una partida no debería tener que scrollear para saber
              que la carta tiene una aclaración oficial. */}
          <AclaracionesOficiales carta={carta} />

          {carta.keywords.length > 0 && (
            <p className="text-[11px] text-swu-muted">
              <span className="font-semibold text-swu-text">Palabras clave: </span>
              {carta.keywords.join(', ')}
            </p>
          )}
          {carta.traits.length > 0 && (
            <p className="text-[11px] text-swu-muted">
              <span className="font-semibold text-swu-text">Rasgos: </span>
              {carta.traits.join(', ')}
            </p>
          )}
          {carta.isUnique && (
            <p className="text-[11px] text-swu-amber">
              <span className="font-semibold">Única</span> — solo una copia en juego a la vez.
            </p>
          )}
          {carta.artist && (
            <p className="text-[11px] text-swu-muted">
              <span className="font-semibold text-swu-text">Arte: </span>{carta.artist}
            </p>
          )}
          {carta.variantType && carta.variantType !== 'Standard' && (
            <p className="text-[11px] text-swu-muted">
              <span className="font-semibold text-swu-text">Impresión: </span>{carta.variantType}
            </p>
          )}

          <Link
            to={`/cards/${carta.id}`}
            onClick={onClose}
            className="flex items-center justify-center gap-1.5 text-[11px] text-swu-cyan py-2"
          >
            Ver ficha completa <ExternalLink size={11} aria-hidden />
          </Link>
        </div>
      )}
    </Sheet>
  )
}
