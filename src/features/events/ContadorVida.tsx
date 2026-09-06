import { useEffect, useRef, useState } from 'react'
import { anotarVida, type AsientoMesa } from '../../services/mesasService'

/**
 * La vida que le queda a alguien en su mesa.
 *
 * ── Para qué sirve, además de mirarla ────────────────────────────────
 *
 * Es lo que decide quién es «el mejor segundo» y pasa a la final. Todos los
 * segundos sacan los mismos puntos en su mesa, así que sin esto había que
 * elegir con una regla de escritorio —el tamaño de la mesa, la siembra—. Con
 * la vida anotada, pasa el que quedó más entero: un hecho de la partida.
 *
 * ── Por qué vive acá y no dentro del panel del organizador ───────────
 *
 * Porque lo lleva LA MESA, no quien organiza. Nació dentro de `MesasPanel`,
 * que solo existe en el tablero, que rechaza a quien no es admin: en la
 * práctica los daños de las tres mesas tenían que pasar por un solo teléfono.
 * Acá lo usan las dos pantallas —el tablero y el lobby— y cada mesa lleva el
 * suyo.
 *
 * El permiso lo comprueba el servidor: quien está sentado en esa mesa, o quien
 * organiza. Alguien de otra mesa no puede tocarlo — esa vida vale una silla en
 * la final.
 *
 * ── Dónde se usa esto de verdad, que es lo que manda el diseño ───────
 *
 * En una mesa, con gente encima, hablando, con una mano ocupada sosteniendo
 * cartas. Eso decide dos cosas que antes estaban mal:
 *
 * 1. LOS BOTONES MIDEN 44 px, no 24. Los de puesto de la misma fila ya median
 *    44 (`h-11`) y estos eran los únicos chiquitos. A 24 px no se ve un error
 *    en pantalla: se ve a alguien tocando tres veces para bajar una vida, y al
 *    rato dejando de anotar.
 *
 * 2. TOCAR NO ESPERA AL SERVIDOR. Antes el botón se deshabilitaba mientras
 *    guardaba (`disabled={... || guardando}`), así que bajar de 30 a 25 eran
 *    cinco viajes de ida y vuelta en fila, cada uno bloqueando el siguiente.
 *    Con la señal de una tienda eso se siente igual que un contador roto. Ahora
 *    la pantalla obedece al instante y el servidor se entera 450 ms después del
 *    ÚLTIMO toque: cinco toques seguidos son UNA escritura, no cinco.
 *
 * Si el servidor rechaza, se vuelve al último valor que él confirmó —no al
 * inmediatamente anterior, que con varios toques encadenados sería un número
 * intermedio que nunca existió— y se avisa.
 */

/** Cuánto se espera desde el último toque antes de escribir. */
const REPOSO_MS = 450

