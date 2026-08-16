/**
 * Asistente para terminar de armar el perfil.
 *
 * Existe porque la personalización, tal como estaba, no la usaba NADIE: medido
 * sobre los 23 perfiles de producción, bio, banner, vitrina y nombre de planeta
 * estaban en 0 — cero de veintitrés, los cuatro. No es que la gente no quiera:
 * es que había que encontrar el botón, entrar a otra pantalla y llenar todo de
 * una sentada.
 *
 * Acá se pide de a UN dato por paso, cada uno resoluble con uno o dos toques, y
 * **se puede salir en cualquier momento sin perder lo hecho**: cada paso guarda
 * al avanzar. Un asistente que solo guarda al final castiga a quien lo
 * abandona, que es justamente quien más probable es que lo abandone.
 *
 * La `bio` se puede escribir acá por primera vez: la columna existe desde
 * siempre y no había ninguna pantalla que la escribiera. Ese era el 0/23.
 */

import { useMemo, useState } from 'react'
import { Check, ChevronRight, Globe2, Sparkles, Orbit, PenLine } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { supabase, isSupabaseReady } from '../../services/supabase'
import { CONTINENTS } from '../../data/regions'
import {
  ASPECTOS, MAX_ASPECTOS, guardarPersonalizacion,
  type Aspecto, type Personalizacion,
} from '../../services/profileCustomService'
import { nombrePorDefecto } from '../planeta/semilla'
import { ORDEN, type Faltante } from '../../services/perfilCompleto'

interface Props {
  faltantes: Faltante[]
  personalizacion: Personalizacion
  onCerrar: () => void
  /** Se llama tras cada guardado para que la pantalla de atrás se refresque. */
  onGuardado: () => void
}

const ICONO: Record<Faltante, React.ReactNode> = {
  pais: <Globe2 size={16} />,
  aspectos: <Sparkles size={16} />,
  planeta: <Orbit size={16} />,
  bio: <PenLine size={16} />,
  banner: <Sparkles size={16} />,
  vitrina: <Sparkles size={16} />,
}

