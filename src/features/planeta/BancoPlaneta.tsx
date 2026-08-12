import { useMemo, useState } from 'react'
import { PlanetaEscena } from './PlanetaEscena'
import { rasgosDe, nombrePorDefecto } from './semilla'

/**
 * Banco de pruebas del modo planeta. Solo en desarrollo (`/banco-planeta`).
 *
 * Existe por una razón concreta: el modo planeta vive detrás del muro de sesión,
 * y el mundo se genera a partir del id del usuario. Sin este banco no hay forma
 * de MIRAR si la siembra funciona —que es lo único que hace que el planeta de
 * cada quien sea suyo— sin loguearse con ocho cuentas distintas.
 *
 * Lo que hay que poder ver acá:
 *   · que dos ids den mundos que se distinguen a simple vista, no solo en los
 *     números (paleta, cantidad de mares, cráteres, inclinación);
 *   · que el mismo id dé SIEMPRE el mismo mundo al ir y volver;
 *   · los FPS, que es lo que decide si esto se puede entregar en un teléfono.
 *
 * Se cae del bundle de producción: `import.meta.env.DEV` es un literal y el
 * empaquetador poda la rama entera.
 */

/** Ids reales de la comunidad y algunos sintéticos, para ver la variedad. */
const IDS = [
  '4a7167d2-ffef-4607-8426-d3cfbcfa4c2d',
  'b4757401-0e92-4540-95b7-a8e0ebcb71f8',
  'e91c6998-9ccc-4ebc-af61-2cd10291e76a',
  '00000000-0000-4000-8000-000000000001',
  'qa-mundo-desierto',
  'qa-mundo-jungla',
  'qa-mundo-volcan',
  'qa-mundo-cristal',
]

export function BancoPlaneta() {
  const [i, setI] = useState(0)
  const [fps, setFps] = useState(0)
  const id = IDS[i]
  const rasgos = useMemo(() => rasgosDe(id), [id])

  return (
    <div className="fixed inset-0 flex flex-col bg-[#03040a]">
      <PlanetaEscena rasgos={rasgos} onFps={setFps} className="flex-1" />

      <div className="absolute inset-x-0 top-0 space-y-2 p-3">
        <div className="flex flex-wrap gap-1.5">
          {IDS.map((x, k) => (
            <button
              key={x}
              onClick={() => setI(k)}
              className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${
                k === i
                  ? 'border-swu-cyan bg-swu-cyan/20 text-swu-cyan'
                  : 'border-white/15 bg-black/50 text-white/70'
              }`}
            >
              {x.slice(0, 8)}
            </button>
          ))}
        </div>
        <div className="inline-block rounded-lg border border-white/10 bg-black/60 px-2.5 py-1.5
                        font-mono text-[10px] leading-relaxed text-white/80 backdrop-blur">
          <div>{nombrePorDefecto(id)} · <b className="text-swu-cyan">{fps} fps</b></div>
          <div>
            mares {rasgos.nivelMares.toFixed(3)} · giro {rasgos.giro.toFixed(2)} ·
            cráteres ×{rasgos.densidadCrateres.toFixed(2)}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: rasgos.altiplano }} />
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: rasgos.mares }} />
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: rasgos.atmosfera }} />
            <span>{rasgos.altiplano} / {rasgos.mares}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