export function ContadorVida({ asiento, bloqueada, onError }: {
  asiento: AsientoMesa; bloqueada: boolean; onError: (m: string) => void
}) {
  /** Lo que se ve. Cambia al instante con cada toque. */
  const [valor, setValor] = useState<number | null>(asiento.vida)
  /**
   * El MISMO valor, en una ref.
   *
   * No es una copia por comodidad: es lo que hace que tocar rápido funcione.
   * El estado de React no se actualiza dentro del mismo tick, así que cuatro
   * toques seguidos leían los cuatro el `valor` viejo del cierre y calculaban
   * los cuatro el mismo número — bajar de 30 a 26 bajaba a 29 y nada más.
   * Medido en el banco: 4 toques, 1 punto. Una ref sí se actualiza al toque.
   */
  const actual = useRef<number | null>(asiento.vida)
  /** Lo último que el servidor aceptó. Es a donde se vuelve si rechaza. */
  const confirmado = useRef<number | null>(asiento.vida)
  /** Lo que falta por mandar. `null` = no hay nada pendiente. */
  const pendiente = useRef<number | null>(null)
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* «¿Hay algo sin mandar?» va en ESTADO y no solo en la ref, porque el render
     necesita saberlo y una ref no se puede leer mientras se dibuja. */
  const [sinMandar, setSinMandar] = useState(false)

  /* La foto de lo guardado manda cuando cambia: si otro de la mesa anotó, esto
     llega por tiempo real. Pero NO puede pisar una edición todavía sin mandar,
     o los toques de quien está anotando en este momento se deshacen solos a
     mitad de la cuenta. */
  const [ultimo, setUltimo] = useState(asiento.vida)
  if (ultimo !== asiento.vida) {
    setUltimo(asiento.vida)
    if (!sinMandar) setValor(asiento.vida)
  }

  /* Las refs se ponen al día en un efecto: escribirlas durante el render las
     deja distintas entre dos dibujados del mismo estado. Acá solo se escriben
     refs —ningún `setState`— así que tampoco encadena un render de más. */
  useEffect(() => {
    confirmado.current = asiento.vida
    if (pendiente.current === null) actual.current = asiento.vida
  }, [asiento.vida])

  const mandar = async (nuevo: number) => {
    const r = await anotarVida(asiento.id, nuevo)
    // Otro toque llegó mientras se escribía: manda el más nuevo, no este.
    if (pendiente.current !== null) return
    if (r.ok) {
      confirmado.current = nuevo
    } else {
      setValor(confirmado.current)
      actual.current = confirmado.current
      onError(r.mensaje)
    }
  }

  /** `delta` y no un valor absoluto: cada toque parte de lo que dejó el anterior. */
  const mover = (delta: number) => {
    // Sin nada anotado, «−» arranca en 30 y «+» en 29: los dos aterrizan donde
    // uno espera (29 y 30) en el primer toque.
    const base = actual.current ?? (delta < 0 ? 30 : 29)
    const nuevo = Math.max(0, Math.min(99, base + delta))
    actual.current = nuevo
    setValor(nuevo)
    pendiente.current = nuevo
    setSinMandar(true)
    if (reloj.current) clearTimeout(reloj.current)
    reloj.current = setTimeout(() => {
      const v = pendiente.current
      pendiente.current = null
      setSinMandar(false)
      if (v !== null) void mandar(v)
    }, REPOSO_MS)
  }

  /* Si la pantalla se desmonta con algo sin mandar, se manda YA. Sin esto,
     anotar la última vida y cerrar el lobby en el mismo segundo pierde el
     dato — y es justo el que decide quién pasa a la final. */
  useEffect(() => () => {
    if (reloj.current) clearTimeout(reloj.current)
    const v = pendiente.current
    pendiente.current = null
    if (v !== null) void anotarVida(asiento.id, v)
  }, [asiento.id])

  return (
    <span className="mt-1 flex items-center gap-1.5">
      <Boton
        signo="−"
        onClick={() => mover(-1)}
        bloqueada={bloqueada}
        etiqueta={`Quitarle vida a ${asiento.player_name}`}
      />
      <span className={`min-w-[2.6rem] text-center font-mono text-xl font-bold tabular-nums ${
        valor === null ? 'text-swu-muted' : valor <= 5 ? 'text-swu-red-texto' : 'text-swu-text'
      }`}>
        {/* «—» y no 0: no haber anotado no es haber quedado en cero. */}
        {valor === null ? '—' : valor}
      </span>
      <Boton
        signo="+"
        onClick={() => mover(+1)}
        bloqueada={bloqueada}
        etiqueta={`Subirle vida a ${asiento.player_name}`}
      />
      {/* La palabra «vida» NO se dibuja, y es una cuenta, no un descuido: en un
          teléfono de 375 px quedan 327 útiles, los cuatro botones de puesto se
          llevan 156 y el contador 142 — la etiqueta se pasa 13 px y quedaba
          CORTADA a media palabra, que es peor que no estar. Sigue viva en el
          `aria-label` de cada botón («Quitarle vida a Winnie»), que es donde
          de verdad hace falta. Sin ella sobran 21 px. */}
    </span>
  )
}

/**
 * Solo se deshabilita si la mesa está cerrada — NUNCA por estar guardando.
 * Un botón que se apaga mientras viaja la petición es lo que hacía que la
 * gente tocara tres veces y dejara de anotar.
 */
function Boton({ signo, onClick, bloqueada, etiqueta }: {
  signo: string; onClick: () => void; bloqueada: boolean; etiqueta: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={bloqueada}
      aria-label={etiqueta}
      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-swu-bg
                 font-mono text-xl text-swu-text transition-colors active:bg-swu-surface-hover
                 disabled:opacity-40"
    >
      {signo}
    </button>
  )
}
