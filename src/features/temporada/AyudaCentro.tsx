/**
 * AyudaCentro — cómo se opera una temporada, y las tres cosas que rompen.
 *
 * Va dentro del módulo y no en un documento aparte porque la única persona
 * que la necesita ya está acá adentro, y un documento en otro sitio se
 * queda viejo sin que nadie lo note.
 */

import { HudPanel } from '../../components/Hud'
import { AlertTriangle } from 'lucide-react'

const PASOS = [
  {
    n: 1,
    t: 'Creá la temporada',
    d: 'Nombre, primer sábado, cuántas fechas y cuántos clasifican a la final. Se puede cambiar después.',
  },
  {
    n: 2,
    t: 'Agregá las fechas',
    d: 'Una por sábado, con su formato. La última marcala como Gran Final.',
  },
  {
    n: 3,
    t: 'Enlazá cada fecha con su torneo',
    d: 'El torneo se crea como siempre en /admin/events. Acá se elige de la lista. Un torneo solo puede estar en una fecha.',
  },
  {
    n: 4,
    t: 'El día del torneo: sembrá',
    d: 'En el torneo, pestaña Inscritos → «Sembrar clasificación». Crea la clasificación desde los inscritos y pone el torneo en curso.',
  },
  {
    n: 5,
    t: 'Armá la llave',
    d: 'Pestaña Llaves. Para eliminación, antes acomodá el orden de siembra: el 1.º cruza con el último.',
  },
  {
    n: 6,
    t: 'Jugá con el tablero en vivo',
    d: 'El enlace de arriba del torneo lleva al tablero de siempre, que tiene tiempo real y temporizador. Los resultados se reportan ahí.',
  },
  {
    n: 7,
    t: 'Cerrá el torneo',
    d: 'Pestaña Llaves → «Cerrar torneo». Reparte premios y congela los puestos. Recién ahí el torneo cuenta para la tabla de la temporada.',
  },
  {
    n: 8,
    t: 'Publicá',
    d: 'Pestaña Publicar: la tabla en CSV, texto o imagen, y el borrador del artículo para el blog.',
  },
]

const TRAMPAS = [
  {
    t: 'La tabla de la temporada solo cuenta torneos CERRADOS',
    d: 'Antes de cerrar, los puestos todavía pueden cambiar. Si una fecha no aparece en la tabla, casi siempre es que falta cerrarla.',
  },
  {
    t: 'Cerrar va por el botón de acá, no por el tablero en vivo',
    d: 'Las funciones de avanzar ronda también saben marcar el torneo como terminado, pero no reparten nada: dejarían a todos sin premio y sin XP.',
  },
  {
    t: 'Quien juega sin cuenta entra igual a la tabla',
    d: 'Se agrupa por su nombre. Escribilo siempre igual —«Marlin», no «marlin» un día y «Marlín» otro— o serían dos personas distintas. El día que se registre, su historial se une solo.',
  },
  {
    t: 'El artículo sale como borrador, nunca publicado',
    d: 'Se guarda sin publicar a propósito: los números son correctos, pero la lectura del torneo la escribe una persona. Revisalo antes de publicarlo desde el blog.',
  },
  {
    t: 'Con menos de 20 listas no se publican porcentajes',
    d: 'El artículo cuenta líderes en vez de sacar porcentajes cuando la muestra es chica. Sobre 8 listas, un punto porcentual es media persona.',
  },
]

export function AyudaCentro() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-swu-amber">
          Centro de temporada
        </p>
        <h1 className="text-2xl font-black text-swu-text">Cómo se usa</h1>
      </header>

      <div className="space-y-2">
        {PASOS.map(p => (
          <div key={p.n} className="flex gap-3 rounded-lg bg-swu-surface p-3">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full
                             bg-swu-bg font-mono text-xs font-bold text-swu-amber">
              {p.n}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-swu-text">{p.t}</p>
              <p className="text-xs leading-relaxed text-swu-muted">{p.d}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-swu-amber">
          <AlertTriangle size={13} /> Lo que rompe
        </p>
        {TRAMPAS.map(t => (
          <HudPanel key={t.t} compact tone="amber">
            <div className="p-3">
              <p className="text-sm font-bold text-swu-text">{t.t}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-swu-muted">{t.d}</p>
            </div>
          </HudPanel>
        ))}
      </div>

      <HudPanel compact>
        <div className="space-y-1.5 p-3.5">
          <p className="text-sm font-bold text-swu-text">Quién ve esto</p>
          <p className="text-xs leading-relaxed text-swu-muted">
            Solo quien esté en <code className="font-mono text-swu-cyan">centro_curadores</code>.
            Ser admin no alcanza: los otros administradores no ven este módulo, no
            pueden escribir en él y no pueden darse acceso desde la app. Se reparte
            insertando una fila a mano en la base.
          </p>
          <p className="text-xs leading-relaxed text-swu-muted">
            No hay enlace a este módulo en ningún menú. Se entra tecleando{' '}
            <code className="font-mono text-swu-cyan">/temporada</code>.
          </p>
        </div>
      </HudPanel>
    </div>
  )
}
