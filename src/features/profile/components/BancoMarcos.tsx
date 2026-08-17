/**
 * Banco de pruebas de los marcos. Solo en desarrollo (`/banco-marcos`).
 *
 * Existe porque el marco se juzga a los tamaños en que SE USA, no a 300 px en
 * una lámina: la lista de Comunidad lo pinta a 44 y el perfil a 88. Un panel
 * que se ve espectacular grande y se vuelve barro a 44 es un marco fallado, y
 * eso solo se ve poniéndolos uno al lado del otro.
 *
 * Se cae del bundle de producción: `import.meta.env.DEV` es un literal y el
 * empaquetador poda la rama entera (mismo patrón que BancoPlaneta).
 */

import { MARCOS } from '../../../services/personalizacion'
import { ProfileFrame } from './ProfileFrame'

/** Los tamaños REALES en que la app dibuja marcos. */
const TAMANOS = [44, 56, 64, 72, 88]

export function BancoMarcos() {
  return (
    <div className="min-h-screen bg-swu-bg p-6 space-y-8">
      <div>
        <h1 className="text-lg font-black text-swu-text">Banco de marcos</h1>
        <p className="text-[11px] text-swu-muted">
          Los 7 niveles a los tamaños reales de la app. El de 44 es la lista de Comunidad —
          si ahí no se lee, el marco está mal.
        </p>
      </div>

      {MARCOS.map((m, i) => (
        <section key={m.id} className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] text-swu-muted">{i + 1}</span>
            <h2 className="text-sm font-bold" style={{ color: m.brillo }}>{m.nombre}</h2>
            <span className="font-mono text-[10px] text-swu-muted">nivel {m.minLevel}+</span>
          </div>
          <div className="flex flex-wrap items-end gap-5">
            {TAMANOS.map(t => (
              <div key={t} className="flex flex-col items-center gap-1">
                {/* `level` alto y `marcoId` explícito: se fuerza el marco que se
                    quiere mirar, sin depender del nivel de la cuenta. */}
                <ProfileFrame level={99} size={t} marcoId={m.id}>
                  <div className="h-full w-full bg-gradient-to-br from-slate-700 to-slate-900" />
                </ProfileFrame>
                <span className="font-mono text-[9px] text-swu-muted">{t}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
