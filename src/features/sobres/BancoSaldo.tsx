/**
 * Banco del contador de sobres (solo desarrollo).
 *
 * El saldo real depende de la sesión y del cron de las 8:00, así que para ver
 * la insignia con 9 habría que esperar nueve días. Acá se fija a mano.
 */
import { useSobres } from '../../hooks/useSobres'
import { InsigniaSobres } from '../../components/ui/InsigniaSobres'
import { SobresAcumulados } from './SobresAcumulados'

const CASOS = [0, 1, 2, 5, 9, 21]

export function BancoSaldo() {
  const saldo = useSobres(s => s.saldo)
  const fijar = useSobres(s => s.fijar)

  return (
    <div className="min-h-screen space-y-5 bg-swu-bg p-5 text-swu-text">
      <div>
        <h1 className="text-lg font-bold">Contador de sobres</h1>
        <p className="text-xs text-swu-muted">
          Saldo actual: <b className="font-mono">{saldo}</b>. Con 0 no se dibuja
          nada, y la franja arranca en 2 (con 1 ya está el aviso del diario).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CASOS.map(n => (
          <button
            key={n}
            onClick={() => fijar(n)}
            className={`min-h-11 rounded-xl border px-4 text-sm font-bold ${
              saldo === n ? 'border-swu-accent bg-swu-accent/15' : 'border-swu-border bg-swu-surface'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-swu-muted">La franja de Inicio</h2>
        <SobresAcumulados />
        {saldo < 2 && <p className="text-xs text-swu-muted">(no se dibuja con {saldo})</p>}
      </section>

      <section className="space-y-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-swu-muted">La insignia</h2>
        <div className="flex items-center gap-6 rounded-xl border border-swu-border bg-swu-surface p-4">
          <span className="flex items-center gap-2">
            <span className="text-xs text-swu-muted">número</span>
            <InsigniaSobres />
          </span>
          <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-swu-bg">
            <span className="text-xs text-swu-muted">punto</span>
            <InsigniaSobres forma="punto" />
          </span>
        </div>
      </section>
    </div>
  )
}
