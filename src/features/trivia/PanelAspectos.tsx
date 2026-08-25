/**
 * LOS ASPECTOS, donde de verdad se ganan: en la Trivia.
 *
 * ── Por qué se mudaron del perfil ─────────────────────────────────────
 *
 * Vivían en Mi Perfil como ocho barras que nadie podía mover. Medido sobre las
 * 39 cuentas, en el PRIMER escalón de cada uno: Vigilancia pedía 100 partidas
 * y el que más jugó lleva 3; Comando pedía 25 torneos y el máximo es 1. Seis de
 * ocho sin una sola persona. No eran difíciles: eran decorativos.
 *
 * Ahora son SEIS —los aspectos de verdad del juego— y se suben de una sola
 * forma: acertando preguntas de ese aspecto. Por eso viven acá, al lado del
 * botón que los mueve. Un progreso que se muestra lejos de donde se gana es un
 * progreso que nadie relaciona con lo que hizo (§3l).
 *
 * ── Y pagan ──────────────────────────────────────────────────────────
 *
 * Cada escalón se cobra una vez, en créditos. Es lo que impide que vuelvan a
 * ser una barra bonita. El botón de cobrar aparece SOLO cuando hay algo que
 * cobrar: un botón apagado que nunca se prende enseña lo mismo que una barra
 * vacía.
 */

import { useCallback, useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { CreditoIcon } from '../../components/icons/CreditoIcon'
import { ASPECTOS, FICHA, NOMBRE_ESCALON, ASPECTO_POR_TEMA } from '../../services/aspectos'
import { misAspectos, cobrarEscalon, type MisAspectos } from '../../services/aspectosService'

/** El tema que alimenta cada aspecto. Es el mapa inverso, y vive en un solo lado. */
const TEMA_DE_ASPECTO = Object.fromEntries(
  Object.entries(ASPECTO_POR_TEMA).map(([tema, aspecto]) => [aspecto, tema]),
) as Record<string, string>

export function PanelAspectos({ onCobro }: { onCobro?: () => void }) {
  const [datos, setDatos] = useState<MisAspectos | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  /* Contador de recarga: llamar una función async DESDE el efecto cuenta como
     escritura síncrona de estado y es error de lint en este repo. */
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vivo = true
    void misAspectos().then(r => { if (vivo) setDatos(r) })
    return () => { vivo = false }
  }, [recarga])

  const cobrar = useCallback(async (tema: string, escalon: number) => {
    setOcupado(true); setAviso(null)
    const r = await cobrarEscalon(tema, escalon)
    if (r.ok) {
      setAviso(`+${r.premio?.toLocaleString('es-SV')} créditos`)
      setRecarga(n => n + 1)
      onCobro?.()
    } else {
      setAviso(r.mensaje ?? 'No se pudo cobrar')
    }
    setOcupado(false)
  }, [onCobro])

  if (!datos) return null

  const porTema = new Map(datos.temas.map(t => [t.tema, t]))

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-swu-muted">
          Tus aspectos
        </h2>
        <span className="text-[10px] text-swu-muted/70">Suben acertando</span>
      </div>
      <p className="mb-3 text-[11px] leading-snug text-swu-muted">
        Cada pregunta que acertás sube el aspecto al que pertenece. Es lo único
        de la app que se sube sabiendo, no gastando.
      </p>

      {aviso && (
        <p className="mb-2 rounded-xl border border-swu-border bg-swu-surface px-3 py-2 text-center text-[12px] text-swu-text">
          {aviso}
        </p>
      )}

      <div className="space-y-2">
        {ASPECTOS.map(asp => {
          const tema = TEMA_DE_ASPECTO[asp]
          const t = porTema.get(tema)
          const correctas = t?.correctas ?? 0
          const escalon = t?.escalon ?? -1
          const cobrados = t?.cobrados ?? []
          const f = FICHA[asp]

          const siguiente = escalon + 1 < datos.umbrales.length ? datos.umbrales[escalon + 1] : null
          const desde = escalon >= 0 ? datos.umbrales[escalon] : 0
          const avance = siguiente === null
            ? 1
            : Math.min(1, Math.max(0, (correctas - desde) / (siguiente - desde)))

          // El escalón más bajo que ya alcanzó y todavía no cobró.
          const porCobrar = escalon >= 0
            ? [0, 1, 2, 3].find(e => e <= escalon && !cobrados.includes(e))
            : undefined

          return (
            <div key={asp} className={`rounded-xl border bg-swu-surface p-3 ${f.borde}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className={`text-[13px] font-black ${f.texto}`}>{f.nombre}</span>
                <span className="text-[11px] tabular-nums text-swu-muted">
                  {correctas} {siguiente !== null && <>/ {siguiente}</>} aciertos
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-swu-muted/80">{f.detalle}</p>

              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/50">
                <div
                  className="h-full rounded-full transition-transform duration-700 origin-left"
                  style={{ background: f.color, transform: `scaleX(${avance})`, width: '100%' }}
                />
              </div>

              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: f.color }}>
                  {escalon >= 0 ? NOMBRE_ESCALON[escalon] : 'Sin rango todavía'}
                </span>
                {porCobrar !== undefined && (
                  <button
                    onClick={() => void cobrar(tema, porCobrar)}
                    disabled={ocupado}
                    className="flex min-h-[32px] items-center gap-1.5 rounded-lg bg-swu-amber px-2.5
                               text-[11px] font-black text-swu-bg disabled:opacity-60"
                  >
                    <CreditoIcon size={12} />
                    Cobrar {datos.premios[porCobrar]?.toLocaleString('es-SV')}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-swu-muted">
        <Sparkles size={12} />
        Cada rango se cobra una sola vez.
      </p>
    </section>
  )
}
