/**
 * Banco de pruebas del sable de experiencia. Solo en desarrollo (`/banco-sable`).
 *
 * La proporción de un sable no se juzga leyendo números: se juzga mirándolo al
 * ancho real de la tarjeta y con distintos porcentajes de carga, porque una
 * hoja al 8 % y una al 95 % son dibujos muy distintos.
 *
 * Se cae del bundle de producción (mismo patrón que BancoMarcos).
 */

import { LightsaberXpBar } from './LightsaberXpBar'

/** Los anchos REALES donde vive la barra: tarjeta móvil, tarjeta y perfil ancho. */
const ANCHOS = [320, 360, 420, 560]

/** XP elegido para caer en distintos puntos de la hoja. */
const CARGAS = [30, 400, 1200, 4200, 12000]

export function BancoSable() {
  return (
    <div className="min-h-screen bg-swu-bg p-6 space-y-10">
      <div>
        <h1 className="text-lg font-black text-swu-text">Banco del sable</h1>
        <p className="text-[11px] text-swu-muted">
          La hoja tiene que leerse como una HOJA: larga y esbelta al lado de la
          empuñadura. Si parece una barra de progreso con un adorno a la
          izquierda, está mal.
        </p>
      </div>

      {ANCHOS.map(w => (
        <section key={w} className="space-y-4">
          <h2 className="font-mono text-[11px] text-swu-muted">ancho {w}px</h2>
          <div className="space-y-5" style={{ width: w }}>
            {CARGAS.map(xp => (
              <div key={xp} className="rounded-xl border border-swu-border bg-swu-surface p-3">
                <LightsaberXpBar xp={xp} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
