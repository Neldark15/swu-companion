import { useState } from 'react'
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
 * Se escribe optimista y se corrige si el servidor rechaza: en la mesa la
 * gente toca rápido y esperar el viaje de ida y vuelta por cada punto haría
 * el contador inusable.
 */
export function ContadorVida({ asiento, bloqueada, onError }: {
  asiento: AsientoMesa; bloqueada: boolean; onError: (m: string) => void
}) {
  const [valor, setValor] = useState<number | null>(asiento.vida)
  const [guardando, setGuardando] = useState(false)

  // La foto de lo guardado manda cuando cambia: si otro de la mesa anotó, esto
  // llega por tiempo real y lo editado localmente deja de aplicar.
  const [ultimo, setUltimo] = useState(asiento.vida)
  if (ultimo !== asiento.vida) { setUltimo(asiento.vida); setValor(asiento.vida) }

  const poner = async (nuevo: number) => {
    const antes = valor
    setValor(nuevo)
    setGuardando(true)
    const r = await anotarVida(asiento.id, nuevo)
    setGuardando(false)
    if (!r.ok) { setValor(antes); onError(r.mensaje) }
  }

  return (
    <span className="mt-0.5 flex items-center gap-1">
      <button
        onClick={() => void poner(Math.max(0, (valor ?? 30) - 1))}
        disabled={bloqueada || guardando}
        aria-label={`Quitarle vida a ${asiento.player_name}`}
        className="flex h-6 w-6 items-center justify-center rounded bg-swu-bg font-mono text-sm text-swu-muted disabled:opacity-40"
      >
        −
      </button>
      <span className={`min-w-[2.2rem] text-center font-mono text-[13px] font-bold ${
        valor === null ? 'text-swu-muted' : valor <= 5 ? 'text-swu-red-texto' : 'text-swu-text'
      }`}>
        {/* «—» y no 0: no haber anotado no es haber quedado en cero. */}
        {valor === null ? '—' : valor}
      </span>
      <button
        onClick={() => void poner(Math.min(99, (valor ?? 29) + 1))}
        disabled={bloqueada || guardando}
        aria-label={`Subirle vida a ${asiento.player_name}`}
        className="flex h-6 w-6 items-center justify-center rounded bg-swu-bg font-mono text-sm text-swu-muted disabled:opacity-40"
      >
        +
      </button>
      <span className="text-[9px] uppercase tracking-wider text-swu-muted">vida</span>
    </span>
  )
}
