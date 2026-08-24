/**
 * «Tenés N sobres sin abrir» — la franja que NO se puede callar.
 *
 * ── Por qué hace falta si ya existe `AvisoSobreDiario` ────────────────
 *
 * Son dos cosas distintas y las dos hacen falta:
 *
 * · `AvisoSobreDiario` anuncia un HECHO NUEVO: hoy cayó tu sobre. Salta una
 *   vez, la mañana que cae, y se marca en `localStorage` para no repetirse.
 *   Está bien que se calle: la novedad se agota al leerla.
 *
 * · Esta anuncia un ESTADO: tenés cosas guardadas. Un estado no se agota al
 *   leerlo, y por eso esta no se marca, no se descarta y no tiene botón de
 *   cerrar. **Desaparece sola cuando abrís un sobre**, que es la única forma
 *   honesta de que un recordatorio se vaya.
 *
 * ── El número que la justifica ────────────────────────────────────────
 *
 * Medido el 2026-08-23: **333 sobres esperando**, **26 de 38 personas que
 * nunca abrieron ninguno**, promedio de 9 acumulados y alguien con 21. Y esas
 * personas estaban activas esa misma semana: 24 de 38 hicieron algo. No se
 * habían ido — no lo veían.
 *
 * ── No se dibuja con 1 ──────────────────────────────────────────────
 *
 * Con un solo sobre ya está el aviso del diario, que además dice que acaba de
 * caer. Esta franja es para lo que se ACUMULÓ, y acumularse empieza en dos.
 * Si no, quien abre todos los días vería las dos cosas cada mañana diciendo
 * casi lo mismo.
 */

import { useNavigate } from 'react-router-dom'
import { useSobres } from '../../hooks/useSobres'
import { SobreMisionIcon, IrIcon } from '../../components/icons/MisionIcons'

/** Desde acá se considera «acumulado». Ver el encabezado. */
const DESDE = 2

export function SobresAcumulados() {
  const navigate = useNavigate()
  const saldo = useSobres(s => s.saldo)
  const listo = useSobres(s => s.listo)

  if (!listo || saldo < DESDE) return null

  return (
    <button
      onClick={() => navigate('/sobres')}
      className="mision-entra flex w-full items-center gap-3 rounded-xl border border-swu-amber/35
                 bg-swu-amber/10 px-3 py-2.5 text-left transition-transform active:scale-[0.99]
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-amber"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-swu-amber/20 text-swu-amber">
        <SobreMisionIcon size={20} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-swu-text">
          Tenés {saldo} sobres sin abrir
        </span>
        {/* Se dice QUÉ hay adentro, no solo que hay algo. «Sobres» es una
            palabra; «cartas brillantes» es un motivo. */}
        <span className="block text-[11px] leading-snug text-swu-muted">
          {saldo * 5} cartas brillantes esperando en tu álbum
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-1 rounded-lg bg-swu-amber px-2.5 py-1.5
                       text-[11px] font-bold text-swu-bg">
        Abrir
        <IrIcon size={12} />
      </span>
    </button>
  )
}
