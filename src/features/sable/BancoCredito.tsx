/**
 * Banco del ícono de crédito. Solo desarrollo (`/banco-credito`).
 *
 * Un ícono no se juzga leyendo el `path`: se juzga MIRÁNDOLO al tamaño al que
 * de verdad se dibuja. El §3t lo pagó con cuatro íconos de misión que a 15-22 px
 * decían otra cosa (un sobre que parecía calendario, un chat que parecía
 * molécula). Acá están los tamaños REALES donde vive el crédito, más uno grande
 * para juzgar el balance del trazo, y la fila sobre fondo CLARO — que es donde
 * se descubre si el dibujo dependía del fondo oscuro.
 *
 * NO SE JUZGA A OJO: se cuenta TINTA sobre el ícono ya rasterizado. Se dibuja el
 * SVG a su tamaño real en un canvas y se mide qué porcentaje de la caja quedó
 * pintado. Por encima de ~52 % es una mancha, por debajo de ~9 % no se ve. Así
 * se cazaron los dos defectos que este ícono tuvo: la placa encogida cubría el
 * 66 % a 14 px, y con el umbral en 22 seguía cubriendo el 52,7 % a 22 y el 54,1 %
 * a 28. Mirando la pantalla las dos veces «se veía bien».
 */

import { CreditoIcon } from '../../components/icons/CreditoIcon'

const TAMANOS = [14, 15, 16, 20, 22, 28, 34, 64, 120]

export function BancoCredito() {
  return (
    <div className="min-h-screen space-y-8 bg-swu-bg p-6">
      <div>
        <h1 className="text-lg font-black text-swu-text">Ícono de crédito</h1>
        <p className="text-[12px] text-swu-muted">
          Umbral en 34 px: desde ahí la placa completa; debajo, solo el engranaje.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-[11px] font-black uppercase tracking-widest text-swu-muted">
          Sobre el fondo de la app
        </h2>
        <div className="flex flex-wrap items-end gap-6 rounded-xl border border-swu-border bg-swu-surface p-5">
          {TAMANOS.map(t => (
            <div key={t} className="flex flex-col items-center gap-1.5">
              <CreditoIcon size={t} className="text-swu-amber" />
              <span className="font-mono text-[10px] text-swu-muted">{t}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-black uppercase tracking-widest text-swu-muted">
          Sobre fondo claro (acá se cae un ícono que dependía del oscuro)
        </h2>
        <div className="flex flex-wrap items-end gap-6 rounded-xl bg-[#d8dbe0] p-5">
          {TAMANOS.map(t => (
            <div key={t} className="flex flex-col items-center gap-1.5">
              <CreditoIcon size={t} className="text-[#2b2f36]" />
              <span className="font-mono text-[10px] text-[#555]">{t}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-black uppercase tracking-widest text-swu-muted">
          Variante «placa»: el lingote con 700M al pie
        </h2>
        <div className="flex flex-wrap items-end gap-6 rounded-xl border border-swu-border bg-swu-surface p-5">
          {[34, 40, 56, 80, 140].map(t => (
            <div key={t} className="flex flex-col items-center gap-1.5">
              <CreditoIcon size={t} variante="placa" className="text-swu-amber" />
              <span className="font-mono text-[10px] text-swu-muted">{t}</span>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-swu-muted">
          Debajo de 40 px degrada sola a «sello»: el pie no se leería y la chapa
          solo le robaría sitio al escudo.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-black uppercase tracking-widest text-swu-muted">
          En su sitio real: la ficha del saldo y el precio de una pieza
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 rounded-lg border border-swu-amber/40 bg-swu-amber/10 px-2.5 py-1 text-[12px] font-bold text-swu-amber">
            <CreditoIcon size={15} /> 12,450
          </span>
          <button className="flex min-h-[56px] w-56 items-center justify-between gap-2 rounded-xl border border-swu-amber/30 bg-swu-amber/5 px-3 py-2 text-left">
            <span>
              <span className="block text-[12px] font-bold text-swu-text">Cristal púrpura</span>
              <span className="block text-[10px] text-swu-muted">900 cr</span>
            </span>
            <CreditoIcon size={15} className="shrink-0 text-swu-amber" />
          </button>
        </div>
      </section>
    </div>
  )
}
