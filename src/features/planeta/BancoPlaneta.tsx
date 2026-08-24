import { useMemo, useState } from 'react'
import { PlanetaEscena } from './PlanetaEscena'
import { rasgosDe, nombrePorDefecto, ORDEN_FAMILIAS, FAMILIAS } from './semilla'

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

/** Los acentos que existen en el perfil. Se prueban los cinco. */
const ACENTOS = ['cyan', 'amber', 'green', 'red', 'purple']

export function BancoPlaneta() {
  const [i, setI] = useState(0)
  const [fps, setFps] = useState(0)
  // Mismos ajustes que el panel de personalización real, para poder MIRAR lo
  // que hace cada uno: acento heredado, familia elegida a mano y los dos
  // deslizadores.
  const [acento, setAcento] = useState<string | null>(null)
  const [familia, setFamilia] = useState<string | null>(null)
  const [mares, setMares] = useState<number | null>(null)
  const [crateres, setCrateres] = useState<number | null>(null)
  const [anillos, setAnillos] = useState<number | null>(null)
  const [lunas, setLunas] = useState<number | null>(null)
  const [ciudades, setCiudades] = useState<number | null>(0)
  const [nubes, setNubes] = useState<number | null>(0)
  const [auroras, setAuroras] = useState<number | null>(0)
  const [noche, setNoche] = useState(false)
  const id = IDS[i]
  const rasgos = useMemo(
    () => rasgosDe(id, { familia, mares, crateres, anillos, lunas, ciudades, nubes, auroras, acento }),
    [id, familia, mares, crateres, anillos, lunas, ciudades, nubes, auroras, acento],
  )

  return (
    <div className="fixed inset-0 flex flex-col bg-[#03040a]">
      <PlanetaEscena
        deNoche={noche} rasgos={rasgos} onFps={setFps} className="flex-1" />

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
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setAcento(null)}
            className={`rounded px-2 py-1 text-[10px] font-bold border ${acento === null ? 'border-swu-cyan text-swu-cyan' : 'border-white/15 text-white/60'}`}>
            sin acento
          </button>
          {ACENTOS.map(a => (
            <button key={a} onClick={() => { setAcento(a); setFamilia(null) }}
              className={`rounded px-2 py-1 text-[10px] font-bold border ${acento === a ? 'border-swu-cyan text-swu-cyan' : 'border-white/15 text-white/60'}`}>
              {a}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFamilia(null)}
            className={`rounded px-2 py-1 text-[10px] font-bold border ${familia === null ? 'border-swu-amber text-swu-amber' : 'border-white/15 text-white/60'}`}>
            auto
          </button>
          {ORDEN_FAMILIAS.map(f => (
            <button key={f} onClick={() => setFamilia(f)}
              className={`rounded px-2 py-1 text-[10px] font-bold border ${familia === f ? 'border-swu-amber text-swu-amber' : 'border-white/15 text-white/60'}`}>
              {FAMILIAS[f].etiqueta}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/60 px-2 py-1">
          <span className="w-14 font-mono text-[10px] text-white/70">mares</span>
          <input type="range" min={0} max={100} value={mares ?? 50}
            onChange={e => setMares(Number(e.target.value))} className="flex-1 accent-swu-cyan" />
          <button onClick={() => setMares(null)} className="text-[10px] text-white/50 underline">auto</button>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/60 px-2 py-1">
          <span className="w-14 font-mono text-[10px] text-white/70">cráteres</span>
          <input type="range" min={0} max={100} value={crateres ?? 50}
            onChange={e => setCrateres(Number(e.target.value))} className="flex-1 accent-swu-cyan" />
          <button onClick={() => setCrateres(null)} className="text-[10px] text-white/50 underline">auto</button>
        </div>
        <div className="inline-block rounded-lg border border-white/10 bg-black/60 px-2.5 py-1.5
                        font-mono text-[10px] leading-relaxed text-white/80 backdrop-blur">
          <div>{nombrePorDefecto(id)} · <b className="text-swu-cyan">{fps} fps</b> · fam <b className="text-swu-amber">{rasgos.familia}</b></div>

        {/* Anillos y lunas: la semilla los deja en minoría, así que sin estos
            botones habría que probar decenas de ids para ver uno con anillos. */}
        <button
          onClick={() => setNoche(v => !v)}
          className={`self-start rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${noche ? 'border-swu-amber text-swu-amber' : 'border-swu-border text-swu-muted'}`}
        >{noche ? 'viendo la NOCHE' : 'ver la cara nocturna'}</button>

        {([
          ['anillos', anillos, setAnillos, 3],
          ['lunas', lunas, setLunas, 3],
          ['ciudades', ciudades, setCiudades, 3],
          ['nubes', nubes, setNubes, 3],
          ['auroras', auroras, setAuroras, 2],
        ] as const).map(([et, val, set, max]) => (
          <div key={et} className="flex flex-wrap items-center gap-1.5">
            <span className="w-16 font-mono text-[11px] text-swu-muted">{et}</span>
            <button
              onClick={() => set(null)}
              className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${val == null ? 'border-swu-amber text-swu-amber' : 'border-swu-border text-swu-muted'}`}
            >auto</button>
            {Array.from({ length: max + 1 }, (_, n) => (
              <button
                key={n}
                onClick={() => set(n)}
                className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${val === n ? 'border-swu-amber text-swu-amber' : 'border-swu-border text-swu-muted'}`}
              >{n}</button>
            ))}
          </div>
        ))}
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
