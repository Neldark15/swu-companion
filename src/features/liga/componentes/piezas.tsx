/**
 * Las piezas compartidas del módulo de liga.
 *
 * Hasta hoy no había NI UN componente de liga reutilizable: las once piezas
 * eran funciones privadas dentro de dos archivos, ninguna exportada, y por eso
 * `tonoDelTier` terminó copiado literal en los dos — justo debajo del
 * comentario que advertía que copiarlo sería tener dos ideas del color de
 * legendario.
 *
 * Acá viven **solo las que ya tienen dos consumidores**. Extraer un componente
 * con un solo consumidor no es reutilización, es indirección: `MapaCalor`,
 * `DueloVS` y las acciones rápidas se quedan donde están.
 *
 * ── Nada cableado a PUENTE 3 ─────────────────────────────────────────
 *
 * Todo entra por props. El día que exista Puente 4 —o la liga de otro creador—
 * ninguna de estas piezas hay que tocarla. El documento de diseño proponía un
 * `ProveedorLiga` por contexto para lo mismo; con un solo consumidor de cada
 * dato, un contexto es la indirección que el párrafo de arriba desaconseja, y
 * las props consiguen exactamente lo mismo. Cuando haya tres pantallas
 * pidiendo el color de la liga, ese día se agrega.
 *
 * Este archivo exporta SOLO componentes: mezclar componentes y constantes
 * rompe el Fast Refresh de Vite, y ya hizo falta separarlos tres veces (§3w).
 */

import { useEffect, useState, type ReactNode } from 'react'
import { getCountryByCode } from '../../../data/regions'
import { restanHasta } from './tiempo'

/**
 * La bandera de un país, o nada.
 *
 * Devuelve `null` —no un emoji de reemplazo, no un signo de pregunta— cuando
 * no hay país o el código no existe: 3 de 42 perfiles no tienen país, y una
 * bandera genérica al lado de un nombre afirma una nacionalidad que nadie
 * declaró. El hueco es honesto; el relleno, no.
 */
export function Bandera({ pais, tam = 14 }: { pais?: string | null; tam?: number }) {
  if (!pais) return null
  const p = getCountryByCode(pais.toUpperCase())
  if (!p) return null
  return (
    <span
      title={p.name}
      aria-label={p.name}
      style={{ fontSize: tam, lineHeight: 1 }}
      className="shrink-0"
    >
      {p.flag}
    </span>
  )
}

/**
 * Una cifra de la cabecera: ícono arriba, número grande, rótulo abajo.
 *
 * ── Cinco en fila, con ancho MÍNIMO y no cinco columnas iguales ──────
 *
 * La maqueta las pide en una fila de cinco. Repartir el ancho en cinco partes
 * iguales parece lo obvio y está medido que no funciona: a 375 px la fila mide
 * 337, cada tarjeta 56 y quedan **46 px útiles** — y «Premier» necesita 59 y
 * «120/120» necesita 58 a 13 px. Para que entraran habría que bajar la letra a
 * ~10 px, por debajo del piso de 11 que este proyecto ya se fijó al medir el
 * ranking (§3f).
 *
 * Así que la tarjeta declara un ancho MÍNIMO y crece si sobra: en un teléfono
 * de 393 px las cinco entran completas, y en uno de 375 la fila se corre unos
 * píxeles. Correrse es honesto —se ve que hay más— y truncar «Premier» a
 * «Pre…» no: una cifra que no se puede leer no es una cifra.
 *
 * `min-w-0` en el texto sigue haciendo falta para que el `truncate` tenga
 * contra qué truncar en el caso raro que quede (§4d, §4n).
 */
export function TarjetaCifra(
  { valor, rotulo, icono }: { valor: ReactNode; rotulo: ReactNode; icono?: ReactNode },
) {
  return (
    <div
      className="flex min-w-[74px] flex-1 shrink-0 snap-start flex-col items-center
                 rounded-xl border px-1.5 py-2 text-center"
      style={{ borderColor: 'var(--liga-borde)', background: 'var(--liga-acento-suave)' }}
    >
      {icono && <span className="mb-1" style={{ color: 'var(--liga-acento)' }}>{icono}</span>}
      <p className="w-full min-w-0 truncate text-[12px] font-black leading-none tabular-nums text-swu-text">
        {valor}
      </p>
      <p className="mt-1 text-[8.5px] font-bold uppercase leading-tight tracking-[0.08em] text-swu-muted">
        {rotulo}
      </p>
    </div>
  )
}

/**
 * Cuánto falta para una fecha, contado en vivo.
 *
 * ── Por qué el reloj corre acá y no se calcula una vez ───────────────
 *
 * Esta pantalla se deja abierta. Un «faltan 2 días» calculado al montar sigue
 * diciendo 2 días a la mañana siguiente, y de un contador la gente cree lo que
 * dice — es el mismo fallo que el mapa de calor del panel, donde `new Date()`
 * se congela al cargar y media temporada se lee corrida.
 *
 * Se refresca cada minuto y no cada segundo: el segundero es un `setState` por
 * segundo en una pantalla con lista, tabla y acordeones, y no aporta nada
 * cuando la unidad más chica que se muestra son horas.
 *
 * `hasta` es una fecha SIN hora (`vence_el` es `date`), así que el plazo se
 * toma hasta el FINAL de ese día: vencer «el 12» significa que el 12 todavía
 * se puede jugar.
 */
export function ContadorPlazo(
  { hasta, urgente = false }: { hasta: string | null | undefined; urgente?: boolean },
) {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  /* La cuenta vive en `restanHasta`, compartida con el botón de Inicio: los dos
     hablan del MISMO plazo y cada uno la hacía por su lado — uno redondeaba
     hacia arriba y decía «22 días» mientras el otro decía «21 días 10 h». */
  const r = restanHasta(hasta, ahora)
  if (!r) return null
  if (r.vencido) {
    return <span className="font-black text-swu-red-texto">el plazo ya venció</span>
  }
  const { dias, horas } = r
  return (
    <span className={`font-black tabular-nums ${urgente ? 'text-swu-red-texto' : 'text-swu-text'}`}>
      {dias > 0 ? `${dias} ${dias === 1 ? 'día' : 'días'} ` : ''}
      {dias > 0 ? `${horas} h` : horas > 0 ? `${horas} ${horas === 1 ? 'hora' : 'horas'}` : 'menos de una hora'}
    </span>
  )
}
