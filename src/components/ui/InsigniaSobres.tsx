/**
 * La insignia del saldo de sobres.
 *
 * Un número chico y ámbar sobre el ícono de Sobredosis. Existe porque el
 * saldo era invisible fuera de esa pantalla: 333 sobres esperando y 26 de 38
 * personas que nunca abrieron ninguno, estando activas la misma semana.
 *
 * ── Tres decisiones ───────────────────────────────────────────────────
 *
 * · **No se dibuja con 0 ni mientras carga.** Una insignia que dice «0» es
 *   ruido permanente, y una que parpadea un 0 antes del número real enseña a
 *   no mirarla. Por eso el store tiene `listo` aparte del `saldo`.
 *
 * · **Se topa en 9+.** Alguien tiene 21 acumulados y «21» dentro de un disco
 *   de 18 px obliga a achicar la tipografía hasta que no se lee. El número
 *   exacto está en Sobredosis; acá lo único que importa es que hay varios.
 *
 * · **No se puede callar.** A diferencia del aviso de Inicio —que salta una
 *   vez la mañana que cae el sobre y se marca en `localStorage` para no
 *   repetirse— esta no tiene botón de descarte: desaparece sola cuando abrís,
 *   que es la única forma honesta de que un recordatorio se vaya.
 */

import { useSobres } from '../../hooks/useSobres'

interface Props {
  /** `punto` para la pestaña Perfil, donde no hay sitio para una cifra. */
  forma?: 'numero' | 'punto'
  className?: string
}

export function InsigniaSobres({ forma = 'numero', className = '' }: Props) {
  const saldo = useSobres(s => s.saldo)
  const listo = useSobres(s => s.listo)

  if (!listo || saldo <= 0) return null

  if (forma === 'punto') {
    return (
      <span
        aria-label={`${saldo} sobres sin abrir`}
        className={`pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full
                    bg-swu-amber ring-2 ring-swu-bg ${className}`}
      />
    )
  }

  return (
    <span
      aria-label={`${saldo} sobres sin abrir`}
      className={`pointer-events-none flex h-[18px] min-w-[18px] items-center justify-center
                  rounded-full bg-swu-amber px-1 font-mono text-[10px] font-bold
                  tabular-nums text-swu-bg ${className}`}
    >
      {saldo > 9 ? '9+' : saldo}
    </span>
  )
}
