/**
 * Los filtros del buscador del constructor de mazos.
 *
 * ── Qué había y qué faltaba ───────────────────────────────────────────
 *
 * El motor (`searchCards`) ya aceptaba OCHO filtros —texto, set, tipo,
 * aspecto, rareza, coste, arena, palabra clave, rasgo, y el cruce con la
 * colección— y esta pantalla exponía **tres**. Otra vez lo mismo de siempre en
 * este repo: la capacidad estaba y no se veía.
 *
 * ── Qué se muestra siempre y qué va detrás de «Más filtros» ───────────
 *
 * Aspecto y coste se quedan a la vista: son los dos ejes con los que uno
 * piensa una carta al armar («necesito una unidad de Command de coste 3»).
 * El resto se pliega, porque la columna del buscador es angosta y seis filas
 * de fichas empujan los resultados abajo del pliegue — y los resultados son
 * el motivo de la pantalla.
 *
 * El botón lleva el NÚMERO de filtros activos adentro. Un panel plegado que no
 * dice que hay algo puesto es cómo alguien busca diez minutos sin entender por
 * qué no aparece su carta.
 *
 * ── Los rasgos llevan buscador; las palabras clave, no ────────────────
 *
 * Medido sobre las 2.314 cartas canónicas: **58 rasgos** y **16 palabras
 * clave**. Dieciséis fichas se leen de un vistazo; cincuenta y ocho son un
 * muro. Por eso los rasgos tienen campo de búsqueda y se muestran los más
 * usados primero.
 *
 * ── «De mis aspectos» dice lo que PUEDE saber, y nada más ─────────────
 *
 * Lo natural sería un filtro «sin penalización de aspecto», que es la pregunta
 * de verdad al armar. **No se puede.** El CR 8.1.2 dice que un ícono repetido
 * cuenta doble —Protector (SOR #41) lleva DOS de Vigilance y con un solo ícono
 * en el mazo cuesta +2— y el API **no expone el conteo**: devuelve
 * `aspects: ['Vigilance']`, una lista sin repetidos. Verificado carta por
 * carta: 0 de 9.185 impresiones traen un aspecto duplicado.
 *
 * Así que el filtro se llama por lo que hace —«de mis aspectos»— y no promete
 * un cálculo de coste que la base no permite. Si algún día el API expone los
 * íconos, ESE es el momento de convertirlo en penalización; hasta entonces,
 * renombrarlo sería mentir.
 */

import { useEffect, useMemo, useState } from 'react'
import { SlidersHorizontal, Search, X } from 'lucide-react'
import { TIPOS_CARTA, ARENAS } from '../../services/filtrosCarta'
import { translateType, translateArena } from '../../services/translations'
import { vocabularioDeCartas } from '../../services/swuApi'
import { contarActivos, SIN_FILTROS, type FiltrosAvanzados } from './filtrosAvanzados'

/* NO se re-exportan `SIN_FILTROS` ni `FiltrosAvanzados` desde acá: reexportar
   una constante desde un archivo de componentes rompe el Fast Refresh igual
   que declararla. Quien las necesite las toma de `filtrosAvanzados.ts`. */

interface Props {
  valor: FiltrosAvanzados
  onCambio: (f: FiltrosAvanzados) => void
  /** Los aspectos que dan el líder y la base. Vacío = todavía no hay mazo. */
  aspectosDelMazo: string[]
}

