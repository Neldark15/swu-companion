/**
 * Banco de `AvisoUbicacion` (solo desarrollo).
 *
 * El emergente solo sale a quien NO tiene país, o sea que para mirarlo habría
 * que borrarle el país a alguien de producción. Acá se pinta el panel con el
 * mismo contenido y sin condiciones.
 */
import { useState } from 'react'
import { MapPin, X } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { CONTINENTS } from '../../data/regions'

export function BancoUbicacion() {
  const [abierto, setAbierto] = useState(true)
  const [continente, setContinente] = useState('')
  const [pais, setPais] = useState('')

  return (
    <div className="min-h-screen bg-swu-bg p-6">
      <button onClick={() => setAbierto(true)} className="rounded-xl bg-swu-accent px-4 py-2 text-sm font-bold text-white">
        Abrir el emergente
      </button>
      <p className="mt-3 text-xs text-swu-muted">País elegido: {pais || '(ninguno)'}</p>

      <Sheet open={abierto} onClose={() => setAbierto(false)} title="Tu zona" bare>
        <div className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-swu-accent/15">
              <MapPin size={18} className="text-swu-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-swu-text">¿De qué zona sos?</h2>
              <p className="mt-0.5 text-[12px] leading-snug text-swu-muted">
                Es para ubicarte en el ranking de tu país, en la sala de chat de
                tu zona y en el meta nacional. Nadie ve tu dirección: solo el país.
              </p>
            </div>
            <button onClick={() => setAbierto(false)} aria-label="Después" className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-swu-muted">
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {CONTINENTS.map(c => (
              <button
                key={c.id}
                onClick={() => { setContinente(c.id); setPais('') }}
                className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold ${
                  continente === c.id
                    ? 'border-swu-accent bg-swu-accent/15 text-swu-accent-texto'
                    : 'border-swu-border bg-swu-bg text-swu-muted'
                }`}
              >
                {c.icon} {c.name}
              </button>
            ))}
          </div>

          {continente && (
            <div className="max-h-56 overflow-y-auto rounded-xl border border-swu-border bg-swu-bg p-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                {CONTINENTS.find(c => c.id === continente)?.countries.map(p => (
                  <button
                    key={p.code}
                    onClick={() => setPais(p.code)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[12px] ${
                      pais === p.code
                        ? 'border-swu-accent bg-swu-accent/15 text-swu-accent-texto font-bold'
                        : 'border-transparent text-swu-text'
                    }`}
                  >
                    <span>{p.flag}</span>
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => setAbierto(false)} className="rounded-xl px-3 py-2 text-[12px] font-semibold text-swu-muted">Después</button>
            <button disabled={!pais} className="flex-1 rounded-xl bg-swu-accent px-3 py-2 text-[13px] font-bold text-white disabled:opacity-40">Listo</button>
          </div>
        </div>
      </Sheet>
    </div>
  )
}
