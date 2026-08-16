/**
 * El aviso de «terminá de armar tu perfil», en Inicio.
 *
 * ── Por qué no es un modal ───────────────────────────────────────────
 *
 * Un modal que tapa la pantalla al entrar es la forma más rápida de que la
 * gente aprenda a cerrar avisos sin leerlos — y después no lee los que sí
 * importan (un torneo que arranca, un regalo que caducó). Esto es una tarjeta
 * que se puede ignorar, que dice CUÁNTO falta y QUÉ se gana, y que se calla
 * sola si molesta.
 *
 * ── Las tres formas de callarlo ──────────────────────────────────────
 *
 *  · Completar todo → desaparece por sí solo, sin tocar nada.
 *  · «Ahora no» → se calla 7 días.
 *  · «No me lo recuerdes» → se calla para siempre.
 *
 * Nunca aparece si el perfil está completo, y nunca aparece mientras los datos
 * todavía se están cargando: `calcularCompletitud` devuelve «completo» ante
 * datos ausentes justamente para que no parpadee un «te falta todo» en cada
 * arranque.
 */

import { useEffect, useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import { Sheet } from '../../components/ui/Sheet'
import { useAuth } from '../../hooks/useAuth'
import { supabase, isSupabaseReady } from '../../services/supabase'
import { getPersonalizacion, type Personalizacion } from '../../services/profileCustomService'
import {
  calcularCompletitud, avisoSilenciado, silenciarAviso, nuncaMasAviso,
} from '../../services/perfilCompleto'
import { CompletarPerfil } from './CompletarPerfil'

export function AvisoPerfil() {
  const { currentProfile, supabaseUser } = useAuth()
  const miId = supabaseUser?.id ?? ''

  const [perso, setPerso] = useState<Personalizacion | null>(null)
  /* La `bio` se pide aparte y NO desde `currentProfile`.
   *
   * `UserProfile` no la lleva, y agregársela obligaría a tocar la hidratación
   * de la sesión — que es justo el código que el gotcha 2v pide no mover sin
   * necesidad. Un campo que solo usa este aviso no justifica ese riesgo. */
  const [bio, setBio] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [oculto, setOculto] = useState(() => avisoSilenciado())
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    if (!miId || !isSupabaseReady()) return
    let vivo = true
    void (async () => {
      const [p, r] = await Promise.all([
        getPersonalizacion(miId),
        supabase.from('profiles').select('bio').eq('id', miId).maybeSingle(),
      ])
      if (!vivo) return
      // Gotcha 2f: hay que mirar `error`. Si la consulta falla se deja `bio`
      // en null Y no se marca la personalización, así el aviso NO aparece
      // diciendo que falta algo que quizá ya está.
      if (r.error) { console.warn('[perfil] no se pudo leer la bio:', r.error.message); return }
      setBio(r.data?.bio ?? null)
      setPerso(p)
    })()
    return () => { vivo = false }
  }, [miId, recarga])

  const c = calcularCompletitud({
    pais: currentProfile?.country,
    bio,
    personalizacion: perso,
  })

  // Silenciado, completo, o todavía sin datos → no se dibuja nada.
  if (oculto || c.completo || !currentProfile) return null

  const cuantos = c.faltantes.length

  return (
    <>
      <div className="px-4 pt-3">
        <div className="relative overflow-hidden rounded-2xl border border-swu-accent/30 bg-swu-accent/[0.07] p-3.5">
          <button
            onClick={() => { silenciarAviso(7); setOculto(true) }}
            aria-label="Ahora no"
            className="absolute right-2 top-2 rounded-lg p-1 text-swu-muted hover:text-swu-text"
          >
            <X size={15} />
          </button>

          <div className="flex items-start gap-3 pr-6">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-swu-accent/15 text-swu-accent-texto">
              <UserPlus size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-black tracking-tight text-swu-text">
                Terminá de armar tu perfil
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-swu-muted">
                {/* Se nombra el PRIMER faltante, que es el que más sirve. Un
                    «completá tu perfil» a secas no dice qué se gana. */}
                Te {cuantos === 1 ? 'falta 1 cosa' : `faltan ${cuantos} cosas`}. {c.faltantes[0].porque}
              </p>

              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-swu-border">
                  <div
                    className="h-full rounded-full bg-swu-accent transition-[width] duration-500"
                    style={{ width: `${c.porcentaje}%` }}
                  />
                </div>
                <span className="shrink-0 font-mono text-[10px] font-bold text-swu-accent-texto">
                  {c.porcentaje}%
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setAbierto(true)}
                  className="rounded-lg bg-swu-accent px-3 py-1.5 text-[12px] font-bold text-swu-bg"
                >
                  Completar ahora
                </button>
                <button
                  onClick={() => { nuncaMasAviso(); setOculto(true) }}
                  className="text-[11px] text-swu-muted underline underline-offset-2"
                >
                  No me lo recuerdes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={abierto} onClose={() => setAbierto(false)} title="Terminá tu perfil">
        {perso && (
          <CompletarPerfil
            faltantes={c.faltantes.map(f => f.id)}
            personalizacion={perso}
            onCerrar={() => setAbierto(false)}
            onGuardado={() => setRecarga(n => n + 1)}
          />
        )}
      </Sheet>
    </>
  )
}