/** Ficha de un solo valor: al tocar la elegida, se apaga. */
function Ficha({ activa, onClick, children }: {
  activa: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        activa
          ? 'border-swu-accent bg-swu-accent/20 text-swu-accent-texto'
          : 'border-swu-border bg-swu-surface text-swu-muted'
      }`}
    >
      {children}
    </button>
  )
}

export function FiltrosBusqueda({ valor, onCambio, aspectosDelMazo }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [vocab, setVocab] = useState<{ rasgos: string[]; palabrasClave: string[] }>({
    rasgos: [], palabrasClave: [],
  })
  const [buscaRasgo, setBuscaRasgo] = useState('')

  // Se pide al ABRIR y no al montar: es un barrido de la base entera y la
  // mayoría de las sesiones no despliega el panel.
  useEffect(() => {
    if (!abierto) return
    let vivo = true
    void (async () => {
      const v = await vocabularioDeCartas()
      if (vivo) setVocab(v)
    })()
    return () => { vivo = false }
  }, [abierto])

  const activos = contarActivos(valor)
  const poner = (parche: Partial<FiltrosAvanzados>) => onCambio({ ...valor, ...parche })

  const rasgosVisibles = useMemo(() => {
    const q = buscaRasgo.trim().toLowerCase()
    const base = q ? vocab.rasgos.filter(r => r.toLowerCase().includes(q)) : vocab.rasgos
    // Sin búsqueda se enseñan los 18 más usados; con búsqueda, todo lo que case.
    return q ? base.slice(0, 40) : base.slice(0, 18)
  }, [vocab.rasgos, buscaRasgo])

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setAbierto(o => !o)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            activos > 0
              ? 'border-swu-accent bg-swu-accent/15 text-swu-accent-texto'
              : 'border-swu-border bg-swu-surface text-swu-muted'
          }`}
        >
          <SlidersHorizontal size={12} />
          Más filtros
          {/* El número va EN el botón: un panel plegado que no avisa que hay
              algo puesto es cómo alguien busca sin entender por qué no aparece
              su carta. */}
          {activos > 0 && (
            <span className="flex h-[15px] min-w-[15px] items-center justify-center rounded-full
                             bg-swu-accent px-1 font-mono text-[9px] font-bold text-white">
              {activos}
            </span>
          )}
        </button>

        {activos > 0 && (
          <button
            onClick={() => onCambio(SIN_FILTROS)}
            className="text-[10px] font-medium text-swu-red-texto"
          >
            Quitar
          </button>
        )}
      </div>

      {abierto && (
        <div className="space-y-2.5 rounded-xl border border-swu-border bg-swu-surface/50 p-2.5">
          {/* ── Tipo ── */}
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-swu-muted">Tipo</p>
            <div className="flex flex-wrap gap-1">
              {TIPOS_CARTA.map(t => (
                <Ficha key={t} activa={valor.tipo === t} onClick={() => poner({ tipo: valor.tipo === t ? null : t })}>
                  {translateType(t)}
                </Ficha>
              ))}
            </div>
          </div>

          {/* ── Arena ── */}
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-swu-muted">Arena</p>
            <div className="flex flex-wrap gap-1">
              {ARENAS.map(a => (
                <Ficha key={a} activa={valor.arena === a} onClick={() => poner({ arena: valor.arena === a ? null : a })}>
                  {translateArena(a)}
                </Ficha>
              ))}
            </div>
          </div>

          {/* ── Palabras clave: 16, caben como fichas ── */}
          {vocab.palabrasClave.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-swu-muted">
                Palabra clave
              </p>
              <div className="flex flex-wrap gap-1">
                {vocab.palabrasClave.map(k => (
                  <Ficha
                    key={k}
                    activa={valor.palabraClave === k}
                    onClick={() => poner({ palabraClave: valor.palabraClave === k ? null : k })}
                  >
                    {k}
                  </Ficha>
                ))}
              </div>
            </div>
          )}

          {/* ── Rasgos: 58, con buscador ── */}
          {vocab.rasgos.length > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-swu-muted">Rasgo</p>
                {valor.rasgo && (
                  <button
                    onClick={() => poner({ rasgo: null })}
                    className="flex items-center gap-1 rounded-lg border border-swu-accent bg-swu-accent/20
                               px-2 py-0.5 text-[10px] font-bold text-swu-accent-texto"
                  >
                    {valor.rasgo} <X size={10} />
                  </button>
                )}
              </div>
              <div className="relative mb-1">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-swu-muted" />
                <input
                  value={buscaRasgo}
                  onChange={e => setBuscaRasgo(e.target.value)}
                  placeholder={`Buscar entre ${vocab.rasgos.length} rasgos…`}
                  className="w-full rounded-lg border border-swu-border bg-swu-bg py-1.5 pl-7 pr-2
                             text-[11px] text-swu-text outline-none focus:border-swu-accent"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {rasgosVisibles.map(r => (
                  <Ficha key={r} activa={valor.rasgo === r} onClick={() => poner({ rasgo: valor.rasgo === r ? null : r })}>
                    {r}
                  </Ficha>
                ))}
                {!buscaRasgo && vocab.rasgos.length > rasgosVisibles.length && (
                  <span className="self-center text-[10px] text-swu-muted">
                    +{vocab.rasgos.length - rasgosVisibles.length} más — buscá arriba
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── De mis aspectos ──
              Solo aparece si el mazo YA tiene líder o base: sin ellos no hay
              aspectos que comparar y el interruptor no filtraría nada. Un
              control que no hace nada enseña a desconfiar del resto. */}
          {aspectosDelMazo.length > 0 && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-swu-border bg-swu-bg p-2">
              <input
                type="checkbox"
                checked={valor.soloMisAspectos}
                onChange={e => poner({ soloMisAspectos: e.target.checked })}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-swu-accent)]"
              />
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold text-swu-text">De mis aspectos</span>
                <span className="block text-[10px] leading-snug text-swu-muted">
                  Tu mazo da {aspectosDelMazo.map(a => translateAspectoCorto(a)).join(' · ')}.
                  Las demás se pueden jugar igual, pagando 2 de más por ícono.
                </span>
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  )
}

/** El nombre corto del aspecto, para que la línea de ayuda no ocupe tres. */
function translateAspectoCorto(a: string): string {
  const corto: Record<string, string> = {
    Vigilance: 'Vigilancia', Command: 'Mando', Aggression: 'Agresividad',
    Cunning: 'Astucia', Heroism: 'Heroísmo', Villainy: 'Maldad',
  }
  return corto[a] ?? a
}