export function CompletarPerfil({ faltantes, personalizacion, onCerrar, onGuardado }: Props) {
  const auth = useAuth()
  const miId = auth.supabaseUser?.id ?? ''

  // Solo los pasos que el asistente sabe resolver. Banner y vitrina necesitan
  // buscador de cartas y viven en su pantalla; empujarlos acá sería meter media
  // pantalla de Explorar dentro de una hoja.
  const pasos = useMemo(
    () => ORDEN.filter(f => faltantes.includes(f) && f !== 'banner' && f !== 'vitrina'),
    [faltantes],
  )

  const [i, setI] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Borradores de cada paso.
  const [continente, setContinente] = useState<string>('')
  const [pais, setPais] = useState<string>('')
  const [aspectos, setAspectos] = useState<Aspecto[]>(personalizacion.favorite_aspects ?? [])
  const [planeta, setPlaneta] = useState<string>(personalizacion.planet_name ?? '')
  const [bio, setBio] = useState<string>('')

  const paso = pasos[i]
  const ultimo = i >= pasos.length - 1

  function avanzar() {
    setError(null)
    if (ultimo) onCerrar()
    else setI(n => n + 1)
  }

  /** Guarda el paso actual y avanza. Cada paso es independiente. */
  async function guardarYSeguir() {
    if (!paso) return onCerrar()
    setGuardando(true)
    setError(null)
    try {
      if (paso === 'pais') {
        if (!pais) { setError('Elegí tu país.'); return }
        await auth.updateProfile({ country: pais, continent: continente || undefined })
      } else if (paso === 'aspectos') {
        if (!aspectos.length) { setError('Elegí al menos uno.'); return }
        const r = await guardarPersonalizacion(miId, { favorite_aspects: aspectos })
        if (!r.ok) { setError(r.error ?? 'No se pudo guardar.'); return }
      } else if (paso === 'planeta') {
        const r = await guardarPersonalizacion(miId, { planet_name: planeta.trim() || null })
        if (!r.ok) { setError(r.error ?? 'No se pudo guardar.'); return }
      } else if (paso === 'bio') {
        if (!isSupabaseReady()) { setError('Sin conexión.'); return }
        // Gotcha 2f: sin mirar `error` un fallo se ve igual que un éxito.
        const { error: e } = await supabase
          .from('profiles').update({ bio: bio.trim() }).eq('id', miId)
        if (e) { setError('No se pudo guardar tu bio.'); return }
      }
      onGuardado()
      avanzar()
    } finally {
      setGuardando(false)
    }
  }

  if (!paso) {
    return (
      <div className="space-y-3 text-center">
        <Check size={30} className="mx-auto text-swu-green" />
        <p className="text-base font-bold text-swu-text">Tu perfil ya está listo</p>
        <p className="text-sm text-swu-muted">
          La portada y la vitrina se eligen desde tu perfil, con el buscador de cartas.
        </p>
        <Button variant="primary" block onClick={onCerrar}>Cerrar</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progreso: saber cuántos faltan es lo que hace que no se abandone. */}
      <div className="flex items-center gap-1.5">
        {pasos.map((p, k) => (
          <span
            key={p}
            className={`h-1 flex-1 rounded-full ${k < i ? 'bg-swu-green' : k === i ? 'bg-swu-accent' : 'bg-swu-border'}`}
          />
        ))}
        <span className="ml-1 shrink-0 font-mono text-[10px] text-swu-muted">{i + 1}/{pasos.length}</span>
      </div>

      <div className="flex items-center gap-2 text-swu-accent-texto">
        {ICONO[paso]}
        <h3 className="text-[15px] font-black tracking-tight">
          {paso === 'pais' && '¿De dónde sos?'}
          {paso === 'aspectos' && '¿Con qué aspectos jugás?'}
          {paso === 'planeta' && 'Bautizá tu planeta'}
          {paso === 'bio' && 'Una línea sobre vos'}
        </h3>
      </div>

      {paso === 'pais' && (
        <div className="space-y-2">
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
        </div>
      )}

      {paso === 'aspectos' && (
        <div>
          <p className="mb-2 text-[11px] text-swu-muted">Hasta {MAX_ASPECTOS}.</p>
          <div className="grid grid-cols-2 gap-1.5">
            {ASPECTOS.map(a => {
              const activo = aspectos.includes(a.valor)
              return (
                <button
                  key={a.valor}
                  onClick={() => setAspectos(prev =>
                    activo ? prev.filter(x => x !== a.valor)
                      // Al elegir el tercero se descarta el más viejo en vez de
                      // no hacer nada: un botón que ignora el toque se siente roto.
                      : [...prev, a.valor].slice(-MAX_ASPECTOS))}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] font-semibold ${
                    activo ? 'border-swu-accent bg-swu-accent/15 text-swu-text' : 'border-swu-border bg-swu-bg text-swu-muted'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${a.punto}`} />
                  {a.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {paso === 'planeta' && (
        <div className="space-y-1.5">
          <input
            value={planeta}
            onChange={e => setPlaneta(e.target.value)}
            maxLength={28}
            placeholder={miId ? nombrePorDefecto(miId) : 'Tu mundo'}
            className="w-full rounded-xl border border-swu-border bg-swu-bg px-3 py-2.5 text-[14px] text-swu-text
                       placeholder:text-swu-muted focus:border-swu-accent focus:outline-none"
          />
          <p className="text-[11px] text-swu-muted">
            Si lo dejás vacío, tu mundo se sigue llamando{' '}
            <span className="font-mono">{miId ? nombrePorDefecto(miId) : '—'}</span>, como en un catálogo estelar.
          </p>
        </div>
      )}

      {paso === 'bio' && (
        <div className="space-y-1.5">
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            maxLength={160}
            rows={3}
            placeholder="Juego desde SOR. Me gusta el control y odio perder la iniciativa."
            className="w-full resize-none rounded-xl border border-swu-border bg-swu-bg px-3 py-2.5 text-[14px] text-swu-text
                       placeholder:text-swu-muted focus:border-swu-accent focus:outline-none"
          />
          <p className="text-right font-mono text-[10px] text-swu-muted">{bio.length}/160</p>
        </div>
      )}

      {error && <p className="rounded-lg bg-swu-red/15 px-3 py-2 text-[12px] text-swu-red">{error}</p>}

      <div className="flex gap-2">
        {/* Saltar NO pierde lo ya guardado: cada paso guardó al avanzar. */}
        <Button variant="ghost" block onClick={avanzar} disabled={guardando}>
          {ultimo ? 'Terminar' : 'Saltar'}
        </Button>
        <Button variant="primary" block loading={guardando} onClick={() => void guardarYSeguir()}>
          {ultimo ? 'Guardar' : <>Guardar y seguir <ChevronRight size={14} /></>}
        </Button>
      </div>
    </div>
  )
}
